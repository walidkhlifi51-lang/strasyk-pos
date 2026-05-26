import { useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { useSecurity } from '@/components/contexts/SecurityContext';
import { generateTicketHtml, triggerPrint } from './ticketUtils';

/**
 * Composant invisible monte dans le layout global.
 * Ecoute les commandes web et borne a imprimer cote caisse.
 * Realtime reste prioritaire. Le rattrapage ne tourne plus en boucle:
 * il se fait au montage et au retour de focus/visibilite.
 */
export default function GlobalPrintListener() {
  const { currentTenant } = useTenant();
  const { profile } = useSecurity();
  const printedOrderIds = useRef(new Set());
  const pendingOrderFields = [
    'id',
    'tenant_id',
    'customer_id',
    'numero_caisse',
    'statut',
    'from_web',
    'from_kiosk',
    'print_at_counter',
    'articles',
    'total_ht',
    'total_tva',
    'total_ttc',
    'type_commande',
    'delivery_address',
    'notes',
    'created_date',
    'numero_commande',
    'payee',
    'payment_method',
    'table_id',
    'updated_date',
  ];

  useEffect(() => {
    if (!currentTenant?.id || !profile?.impression_auto) return;

    const processOrderForPrinting = async (order, source = 'listener') => {
      if (!order) return;
      if (order.tenant_id !== currentTenant.id) return;

      const isWebOrder = order.from_web === true;
      const isKioskOrder = order.from_kiosk === true;
      if (!isWebOrder && !isKioskOrder) return;
      if (order.print_at_counter !== true) return;
      if (printedOrderIds.current.has(order.id)) return;

      let shouldPrint = false;

      if (isWebOrder) {
        shouldPrint = ['en_attente', 'en_preparation', 'en_attente_paiement'].includes(order.statut);
      }

      if (isKioskOrder) {
        shouldPrint = true;
      }

      if (!shouldPrint) return;

      printedOrderIds.current.add(order.id);

      try {
        let customer = null;
        if (order.customer_id) {
          try {
            const customers = await appClient.entities.Customer.filter(
              { id: order.customer_id },
              undefined,
              1,
              { fields: ['id', 'nom', 'prenom', 'telephone', 'adresse', 'ville', 'code_postal', 'etage', 'interphone', 'adresses'] }
            );
            customer = customers[0] || null;
          } catch (_) {}
        }

        const html = await generateTicketHtml(order, customer, profile);
        if (html) {
          console.log(
            `🖨️ [GlobalPrint] Impression automatique commande #${order.numero_caisse || order.id?.slice(-4)} (${isWebOrder ? 'web' : 'borne'} / ${source})`
          );
          const printResult = await triggerPrint(html);
          if (!printResult?.triggered) {
            console.error(
              `❌ [GlobalPrint] Impression non declenchee pour la commande #${order.numero_caisse || order.id?.slice(-4)}. Le navigateur a peut-etre bloque l impression.`
            );
            printedOrderIds.current.delete(order.id);
            return;
          }
        }

        try {
          await appClient.entities.Order.update(order.id, { print_at_counter: false });
        } catch (updateError) {
          console.error(
            `❌ [GlobalPrint] Impression declenchee mais impossible de marquer la commande #${order.numero_caisse || order.id?.slice(-4)} comme imprimee:`,
            updateError
          );
        }
      } catch (err) {
        console.error('❌ [GlobalPrint] Erreur impression:', err);
        printedOrderIds.current.delete(order.id);
      }
    };

    const checkPendingOrders = async () => {
      try {
        const pendingOrders = await appClient.entities.Order.filter(
          {
            tenant_id: currentTenant.id,
            print_at_counter: true,
          },
          undefined,
          undefined,
          { fields: pendingOrderFields }
        );

        for (const order of pendingOrders || []) {
          await processOrderForPrinting(order, 'sync-check');
        }
      } catch (error) {
        console.error('❌ [GlobalPrint] Erreur verification file impression:', error);
      }
    };

    const unsubscribe = appClient.entities.Order.subscribe(async (event) => {
      if (event.type !== 'create' && event.type !== 'update') return;
      await processOrderForPrinting(event.data, `realtime-${event.type}`);
    });

    checkPendingOrders();

    const handleFocus = () => {
      checkPendingOrders();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPendingOrders();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentTenant?.id, profile?.impression_auto, profile]);

  return null;
}
