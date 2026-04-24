import { useMemo } from 'react';

/**
 * Hook pour calculer les totaux d'une commande
 */
export function useOrderCalculations(currentOrder) {
  return useMemo(() => {
    if (!currentOrder) {
      return {
        subTotalTTC: 0,
        offerDiscountTotal: 0,
        totalAfterOffers: 0,
        loyaltyDiscountAmount: 0,
        totalAfterLoyalty: 0,
        promoDiscountValue: 0,
        scratchReduction: 0,
        totalForPayment: 0,
        totalForDisplay: 0,
      };
    }

    // Étape 1: Sous-total des articles
    const subTotalTTC = Array.isArray(currentOrder.articles) 
      ? currentOrder.articles.reduce((sum, item) => sum + (item.prix_final_unitaire * item.quantite), 0) 
      : 0;

    // Étape 2: Réductions d'offres
    const offerDiscountTotal = (Array.isArray(currentOrder.discounts) ? currentOrder.discounts : [])
      .reduce((sum, d) => sum + d.amount, 0);
    const totalAfterOffers = subTotalTTC + offerDiscountTotal;

    // Étape 3: Réduction fidélité
    let loyaltyDiscountAmount = 0;
    let totalBeforeLoyalty = totalAfterOffers;

    if (currentOrder.loyaltyDiscount?.rule) {
      if (currentOrder.loyaltyDiscount.rule.type_recompense === 'percentage_discount') {
        loyaltyDiscountAmount = totalBeforeLoyalty * (currentOrder.loyaltyDiscount.rule.valeur_recompense / 100);
        loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
      } else if (currentOrder.loyaltyDiscount.rule.type_recompense === 'fixed_discount') {
        loyaltyDiscountAmount = currentOrder.loyaltyDiscount.rule.valeur_recompense;
        loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
      }
    }

    const totalAfterLoyalty = totalBeforeLoyalty - loyaltyDiscountAmount;

    // Étape 4: Code promo
    let promoDiscountValue = 0;
    if (currentOrder.promoCode) {
      if (currentOrder.promoCode.type === 'percentage') {
        promoDiscountValue = totalAfterLoyalty * (currentOrder.promoCode.value / 100);
      } else {
        promoDiscountValue = currentOrder.promoCode.value;
      }
      promoDiscountValue = Math.min(promoDiscountValue, totalAfterLoyalty);
    }

    // Étape 5: Réduction scratch
    const scratchReduction = currentOrder.scratch_reduction || currentOrder.editingInfo?.scratch_reduction || 0;

    // Total final pour paiement
    const totalForPayment = Math.max(0, totalAfterLoyalty - promoDiscountValue - scratchReduction);

    return {
      subTotalTTC,
      offerDiscountTotal,
      totalAfterOffers,
      loyaltyDiscountAmount,
      totalAfterLoyalty,
      promoDiscountValue,
      scratchReduction,
      totalForPayment,
      totalForDisplay: totalForPayment,
    };
  }, [currentOrder]);
}
