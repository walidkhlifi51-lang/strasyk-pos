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
    console.log('[PRINT_LISTENER_MOUNTED]', {
      tenant_id: currentTenant?.id || null,
      impression_auto: profile?.impression_auto ?? null,
      has_profile: Boolean(profile && Object.keys(profile).length > 0),
    });

    if (!currentTenant?.id || !profile?.impression_auto) {
      console.warn('[PRINT_LISTENER_SKIPPED]', {
        tenant_id: currentTenant?.id || null,
        impression_auto: profile?.impression_auto ?? null,
        reason: !currentTenant?.id ? 'missing-tenant' : 'impression-auto-disabled',
      });
      return;
    }

    const processOrderForPrinting = async (order, source = 'listener') => {
      console.log('[PRINT_ORDER_RECEIVED]', {
        source,
        id: order?.id || null,
        tenant_id: order?.tenant_id || null,
        current_tenant_id: currentTenant.id,
        from_kiosk: order?.from_kiosk ?? null,
        from_web: order?.from_web ?? null,
        print_at_counter: order?.print_at_counter ?? null,
        statut: order?.statut ?? null,
      });

      if (!order) return;
      if (order.tenant_id !== currentTenant.id) {
        console.warn('[PRINT_ORDER_FILTERED]', {
          source,
          id: order?.id || null,
          reason: 'tenant-mismatch',
          tenant_id: order?.tenant_id || null,
          current_tenant_id: currentTenant.id,
        });
        return;
      }

      const isWebOrder = order.from_web === true;
      const isKioskOrder = order.from_kiosk === true;
      if (!isWebOrder && !isKioskOrder) {
        console.warn('[PRINT_ORDER_FILTERED]', {
          source,
          id: order?.id || null,
          reason: 'not-web-or-kiosk',
        });
        return;
      }
      if (order.print_at_counter !== true) {
        console.warn('[PRINT_ORDER_FILTERED]', {
          source,
          id: order?.id || null,
          reason: 'print-flag-false',
          print_at_counter: order?.print_at_counter ?? null,
        });
        return;
      }
      if (printedOrderIds.current.has(order.id)) {
        console.warn('[PRINT_ORDER_FILTERED]', {
          source,
          id: order?.id || null,
          reason: 'already-processing',
        });
        return;
      }

      let shouldPrint = false;

      if (isWebOrder) {
        shouldPrint = ['en_attente', 'en_preparation', 'en_attente_paiement'].includes(order.statut);
      }

      if (isKioskOrder) {
        shouldPrint = true;
      }

      if (!shouldPrint) {
        console.warn('[PRINT_ORDER_FILTERED]', {
          source,
          id: order?.id || null,
          reason: 'status-not-eligible',
          statut: order?.statut ?? null,
          from_kiosk: isKioskOrder,
          from_web: isWebOrder,
        });
        return;
      }

      console.log('[PRINT_ORDER_ELIGIBLE]', {
        source,
        id: order?.id || null,
        tenant_id: order?.tenant_id || null,
        numero_caisse: order?.numero_caisse || null,
        from_kiosk: isKioskOrder,
        from_web: isWebOrder,
        statut: order?.statut ?? null,
        print_at_counter: order?.print_at_counter ?? null,
      });

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
          console.log('[PRINT_TRIGGER_CALLED]', {
            source,
            id: order?.id || null,
            numero_caisse: order?.numero_caisse || null,
            from_kiosk: isKioskOrder,
            from_web: isWebOrder,
          });
          const printResult = await triggerPrint(html);
          if (!printResult?.triggered) {
            console.error('[PRINT_TRIGGER_BLOCKED]', {
              source,
              id: order?.id || null,
              numero_caisse: order?.numero_caisse || null,
              result: printResult || null,
            });
            printedOrderIds.current.delete(order.id);
            return;
          }
          console.log('[PRINT_TRIGGER_SUCCESS]', {
            source,
            id: order?.id || null,
            numero_caisse: order?.numero_caisse || null,
            result: printResult || null,
          });
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
