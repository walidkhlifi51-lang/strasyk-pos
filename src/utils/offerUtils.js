export function calculateOfferDiscounts(cartItems, offers, orderType, products = []) {
  if (!cartItems?.length || !offers?.length) return [];

  const discounts = [];

  let availableItems = cartItems.flatMap((item, cartIndex) => {
    if (!item || !item.product_id || item.isMenu) return [];
    const product = products.find(p => p.id === item.product_id);
    // Priorité : category_id stocké sur l'article, sinon lookup dans le catalogue
    const categoryId = item.category_id || product?.category_id || null;
    const qty = Number(item.quantite) || 1;
    const unitPrice = Number(item.prix_unitaire) || Number(item.prix_final_unitaire) || (Number(item.total_ligne) / qty) || 0;

    let size = item.selectedSize || item.size || null;
    if (!size && item.nom_produit) {
      const sizeMatch = item.nom_produit.match(/\(([^)]+)\)$/);
      if (sizeMatch) size = sizeMatch[1];
    }

    return Array(qty).fill(null).map((_, qi) => ({
      uid: `${cartIndex}-${qi}`,
      productId: item.product_id,
      categoryId,
      size,
      price: unitPrice,
    }));
  });

  for (const offer of offers) {
    if (!offer?.active) continue;
    const offerModes = offer.modes_commande || ['sur_place', 'emporter', 'livraison'];
    if (!offerModes.includes(orderType)) continue;

    while (true) {
      const conditionCandidates = availableItems.filter(item => {
        if (!item.productId) return false;
        let match = false;
        if (offer.type_condition === 'product') {
          match = (offer.condition_ids || []).includes(item.productId);
        } else if (offer.type_condition === 'category') {
          match = !!(item.categoryId && (offer.condition_ids || []).includes(item.categoryId));
        }
        if (!match) return false;
        // Vérification de taille : seulement si l'article a une taille (produits sans taille ignorent ce filtre)
        if (offer.condition_sizes?.length > 0 && item.size && !offer.condition_sizes.includes(item.size)) return false;
        if (offer.condition_excluded_product_ids?.length > 0 && offer.condition_excluded_product_ids.includes(item.productId)) return false;
        return true;
      });

      if (conditionCandidates.length < offer.quantite_requise) break;

      conditionCandidates.sort((a, b) => b.price - a.price);
      const consumedConditionUIDs = conditionCandidates.slice(0, offer.quantite_requise).map(i => i.uid);

      const matchesReward = (item) => {
        if (!item.productId) return false;
        let match = false;
        if (offer.type_recompense === 'product') {
          match = (offer.recompense_ids || []).includes(item.productId);
        } else if (offer.type_recompense === 'category') {
          match = !!(item.categoryId && (offer.recompense_ids || []).includes(item.categoryId));
        }
        if (!match) return false;
        // Vérification de taille : seulement si l'article a une taille (produits sans taille ignorent ce filtre)
        if (offer.recompense_sizes?.length > 0 && item.size && !offer.recompense_sizes.includes(item.size)) return false;
        if (offer.recompense_excluded_product_ids?.length > 0 && offer.recompense_excluded_product_ids.includes(item.productId)) return false;
        return true;
      };

      // Chercher hors des articles de condition d'abord
      let rewardCandidates = availableItems.filter(item => !consumedConditionUIDs.includes(item.uid) && matchesReward(item));

      // Sinon piocher dans les articles de condition (ex: 2 achetés = 1 offert parmi les 2)
      // MAIS seulement si le total disponible (condition + récompense) dépasse la quantité requise + offerte
      if (rewardCandidates.length < offer.quantite_offerte) {
        const extended = availableItems.filter(matchesReward);
        const totalNeeded = offer.quantite_requise + offer.quantite_offerte;
        if (extended.length >= totalNeeded) {
          rewardCandidates = extended.filter(item => !consumedConditionUIDs.includes(item.uid));
        }
      }

      if (rewardCandidates.length < offer.quantite_offerte) break;

      rewardCandidates.sort((a, b) => a.price - b.price);
      const consumedReward = rewardCandidates.slice(0, offer.quantite_offerte);
      const discountAmount = consumedReward.reduce((sum, item) => sum + item.price, 0);

      const allConsumedUIDs = [...consumedConditionUIDs, ...consumedReward.map(i => i.uid)];
      availableItems = availableItems.filter(item => !allConsumedUIDs.includes(item.uid));

      const existing = discounts.find(d => d.id === offer.id);
      if (existing) {
        existing.amount -= discountAmount;
      } else {
        discounts.push({ id: offer.id, name: offer.nom, amount: -discountAmount });
      }
    }
  }

  return discounts;
}
