import { useEffect } from 'react';
import { generateTicketHtml, triggerPrint } from './ticketUtils';

/**
 * Composant déclencheur d'impression pour la compatibilité descendante.
 * Il ne rend rien visuellement mais déclenche une impression via un effet.
 */
export default function TicketPrint({ order, customer, profile, tenant, onPrinted }) {
    useEffect(() => {
        console.log('🖨️ [TicketPrint] useEffect déclenché', { 
            hasOrder: !!order, 
            hasProfile: !!profile, 
            orderNum: order?.numero_caisse 
        });
        
        if (order && profile) {
            // generateTicketHtml est async, il faut l'attendre
            (async () => {
                const html = await generateTicketHtml(order, customer, profile, tenant);
                if (html) {
                    console.log('✅ [TicketPrint] HTML généré, déclenchement impression...');
                    triggerPrint(html, onPrinted);
                } else {
                    console.warn('⚠️ [TicketPrint] Pas de HTML généré');
                    if(onPrinted) onPrinted();
                }
            })();
        } else {
            console.warn('⚠️ [TicketPrint] Données manquantes:', { order: !!order, profile: !!profile });
            if (onPrinted) onPrinted();
        }
    }, [order, customer, profile, tenant, onPrinted]);

    return null; // Ce composant ne rend rien
}
