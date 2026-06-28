import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import QRCode from 'qrcode';
import { appClient } from '@/api/appClient';
import { toParisDate as toParisDateValue } from '@/lib/dateParsing';

/**
 * Génère le HTML d'un ticket de caisse pour impression thermique
 */
export async function generateTicketHtml(order, customer, profile, tenant = null) {
    if (!order || !profile) {
        console.error('[generateTicketHtml] Données manquantes:', { order, profile });
        return null;
    }
    
    console.log('🎫 [generateTicketHtml] Commande:', order);
    console.log('🎫 [generateTicketHtml] cagnotte_spent:', order.cagnotte_spent);

    const orderDate = toParisDateValue(order.created_date);
    const dateStr = orderDate && !Number.isNaN(orderDate.getTime())
        ? orderDate.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Date invalide';

    // Type de commande
    const orderTypeLabels = {
        'sur_place': 'SUR PLACE',
        'emporter': 'À EMPORTER',
        'livraison': 'LIVRAISON'
    };
    const orderTypeLabel = orderTypeLabels[order.type_commande] || 'COMMANDE';
    let tableLabel = order?.table?.nom || order?.table_name || order?.table_nom || order?.nom_table || order?.numero_table || null;
    const beeperLabel = order?.numero_bipeur ? String(order.numero_bipeur) : null;
    const enseigneName = `${tenant?.nom_commercial || ''}`.trim();
    const establishmentName = `${profile?.nom_etablissement || ''}`.trim();
    const ticketHeaderName = enseigneName || establishmentName || 'Restaurant';
    const showEstablishmentSubtitle = establishmentName && enseigneName && enseigneName.toLowerCase() !== establishmentName.toLowerCase();

    if (!tableLabel && order?.table_id) {
        try {
            const tables = await appClient.entities.Table.filter({ id: order.table_id }, '-created_date', 1);
            tableLabel = tables?.[0]?.nom || null;
        } catch (error) {
            console.warn('[generateTicketHtml] Impossible de charger la table:', error);
        }
    }

    // Calculer les totaux par taux de TVA
    const tvaBreakdown = {};
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    // Fonction pour ajouter un montant à une catégorie de TVA
    const addToTVA = (tvaRate, amountTTC) => {
        const rate = parseFloat(tvaRate) || 0;
        const amountHT = amountTTC / (1 + rate / 100);
        const amountTVAonly = amountTTC - amountHT;

        if (!tvaBreakdown[rate]) {
            tvaBreakdown[rate] = { ht: 0, tva: 0, ttc: 0 };
        }
        tvaBreakdown[rate].ht += amountHT;
        tvaBreakdown[rate].tva += amountTVAonly;
        tvaBreakdown[rate].ttc += amountTTC;

        totalHT += amountHT;
        totalTVA += amountTVAonly;
        totalTTC += amountTTC;
    };

    // Traiter tous les articles
    const articles = order.articles || [];
    articles.forEach(article => {
        const isDiscount = article.product_id?.startsWith('discount-') || 
                          article.product_id?.startsWith('loyalty-') || 
                          article.product_id?.startsWith('promo-') ||
                          article.product_id?.startsWith('offer-');
        
        if (!isDiscount) {
            const lineTTC = (article.prix_unitaire || 0) * (article.quantite || 1);
            addToTVA(article.tva || 10, lineTTC);
        }
    });

    // Sauvegarder le total AVANT remises pour calcul proportionnel
    const totalBeforeDiscounts = totalTTC;

    // Appliquer les remises au prorata sur chaque taux de TVA
    const discounts = articles.filter(a => 
        a.product_id?.startsWith('discount-') || 
        a.product_id?.startsWith('loyalty-') || 
        a.product_id?.startsWith('promo-')
    );
    
    discounts.forEach(discount => {
        const discountAmount = Math.abs(discount.prix_unitaire || 0);
        if (discountAmount > 0 && totalBeforeDiscounts > 0) {
            // Répartir la remise proportionnellement sur chaque taux de TVA
            Object.keys(tvaBreakdown).forEach(rate => {
                const proportion = tvaBreakdown[rate].ttc / totalBeforeDiscounts;
                const discountForThisRate = discountAmount * proportion;
                addToTVA(parseFloat(rate), -discountForThisRate);
            });
        }
    });
    
    // CORRECTION CRITIQUE : Ne PAS recalculer scratch_reduction
    // Le order.total_ttc contient DÉJÀ le montant final après toutes réductions
    // scratch_reduction est stocké uniquement pour AFFICHAGE sur le ticket
    const orderScratchDiscount = order.scratch_reduction || 0;
    
    // Extraire le type de réduction depuis les notes (si disponible)
    let scratchLabel = 'Cadeau Scratch';
    if (order.notes && order.notes.includes('🎫 Cadeau scratch:')) {
        const match = order.notes.match(/🎫 Cadeau scratch: -(\d+(?:\.\d+)?)(€|%)/);
        if (match) {
            scratchLabel = `Cadeau Scratch -${match[1]}${match[2]}`;
        }
    }
    
    // Utiliser le total_ttc de la commande tel quel (déjà calculé avec toutes réductions)
    totalHT = order.total_ht || 0;
    totalTVA = order.total_tva || 0;
    totalTTC = order.total_ttc || 0;
    
    // Recalculer tvaBreakdown basé sur le total final
    if (totalTTC > 0 && totalBeforeDiscounts > 0) {
        const ratio = totalTTC / totalBeforeDiscounts;
        Object.keys(tvaBreakdown).forEach(rate => {
            tvaBreakdown[rate].ht *= ratio;
            tvaBreakdown[rate].tva *= ratio;
            tvaBreakdown[rate].ttc *= ratio;
        });
    }

    // HTML du ticket
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {
                size: 80mm auto;
                margin: 0;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, 'Helvetica Neue', sans-serif;
                font-size: 14px;
                line-height: 1.5;
                width: 80mm;
                padding: 6mm;
                background: white;
                color: #000;
            }
            .logo-container {
                text-align: center;
                margin-bottom: 10px;
            }
            .logo {
                max-width: 60mm;
                max-height: 30mm;
                height: auto;
                width: auto;
            }
            .center {
                text-align: center;
            }
            .bold {
                font-weight: bold;
            }
            .large {
                font-size: 18px;
                font-weight: bold;
            }
            .xlarge {
                font-size: 22px;
                font-weight: bold;
            }
            .separator {
                border-top: 1px dashed #000;
                margin: 8px 0;
            }
            .double-separator {
                border-top: 2px solid #000;
                margin: 8px 0;
            }
            .row {
                display: flex;
                justify-content: space-between;
                margin: 4px 0;
                line-height: 1.6;
            }
            .article {
                margin: 6px 0;
            }
            .indent {
                padding-left: 12px;
                font-size: 12px;
                color: #333;
                margin: 2px 0;
            }
            .totals {
                margin-top: 10px;
            }
            .order-type-badge {
                display: inline-block;
                border: 3px solid #000;
                padding: 8px 20px;
                margin: 10px 0;
                font-weight: bold;
                font-size: 16px;
                letter-spacing: 1px;
            }
            .customer-info {
                background: #f5f5f5;
                padding: 8px;
                margin: 10px 0;
                border: 2px solid #ddd;
                font-size: 13px;
                line-height: 1.6;
            }
            .customer-info .bold {
                font-size: 14px;
                margin-bottom: 4px;
            }
            .payment-info {
                background: #fffacd;
                padding: 8px;
                margin: 10px 0;
                border: 2px solid #ffd700;
                font-size: 14px;
                font-weight: bold;
            }
            .header-info {
                font-size: 13px;
                margin: 2px 0;
            }
            .total-final {
                font-size: 20px;
                font-weight: bold;
                padding: 6px 0;
            }
            @media print {
                body {
                    padding: 3mm;
                }
            }
        </style>
    </head>
    <body>
    `;

    // Logo si disponible
    if (profile.logo_url) {
        html += `
        <div class="logo-container">
            <img src="${profile.logo_url}" alt="${ticketHeaderName || 'Logo'}" class="logo" />
        </div>
        `;
    }

    html += `
        <div class="center xlarge" style="margin-bottom: 8px;">
            ${ticketHeaderName}
        </div>
        ${showEstablishmentSubtitle ? `
        <div class="center header-info" style="font-weight: 700; margin-top: -4px; margin-bottom: 6px;">
            ${establishmentName}
        </div>
        ` : ''}
        <div class="center header-info">
            ${profile.adresse || ''}
        </div>
        <div class="center header-info">
            Tél: ${profile.telephone || ''}
        </div>
        ${profile.siret ? `<div class="center header-info">SIRET: ${profile.siret}</div>` : ''}
        ${profile.tva_intracommunautaire ? `<div class="center header-info">TVA: ${profile.tva_intracommunautaire}</div>` : ''}
        
        <div class="separator"></div>
        
        <div class="center large" style="margin: 10px 0;">
            Commande #${order.from_kiosk ? 'B' : ''}${order.numero_commande || order.numero_caisse || ''}
        </div>
        
        <div class="center">
            <div class="order-type-badge">${orderTypeLabel}</div>
        </div>
        
        <div class="center" style="font-size: 15px; font-weight: bold; margin: 8px 0;">
            ${dateStr}
        </div>
        ${order.type_commande === 'sur_place' && tableLabel ? `
        <div class="center" style="font-size: 18px; font-weight: bold; margin: 8px 0; padding: 6px 12px; border: 2px solid #000; display: inline-block;">
            TABLE ${tableLabel}
        </div>
        ` : ''}
        ${((order.type_commande === 'sur_place' || order.type_commande === 'emporter') && beeperLabel) ? `
        <div class="center" style="font-size: 18px; font-weight: bold; margin: 8px 0; padding: 6px 12px; border: 2px solid #1d4ed8; color: #1d4ed8; display: inline-block;">
            BIPPEUR ${beeperLabel}
        </div>
        ` : ''}
        ${order.customer_name ? `
        <div class="center" style="font-size: 18px; font-weight: bold; margin: 8px 0; padding: 6px 12px; border: 2px solid #000; display: inline-block;">
            👤 ${order.customer_name}
        </div>
        ` : ''}
    `;

    // Informations client pour toutes les commandes avec client
    if (customer && (order.type_commande === 'emporter' || order.type_commande === 'sur_place')) {
        html += `
        <div class="separator"></div>
        <div class="customer-info">
            <div class="bold">CLIENT :</div>
            <div><strong>${customer.prenom || ''} ${customer.nom || ''}</strong></div>
            ${customer.telephone ? `<div>📞 ${customer.telephone}</div>` : ''}
        </div>
        `;
    }

    // Informations client pour les livraisons
    if (order.type_commande === 'livraison' && customer) {
        // Priorité : delivery_address (sauvegardée en BDD), sinon selectedAdresse (mémoire), sinon adresse principale
        const deliveryAddr = order.delivery_address || customer.selectedAdresse || '';
        let adresseAffichee = customer.adresse || '';
        let cpAffiche = customer.code_postal || '';
        let villeAffichee = customer.ville || '';
        let etageAffiche = customer.etage || '';
        let interphoneAffiche = customer.interphone || '';

        if (deliveryAddr) {
            // Chercher les détails (étage, interphone) dans les adresses sauvegardées
            const allAddrs = [
                customer.adresse ? { adresse: customer.adresse, ville: customer.ville, code_postal: customer.code_postal, etage: customer.etage, interphone: customer.interphone } : null,
                ...(customer.adresses || [])
            ].filter(Boolean);
            const matched = allAddrs.find(a => a.adresse && deliveryAddr.includes(a.adresse));
            if (matched) {
                adresseAffichee = matched.adresse || '';
                cpAffiche = matched.code_postal || '';
                villeAffichee = matched.ville || '';
                etageAffiche = matched.etage || '';
                interphoneAffiche = matched.interphone || '';
            } else {
                adresseAffichee = deliveryAddr;
                cpAffiche = '';
                villeAffichee = '';
            }
        }

        html += `
        <div class="separator"></div>
        <div class="customer-info">
            <div class="bold">CLIENT :</div>
            <div><strong>${customer.prenom || ''} ${customer.nom || ''}</strong></div>
            ${customer.telephone ? `<div>📞 ${customer.telephone}</div>` : ''}
            ${adresseAffichee ? `<div>📍 ${adresseAffichee}</div>` : ''}
            ${cpAffiche || villeAffichee ? `<div>&nbsp;&nbsp;&nbsp;&nbsp;${cpAffiche} ${villeAffichee}</div>` : ''}
            ${etageAffiche ? `<div>🏢 Étage: ${etageAffiche}</div>` : ''}
            ${interphoneAffiche ? `<div>🔔 Interphone: ${interphoneAffiche}</div>` : ''}
        </div>
        `;
    }

    // Mode de paiement prévu pour les commandes non payées
    if (!order.payee && order.mode_paiement_prevu) {
        const paymentMethodLabels = {
            'especes': 'ESPÈCES',
            'carte_bancaire': 'CARTE BANCAIRE',
            'ticket_restaurant': 'TICKET RESTAURANT',
            'cheque': 'CHÈQUE'
        };
        const paymentLabel = paymentMethodLabels[order.mode_paiement_prevu] || order.mode_paiement_prevu.toUpperCase();
        
        html += `
        <div class="payment-info center">
            ⚠️ NON PAYÉ<br>
            Paiement prévu: ${paymentLabel}
        </div>
        `;
    }

    html += `
        <div class="double-separator"></div>
        
        <div class="row bold" style="font-size: 15px;">
            <span>Qte</span>
            <span>Article</span>
            <span>Prix</span>
        </div>
        
        <div class="separator"></div>
    `;
    
    // Liste des articles
    articles.forEach(article => {
        const isDiscount = article.product_id?.startsWith('discount-') || 
                          article.product_id?.startsWith('loyalty-') || 
                          article.product_id?.startsWith('promo-') ||
                          article.product_id?.startsWith('offer-');
        
        if (isDiscount) {
            // Les remises sont affichées après les articles (voir bloc séparé ci-dessous)
            return;
        } else {
            // Article normal
            const prixUnitaire = article.prix_unitaire || 0;
            const quantite = article.quantite || 1;
            const totalLigne = prixUnitaire * quantite;

            html += `
            <div class="article">
                <div class="row bold" style="font-size: 15px;">
                    <span>${quantite}x</span>
                    <span>${article.nom_produit}</span>
                    <span>${totalLigne.toFixed(2)}€</span>
                </div>
            `;

            // Afficher les options/suppléments
            if (article.options && article.options.length > 0) {
                article.options.forEach(option => {
                    html += `
                    <div class="indent">
                        + ${option.nom}${option.price_surcharge > 0 ? ` <strong>(+${option.price_surcharge.toFixed(2)}€)</strong>` : ''}
                    </div>
                    `;
                });
            }

            // Afficher les exclusions
            if (article.exclusions && article.exclusions.length > 0) {
                article.exclusions.forEach(exclusion => {
                    html += `
                    <div class="indent">
                        - Sans ${exclusion.nom}
                    </div>
                    `;
                });
            }

            // Afficher les notes
            if (article.notes) {
                html += `
                <div class="indent" style="font-style: italic;">
                    📝 ${article.notes}
                </div>
                `;
            }

            // Afficher les détails du menu si applicable
            if (article.isMenu && article.menuDetails && article.menuDetails.length > 0) {
                article.menuDetails.forEach(detail => {
                    html += `
                    <div class="indent">
                        • ${detail.product?.nom || 'Produit'}${detail.selectedSize ? ` (${detail.selectedSize})` : ''}
                    </div>
                    `;
                    
                    if (detail.selectedOptions && detail.selectedOptions.length > 0) {
                        detail.selectedOptions.forEach(opt => {
                            html += `
                            <div class="indent" style="padding-left: 24px;">
                                + ${opt.nom}${opt.price_surcharge > 0 ? ` <strong>(+${opt.price_surcharge.toFixed(2)}€)</strong>` : ''}
                            </div>
                            `;
                        });
                    }
                    
                    if (detail.excludedIngredients && detail.excludedIngredients.length > 0) {
                        detail.excludedIngredients.forEach(ing => {
                            html += `
                            <div class="indent" style="padding-left: 24px;">
                                - Sans ${ing.nom}
                            </div>
                            `;
                        });
                    }
                });
            }

            html += `</div>`;
        }
    });

    // Afficher les remises (offres) APRÈS les articles, séparées par une ligne
    const discountArticles = articles.filter(a =>
        a.product_id?.startsWith('discount-') ||
        a.product_id?.startsWith('loyalty-') ||
        a.product_id?.startsWith('promo-')
    );

    if (discountArticles.length > 0) {
        html += `<div class="separator"></div>`;
        discountArticles.forEach(article => {
            html += `
            <div class="article">
                <div class="row" style="color: #16a34a; font-style: italic; font-size: 13px;">
                    <span style="font-size:11px;">&#9654;</span>
                    <span>${article.nom_produit}</span>
                    <span>${(article.prix_unitaire || 0).toFixed(2)}€</span>
                </div>
            </div>
            `;
        });
    }

    // Afficher la cagnotte utilisée
    if (order.cagnotte_spent > 0) {
        html += `
        <div class="separator"></div>
        <div class="article">
            <div class="row" style="color: #d97706; font-weight: bold; font-size: 14px;">
                <span></span>
                <span>🎁 Cagnotte utilisée</span>
                <span>-${order.cagnotte_spent.toFixed(2)}€</span>
            </div>
        </div>
        `;
    }

    // Afficher la réduction scratch APRÈS les articles (si présente dans order.scratch_reduction)
    if (orderScratchDiscount > 0) {
        html += `
        <div class="separator"></div>
        <div class="article">
            <div class="row" style="color: #ec4899; font-weight: bold; font-size: 14px;">
                <span></span>
                <span>🎫 ${scratchLabel}</span>
                <span>-${orderScratchDiscount.toFixed(2)}€</span>
            </div>
        </div>
        `;
    }

    // Motif d'annulation
    if (order.statut === 'annulee') {
        html += `
        <div class="separator"></div>
        <div class="article" style="border: 2px dashed red; padding: 8px; margin: 8px 0; text-align: center;">
            <div style="color: red; font-weight: bold; font-size: 16px;">⛔ COMMANDE ANNULÉE</div>
            ${order.motif_annulation ? `<div style="color: red; font-size: 13px; margin-top: 4px;">Motif: ${order.motif_annulation}</div>` : ''}
        </div>
        `;
    }

    // Notes sur la commande (filtrer les infos système scratch/promo/cagnotte)
    if (order.notes) {
        const customerNote = order.notes
            .split('|')
            .map(s => s.trim())
            .filter(s => !s.startsWith('🎫') && !s.startsWith('Code promo') && !s.startsWith('Cagnotte'))
            .join(' | ')
            .trim();
        if (customerNote) {
            html += `
        <div class="separator"></div>
        <div class="article">
            <div class="bold" style="font-size: 14px;">📋 Note :</div>
            <div class="indent" style="font-style: italic;">${customerNote}</div>
        </div>
        `;
        }
    }

    html += `
        <div class="double-separator"></div>
        
        <div class="totals">
    `;

    // Détails TVA
    Object.keys(tvaBreakdown).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(rate => {
        const data = tvaBreakdown[rate];
        html += `
            <div class="row" style="font-size: 13px;">
                <span>Total H.T. ${parseFloat(rate).toFixed(1)}%</span>
                <span>${data.ht.toFixed(2)}€</span>
            </div>
        `;
    });

    Object.keys(tvaBreakdown).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(rate => {
        const data = tvaBreakdown[rate];
        html += `
            <div class="row" style="font-size: 13px;">
                <span>dont T.V.A. ${parseFloat(rate).toFixed(1)}%</span>
                <span>${data.tva.toFixed(2)}€</span>
            </div>
        `;
    });

    html += `
            <div class="double-separator"></div>
            
            <div class="row total-final">
                <span>TOTAL T.T.C.</span>
                <span>${totalTTC.toFixed(2)}€</span>
            </div>
        </div>
    `;

    // Modes de paiement si payé
    if (order.payee && (order.mode_paiement && order.mode_paiement.length > 0 || order.cagnotte_spent && order.cagnotte_spent > 0)) {
        const explicitCashChange = Array.isArray(order.mode_paiement)
            ? (order.mode_paiement || []).reduce((sum, payment) => sum + (Number(payment?.monnaie_a_rendre) || 0), 0)
            : 0;
        const inferredCashChange = Array.isArray(order.mode_paiement)
            ? Math.max(
                0,
                (order.mode_paiement || []).reduce((sum, payment) => sum + (Number(payment?.montant) || 0), 0)
                + (Number(order.cagnotte_spent) || 0)
                - (Number(totalTTC) || 0)
            )
            : 0;
        const cashChangeToShow = explicitCashChange > 0 ? explicitCashChange : inferredCashChange;
        html += `
        <div class="separator"></div>
        <div class="bold" style="font-size: 15px; margin-bottom: 6px;">PAIEMENT :</div>
        `;
        
        // Afficher le montant payé par cagnotte si applicable
        if (order.cagnotte_spent && order.cagnotte_spent > 0) {
            html += `
            <div class="row" style="font-size: 14px;">
                <span>🎁 Cagnotte</span>
                <span><strong>${order.cagnotte_spent.toFixed(2)}€</strong></span>
            </div>
            `;
        }
        
        const paymentMethodLabels = {
            'especes': '💵 Espèces',
            'carte_bancaire': '💳 Carte Bancaire',
            'ticket_restaurant': '🎫 Ticket Restaurant',
            'cheque': '📝 Chèque'
        };
        
        if (order.mode_paiement && order.mode_paiement.length > 0) {
            order.mode_paiement.forEach(payment => {
                const label = paymentMethodLabels[payment.methode] || payment.methode;
                html += `
                <div class="row" style="font-size: 14px;">
                    <span>${label}</span>
                    <span><strong>${(payment.montant || 0).toFixed(2)}&euro;</strong></span>
                </div>
                `;
            });
        }

        if (cashChangeToShow > 0.01) {
            html += `
            <div class="row" style="font-size: 14px;">
                <span>Monnaie rendue</span>
                <span><strong>${cashChangeToShow.toFixed(2)}&euro;</strong></span>
            </div>
            `;
        }
    }

    // Générer QR code pour la commande (livraison uniquement)
    let qrCodeHtml = '';
    if (order.type_commande === 'livraison' && order.numero_caisse) {
        try {
            const qrUrl = `${window.location.origin}/DeliveryAppPublic?order=${order.numero_caisse}`;
            const qrDataUrl = await QRCode.toDataURL(qrUrl, {
                width: 150,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' }
            });
            qrCodeHtml = `
            <div class="separator"></div>
            <div class="center" style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">📦 QR Code Livreur</div>
            <div class="center" style="margin: 6px 0;">
                <img src="${qrDataUrl}" style="width: 40mm; height: 40mm;" />
            </div>
            `;
        } catch (err) {
            console.warn('Erreur génération QR commande:', err);
        }
    }

    html += `
        ${qrCodeHtml}
        <div class="separator"></div>
        
        <div class="center" style="margin-top: 12px; font-size: 16px; font-style: italic; font-weight: bold;">
            Merci de votre visite !
        </div>
        
        ${profile.horaires ? `
        <div class="center" style="margin-top: 8px; font-size: 11px; line-height: 1.4;">
            ${Object.entries(profile.horaires).map(([jour, horaire]) => 
                horaire ? `${jour}: ${horaire}` : ''
            ).filter(Boolean).join('<br>')}
        </div>
        ` : ''}
    </body>
    </html>
    `;

    return html;
}

export function generateKioskClientReceiptHtml(order, profile) {
    if (!order || !profile) {
        console.error('[generateKioskClientReceiptHtml] Donnees manquantes:', { order, profile });
        return null;
    }

    const orderDate = toParisDateValue(order.created_date);
    const dateStr = orderDate && !Number.isNaN(orderDate.getTime())
        ? orderDate.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Date invalide';

    const paymentStatus = order.payee ? 'COMMANDE REGLEE' : 'COMMANDE A REGLER A LA CAISSE';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: 80mm auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: Arial, 'Helvetica Neue', sans-serif;
                font-size: 14px;
                line-height: 1.5;
                width: 80mm;
                padding: 6mm;
                background: white;
                color: #000;
            }
            .center { text-align: center; }
            .separator { border-top: 1px dashed #000; margin: 10px 0; }
            .double-separator { border-top: 2px solid #000; margin: 10px 0; }
            .xlarge { font-size: 28px; font-weight: 900; }
            .large { font-size: 18px; font-weight: bold; }
            .muted { font-size: 12px; color: #444; }
        </style>
    </head>
    <body>
        ${profile.logo_url ? `
        <div class="center" style="margin-bottom: 10px;">
            <img src="${profile.logo_url}" alt="Logo" style="max-width: 60mm; max-height: 28mm; width: auto; height: auto;" />
        </div>` : ''}

        <div class="center large">${profile.nom_etablissement || 'Restaurant'}</div>
        <div class="center muted">${dateStr}</div>

        <div class="double-separator"></div>

        <div class="center muted" style="margin-bottom: 8px;">Votre numero de commande</div>
        <div class="center xlarge">B${order.numero_caisse || order.numero_commande || ''}</div>

        <div class="separator"></div>

        <div class="center large">${paymentStatus}</div>

        <div class="separator"></div>

        <div class="center muted">Conservez ce ticket pour le suivi de votre commande.</div>
        <div class="center muted" style="margin-top: 6px;">Pour un ticket detaille, adressez-vous a la caisse.</div>
    </body>
    </html>
    `;
}

/**
 * Génère un ticket avec le QR code de la borne à imprimer
 */
export async function generateKioskQRTicketHtml(profile, kioskUrl) {
    if (!profile || !kioskUrl) return null;

    // Générer le QR code en base64
    const qrDataUrl = await QRCode.toDataURL(kioskUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: 80mm auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: Arial, 'Helvetica Neue', sans-serif;
                font-size: 14px;
                line-height: 1.5;
                width: 80mm;
                padding: 6mm;
                background: white;
                color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 8px 0; }
            .double-separator { border-top: 2px solid #000; margin: 8px 0; }
            .logo { max-width: 60mm; max-height: 30mm; height: auto; width: auto; }
            .header-info { font-size: 13px; margin: 2px 0; }
            .xlarge { font-size: 22px; font-weight: bold; }
        </style>
    </head>
    <body>
        ${profile.logo_url ? `
        <div class="center" style="margin-bottom: 10px;">
            <img src="${profile.logo_url}" alt="Logo" class="logo" />
        </div>` : ''}

        <div class="center xlarge" style="margin-bottom: 6px;">${profile.nom_etablissement || 'Restaurant'}</div>
        <div class="center header-info">${profile.adresse || ''}</div>
        <div class="center header-info">Tél: ${profile.telephone || ''}</div>
        ${profile.siret ? `<div class="center header-info">SIRET: ${profile.siret}</div>` : ''}

        <div class="double-separator"></div>

        <div class="center bold" style="font-size: 16px; margin: 10px 0;">
            🏪 Commandez depuis votre smartphone !
        </div>
        <div class="center" style="font-size: 13px; color: #444; margin-bottom: 12px;">
            Scannez le QR code ci-dessous<br>pour accéder à notre borne en ligne
        </div>

        <div class="center" style="margin: 10px 0;">
            <img src="${qrDataUrl}" style="width: 55mm; height: 55mm;" />
        </div>

        <div class="separator"></div>

        <div class="center" style="font-size: 10px; color: #666; margin: 6px 0; word-break: break-all;">
            ${kioskUrl}
        </div>

        <div class="double-separator"></div>

        <div class="center bold" style="font-size: 15px; margin-top: 8px; font-style: italic;">
            Merci de votre visite ! 🙏
        </div>
    </body>
    </html>
    `;
}

/**
 * Génère un ticket avec le QR code de l'app livreur à imprimer
 */
export async function generateDeliveryQRTicketHtml(profile, deliveryUrl) {
    if (!deliveryUrl) return null;

    const qrDataUrl = await QRCode.toDataURL(deliveryUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: 80mm auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: Arial, 'Helvetica Neue', sans-serif;
                font-size: 14px;
                line-height: 1.5;
                width: 80mm;
                padding: 6mm;
                background: white;
                color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 8px 0; }
            .double-separator { border-top: 2px solid #000; margin: 8px 0; }
            .logo { max-width: 60mm; max-height: 30mm; height: auto; width: auto; }
            .header-info { font-size: 13px; margin: 2px 0; }
            .xlarge { font-size: 22px; font-weight: bold; }
        </style>
    </head>
    <body>
        ${profile?.logo_url ? `
        <div class="center" style="margin-bottom: 10px;">
            <img src="${profile.logo_url}" alt="Logo" class="logo" />
        </div>` : ''}

        <div class="center xlarge" style="margin-bottom: 6px;">${profile?.nom_etablissement || 'Restaurant'}</div>
        ${profile?.adresse ? `<div class="center header-info">${profile.adresse}</div>` : ''}
        ${profile?.telephone ? `<div class="center header-info">Tél: ${profile.telephone}</div>` : ''}

        <div class="double-separator"></div>

        <div class="center bold" style="font-size: 16px; margin: 10px 0;">
            🚚 Application Livreur
        </div>
        <div class="center" style="font-size: 13px; color: #444; margin-bottom: 12px;">
            Scannez le QR code ci-dessous<br>pour accéder à l'application livreur
        </div>

        <div class="center" style="margin: 10px 0;">
            <img src="${qrDataUrl}" style="width: 55mm; height: 55mm;" />
        </div>

        <div class="separator"></div>

        <div class="center" style="font-size: 10px; color: #666; margin: 6px 0; word-break: break-all;">
            ${deliveryUrl}
        </div>

        <div class="double-separator"></div>

        <div class="center bold" style="font-size: 15px; margin-top: 8px; font-style: italic;">
            Merci de votre confiance ! 🙏
        </div>
    </body>
    </html>
    `;
}

/**
 * Déclenche l'impression d'un ticket
 */
function waitForPrintableImages(container, onReady) {
    const images = container.getElementsByTagName('img');
    let imagesLoaded = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
        setTimeout(onReady, 300);
        return;
    }

    let safetyTimeoutId;

    const checkImagesLoaded = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            clearTimeout(safetyTimeoutId);
            setTimeout(onReady, 300);
        }
    };

    safetyTimeoutId = setTimeout(() => {
        console.warn('[triggerPrint] Timeout: impression sans attendre toutes les images');
        onReady();
    }, 3000);

    Array.from(images).forEach((img) => {
        img.onload = null;
        img.onerror = null;

        if (img.complete) {
            checkImagesLoaded();
        } else {
            img.onload = checkImagesLoaded;
            img.onerror = () => {
                console.warn('[triggerPrint] Erreur chargement image:', img.src);
                checkImagesLoaded();
            };
        }
    });
}

function extractPrintBody(html) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
}

function extractPrintStyles(html) {
    const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
    return styleMatches.map((match) => match[1]).join('\n');
}

function notifyPrintComplete(onComplete, status) {
    if (onComplete) {
        onComplete(status);
    }
    return status;
}

function triggerWindowPrint(html, printWindow, onComplete) {
    if (!printWindow || printWindow.closed) {
        triggerCurrentWindowPrint(html, onComplete);
        return;
    }

    let isCleanedUp = false;
    let fallbackTimeoutId;
    let printTriggered = false;

    const cleanupAndComplete = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearTimeout(fallbackTimeoutId);
        try {
            printWindow.close();
        } catch (closeError) {
            console.warn('[triggerPrint] Impossible de fermer la fenetre d\'impression:', closeError);
        }
        notifyPrintComplete(onComplete, {
            ok: printTriggered,
            triggered: printTriggered,
            strategy: 'new-window',
            reason: printTriggered ? 'print-dispatched' : 'print-not-dispatched',
        });
    };

    try {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        waitForPrintableImages(printWindow.document, () => {
            fallbackTimeoutId = setTimeout(cleanupAndComplete, 2500);
            try {
                printWindow.focus();
                printWindow.print();
                printTriggered = true;
                console.log('[triggerPrint] Impression declenchee avec succes (new-window)');
                console.log('[PRINT_TRIGGER_SUCCESS]', {
                    strategy: 'new-window',
                });
            } catch (printError) {
                console.error('[triggerPrint] Impression bloquee via fenetre dediee:', printError);
                console.error('[PRINT_TRIGGER_BLOCKED]', {
                    strategy: 'new-window',
                    reason: 'new-window-print-error',
                    error: printError,
                });
            }
            if (!printTriggered) {
                cleanupAndComplete();
            }
        });
    } catch (error) {
        console.error('[triggerPrint] Erreur lors de l\'impression via fenetre dediee:', error);
        cleanupAndComplete();
    }
}

function triggerCurrentWindowPrint(html, onComplete, options = {}) {
    const printHost = document.createElement('div');
    printHost.setAttribute('data-print-host-root', 'true');

    const isolationStyle = document.createElement('style');
    isolationStyle.setAttribute('data-print-host-style', 'true');
    isolationStyle.textContent = `
        @media screen {
            [data-print-host-root="true"] {
                position: fixed !important;
                inset: 0 !important;
                z-index: 2147483647 !important;
                overflow: auto !important;
                background: #ffffff !important;
            }
        }

        @media print {
            body > *:not([data-print-host-root="true"]):not([data-print-host-style="true"]) {
                display: none !important;
            }

            [data-print-host-root="true"] {
                position: static !important;
                inset: auto !important;
                overflow: visible !important;
                background: #ffffff !important;
            }
        }
    `;

    const embeddedStyles = extractPrintStyles(html);
    printHost.innerHTML = `
        ${embeddedStyles ? `<style>${embeddedStyles}</style>` : ''}
        ${extractPrintBody(html)}
    `;

    document.body.appendChild(isolationStyle);
    document.body.appendChild(printHost);

    let isCleanedUp = false;
    let fallbackTimeoutId;
    let focusCleanupTimeoutId;
    let printTriggered = false;

    const handleAfterPrint = () => {
        setTimeout(cleanupAndComplete, 300);
    };

    const handleWindowFocus = () => {
        focusCleanupTimeoutId = setTimeout(cleanupAndComplete, 500);
    };

    const cleanupAndComplete = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        window.removeEventListener('afterprint', handleAfterPrint);
        window.removeEventListener('focus', handleWindowFocus);
        clearTimeout(fallbackTimeoutId);
        clearTimeout(focusCleanupTimeoutId);
        if (document.body.contains(printHost)) {
            document.body.removeChild(printHost);
        }
        if (document.body.contains(isolationStyle)) {
            document.body.removeChild(isolationStyle);
        }
        notifyPrintComplete(onComplete, {
            ok: printTriggered,
            triggered: printTriggered,
            strategy: 'current-window',
            reason: printTriggered ? 'print-dispatched' : 'print-not-dispatched',
        });
    };

    window.addEventListener('afterprint', handleAfterPrint);
    window.addEventListener('focus', handleWindowFocus);

    const runPrint = () => {
        fallbackTimeoutId = setTimeout(cleanupAndComplete, 60000);
        try {
            window.focus();
            window.print();
            printTriggered = true;
            console.log('[triggerPrint] Impression declenchee avec succes (current-window)');
            console.log('[PRINT_TRIGGER_SUCCESS]', {
                strategy: 'current-window',
            });
        } catch (printError) {
            console.error('[triggerPrint] Impression bloquee dans la fenetre courante:', printError);
            console.error('[PRINT_TRIGGER_BLOCKED]', {
                strategy: 'current-window',
                reason: 'current-window-print-error',
                error: printError,
            });
            cleanupAndComplete();
        }
    };

    if (options.immediate) {
        runPrint();
        return;
    }

    waitForPrintableImages(printHost, runPrint);
}

export async function triggerPrint(html, onComplete, options = {}) {
    if (!html) {
        console.error('[triggerPrint] Contenu HTML manquant');
        console.error('[PRINT_TRIGGER_BLOCKED]', {
            strategy: options.strategy || 'iframe',
            reason: 'missing-html',
        });
        return notifyPrintComplete(onComplete, {
            ok: false,
            triggered: false,
            strategy: options.strategy || 'iframe',
            reason: 'missing-html',
        });
    }

    return await new Promise((resolve) => {
        console.log('[PRINT_TRIGGER_CALLED]', {
            strategy: options.strategy || 'iframe',
        });
        const complete = (status) => {
            resolve(notifyPrintComplete(onComplete, status));
        };

    if (options.strategy === 'new-window') {
            triggerWindowPrint(html, options.printWindow, complete);
            return;
    }

    if (options.strategy === 'current-window') {
            triggerCurrentWindowPrint(html, complete, options);
            return;
    }

        try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.visibility = 'hidden';

            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            let printTriggered = false;

            const cleanupAndComplete = (status) => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                complete(status);
            };

            const tryPrint = () => {
                try {
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    printTriggered = true;
                    console.log('[triggerPrint] Impression declenchee avec succes');
                    console.log('[PRINT_TRIGGER_SUCCESS]', {
                        strategy: 'iframe',
                    });
                } else {
                    console.warn('[triggerPrint] Iframe ou contentWindow non disponible pour l\'impression.');
                    console.warn('[PRINT_TRIGGER_BLOCKED]', {
                        strategy: 'iframe',
                        reason: 'missing-content-window',
                    });
                }
            } catch (printError) {
                console.error('[triggerPrint] Impression bloquee dans l\'iframe:', printError);
                console.error('[PRINT_TRIGGER_BLOCKED]', {
                    strategy: 'iframe',
                    reason: 'iframe-print-error',
                    error: printError,
                });
            } finally {
                setTimeout(() => cleanupAndComplete({
                    ok: printTriggered,
                        triggered: printTriggered,
                        strategy: 'iframe',
                        reason: printTriggered ? 'print-dispatched' : 'print-not-dispatched',
                    }), 1000);
                }
            };

            waitForPrintableImages(doc, tryPrint);

        } catch (error) {
            console.error('[triggerPrint] Erreur lors de la creation de l\'iframe:', error);
            complete({
                ok: false,
                triggered: false,
                strategy: 'iframe',
                reason: 'iframe-creation-failed',
                error,
            });
        }
    });
}




