/**
 * Calcule le total final d'une commande en appliquant toutes les réductions
 */
export function calculateOrderTotal(currentOrder) {
  if (!currentOrder) return 0;

  const articles = Array.isArray(currentOrder.articles) ? currentOrder.articles : [];
  const discounts = Array.isArray(currentOrder.discounts) ? currentOrder.discounts : [];
  
  // Sous-total des articles
  const subTotalTTC = articles.reduce((sum, item) => sum + (item.prix_final_unitaire * item.quantite), 0);
  
  console.log('🧮 [calculateOrderTotal] Détails calcul:', {
    subTotalTTC,
    discounts: discounts.length,
    loyaltyDiscount: currentOrder.loyaltyDiscount?.name,
    promoCode: currentOrder.promoCode?.code,
    scratch_reduction: currentOrder.scratch_reduction,
    editingInfo_scratch: currentOrder.editingInfo?.scratch_reduction
  });
  
  // Réductions d'offres
  const offerDiscountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  const totalAfterOffers = subTotalTTC + offerDiscountTotal;
  
  // Réduction fidélité
  let loyaltyDiscountAmount = 0;
  if (currentOrder.loyaltyDiscount?.rule) {
    const totalBeforeLoyalty = totalAfterOffers;
    if (currentOrder.loyaltyDiscount.rule.type_recompense === 'percentage_discount') {
      loyaltyDiscountAmount = totalBeforeLoyalty * (currentOrder.loyaltyDiscount.rule.valeur_recompense / 100);
      loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
    } else if (currentOrder.loyaltyDiscount.rule.type_recompense === 'fixed_discount') {
      loyaltyDiscountAmount = currentOrder.loyaltyDiscount.rule.valeur_recompense;
      loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
    }
  }
  
  const totalAfterLoyalty = totalAfterOffers - loyaltyDiscountAmount;
  
  // Code promo
  let promoDiscountValue = 0;
  if (currentOrder.promoCode) {
    if (currentOrder.promoCode.type === 'percentage') {
      promoDiscountValue = totalAfterLoyalty * (currentOrder.promoCode.value / 100);
    } else {
      promoDiscountValue = currentOrder.promoCode.value;
    }
    promoDiscountValue = Math.min(promoDiscountValue, totalAfterLoyalty);
  }
  
  // Réduction scratch
  const scratchReduction = currentOrder.scratch_reduction || currentOrder.editingInfo?.scratch_reduction || 0;
  
  // Total final
  return Math.max(0, totalAfterLoyalty - promoDiscountValue - scratchReduction);
}
