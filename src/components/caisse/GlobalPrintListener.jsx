import { useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { useSecurity } from '@/components/contexts/SecurityContext';
import { generateTicketHtml, triggerPrint } from './ticketUtils';

/**
 * Composant invisible monté dans le layout global.
 * S'abonne aux nouvelles commandes web (from_web) et borne (from_kiosk) avec print_at_counter=true
 * et déclenche l'impression automatiquement, quelle que soit la page ouverte.
 */
export default function GlobalPrintListener() {
  const { currentTenant } = useTenant();
  const { profile } = useSecurity();
  const printedOrderIds = useRef(new Set());

  useEffect(() => {
    if (!currentTenant?.id || !profile?.impression_auto) return;

    const unsubscribe = appClient.entities.Order.subscribe(async (event) => {
      if (event.type !== 'create' && event.type !== 'update') return;

      const order = event.data;
      if (!order) return;
      if (order.tenant_id !== currentTenant.id) return;

      const isWebOrder = order.from_web === true;
      const isKioskOrder = order.from_kiosk === true;

      // Éviter les impressions en double
      const printKey = `${order.id}-${event.type}`;
      if (printedOrderIds.current.has(printKey)) return;

      let shouldPrint = false;

      // Commandes web : imprimer à la création avec statut en_attente/en_preparation
      if (isWebOrder && event.type === 'create') {
        shouldPrint = ['en_attente', 'en_preparation', 'en_attente_paiement'].includes(order.statut);
      }

      // Commandes borne : imprimer quand print_at_counter=true
      if (isKioskOrder && order.print_at_counter === true) {
        shouldPrint = true;
      }

      if (!shouldPrint) return;

      printedOrderIds.current.add(printKey);

      try {
        let customer = null;
        if (order.customer_id) {
          try {
            const customers = await appClient.entities.Customer.filter({ id: order.customer_id });
            customer = customers[0] || null;
          } catch (_) {}
        }

        const html = await generateTicketHtml(order, customer, profile);
        if (html) {
          console.log(`🖨️ [GlobalPrint] Impression automatique commande #${order.numero_caisse || order.id?.slice(-4)} (${isWebOrder ? 'web' : 'borne'})`);
          triggerPrint(html);
        }

        // Pour les commandes borne : reset print_at_counter après impression
        if (isKioskOrder && order.print_at_counter === true) {
          try {
            await appClient.entities.Order.update(order.id, { print_at_counter: false });
          } catch (_) {}
        }
      } catch (err) {
        console.error('❌ [GlobalPrint] Erreur impression:', err);
        printedOrderIds.current.delete(printKey);
      }
    });

    return () => unsubscribe();
  }, [currentTenant?.id, profile?.impression_auto, profile]);

  return null;
}
