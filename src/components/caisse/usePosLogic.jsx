import { useCallback } from 'react';
import { appClient } from '@/api/appClient';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { computeTaxSummaryFromArticles } from '@/components/utils/taxUtils';

const REMOTE_CASHIER_FIELDS = ['id', 'tenant_id', 'user_email', 'is_remote_cashier'];
const ORDER_NUMBER_FIELDS = ['id', 'numero_caisse', 'created_date'];

export function usePosLogic({ 
  currentOrder, 
  setCurrentOrder, 
  currentTenant, 
  withTenant, 
  filterByTenant, 
  queryClient, 
  toast, 
  selectedCustomer, 
  setSelectedCustomer, 
  nextNumeroCaisse, 
  workingDate, 
  cagnotteRule, 
  isOnline, 
  addPendingOperation, 
  cacheData, 
  getCachedData, 
  currentUser, 
  profile,
  clearOrder
}) {

  const getParisDayStartIso = () => {
    const toParisDate = (date) => new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const start = toParisDate(new Date());
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  };

  const handleCreateOrUpdateOrder = useCallback(async (paymentInfo) => {
    let savedOrder;
    let isRemoteCashier = false;

    if (currentUser?.email) {
      try {
        const userAccesses = await appClient.entities.UserAccess.filter({
          ...filterByTenant(),
          user_email: currentUser.email
        }, undefined, 1, { fields: REMOTE_CASHIER_FIELDS });
        isRemoteCashier = userAccesses?.[0]?.is_remote_cashier || false;
      } catch (error) {
        console.log('⚠️ Impossible de vérifier le mode caissier distant:', error);
      }
    }

    let actualNextNumeroCaisse = nextNumeroCaisse;
    try {
      const toParisDate = (date) => new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const today = toParisDate(new Date());
      const dateStr = format(today, 'yyyy-MM-dd');
      
      const allOrdersToday = await appClient.entities.Order.filter(
        { ...filterByTenant(), created_date: { $gte: getParisDayStartIso() } },
        '-created_date',
        1000,
        { fields: ORDER_NUMBER_FIELDS }
      );
      const todayOrders = allOrdersToday.filter(order => {
        if (!order?.created_date) return false;
        const orderDateStr = order.created_date.replace(' ', 'T');
        let orderDate = new Date(orderDateStr.endsWith('Z') ? orderDateStr : orderDateStr + 'Z');
        orderDate = toParisDate(orderDate);
        return format(orderDate, 'yyyy-MM-dd') === dateStr;
      });
      
      const maxNumero = todayOrders.reduce((max, order) => Math.max(max, order.numero_caisse || 0), 0);
      actualNextNumeroCaisse = maxNumero + 1;
    } catch (error) {
      console.error('❌ Erreur récupération numéro:', error);
    }

    try {
      if (!currentOrder) throw new Error("Aucune commande en cours.");
      
      if (!isOnline) {
        const articles = Array.isArray(currentOrder.articles) ? currentOrder.articles : [];
        const discounts = Array.isArray(currentOrder.discounts) ? currentOrder.discounts : [];
        const { loyaltyDiscount, promoCode, orderType, table, notes, customer } = currentOrder;
        
        const subTotalTTC = articles.reduce((sum, item) => sum + (item.prix_final_unitaire * item.quantite), 0);
        const offerDiscountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
        
        const orderArticles = articles.map(item => ({
          product_id: item.isMenu ? null : item.product_id,
          menu_id: item.isMenu ? item.menu_id : null,
          nom_produit: item.nom_produit,
          quantite: item.quantite,
          prix_unitaire: item.prix_final_unitaire,
          total_ligne: item.prix_final_unitaire * item.quantite,
          tva: item.tva_rate,
          options: Array.isArray(item.selected_options) ? item.selected_options : [],
          exclusions: Array.isArray(item.excluded_ingredients) ? item.excluded_ingredients : [],
          notes: item.notes || null,
          isMenu: item.isMenu,
          menuDetails: item.menuDetails || null,
          size: item.size || null,
        }));
        
        const localCounterKey = `offlineCounter_${currentTenant?.id}_${format(workingDate, 'yyyy-MM-dd')}`;
        let offlineCounter = parseInt(localStorage.getItem(localCounterKey) || nextNumeroCaisse);
        const offlineNumeroCaisse = offlineCounter;
        const formattedDate = format(workingDate, 'ddMMyy', { locale: fr });
        const offlineNumeroCommande = `${offlineNumeroCaisse}-${formattedDate}`;
        
        localStorage.setItem(localCounterKey, (offlineCounter + 1).toString());
        
        const offlineTaxSummary = computeTaxSummaryFromArticles(orderArticles, paymentInfo.totalAmount);

        const offlineOrder = {
          id: `offline-${Date.now()}`,
          numero_caisse: offlineNumeroCaisse,
          numero_commande: offlineNumeroCommande,
          type_commande: orderType || 'sur_place',
          customer_id: customer?.id || null,
          table_id: orderType === 'sur_place' && table ? table.id : null,
          articles: orderArticles,
          total_ht: offlineTaxSummary.totalHt,
          total_tva: offlineTaxSummary.totalTva,
          total_ttc: paymentInfo.totalAmount,
          payee: paymentInfo.payee,
          mode_paiement: paymentInfo.mode_paiement || [],
          numero_bipeur: paymentInfo.numero_bipeur || null,
          statut: paymentInfo.payee ? 'prete' : 'en_attente_paiement',
          notes: notes || '',
          created_date: new Date().toISOString(),
          offline: true
        };
        
        const cachedOfflineOrders = getCachedData('offlineOrders') || [];
        cachedOfflineOrders.push(offlineOrder);
        cacheData('offlineOrders', cachedOfflineOrders);
        
        queryClient.setQueryData(['posData', currentTenant?.id, format(workingDate, 'yyyy-MM-dd', { locale: fr })], (old) => {
          if (!old) return old;
          return { ...old, allOrders: [...old.allOrders, offlineOrder] };
        });
        
        addPendingOperation({
          type: 'create',
          entity: 'Order',
          data: withTenant(offlineOrder)
        });
        
        toast({
          title: "💾 Commande sauvegardée hors ligne",
          description: "Elle sera synchronisée dès la reconnexion.",
          variant: "warning",
          duration: 5000
        });
        
        return offlineOrder;
      }
      
      let finalTotalTTC;

      if (currentOrder.editingInfo?.payee && Array.isArray(currentOrder.articles) && currentOrder.articles.some(item => item.product_id === 'frais_livraison_conversion')) {
        const feeItem = currentOrder.articles.find(item => item.product_id === 'frais_livraison_conversion');
        const feeAmount = feeItem.prix_final_unitaire;
        finalTotalTTC = feeAmount;

        const newFeeArticle = {
          product_id: feeItem.product_id,
          nom_produit: feeItem.nom_produit,
          quantite: 1,
          prix_unitaire: feeAmount,
          total_ligne: feeAmount,
          tva: feeItem.tva_rate
        };
        
        const editingInfo = currentOrder.editingInfo;

        const updatedPayload = withTenant({
          ...editingInfo,
          type_commande: 'livraison',
          total_ttc: (editingInfo.total_ttc || 0) + feeAmount,
          total_ht: (editingInfo.total_ht || 0) + (feeAmount / (1 + (feeItem.tva_rate / 100))),
          total_tva: (editingInfo.total_tva || 0) + (feeAmount - (feeAmount / (1 + (feeItem.tva_rate / 100)))),
          articles: [...(editingInfo.articles || []), newFeeArticle],
          mode_paiement: [...(Array.isArray(editingInfo.mode_paiement) ? editingInfo.mode_paiement : []), ...paymentInfo.mode_paiement],
          numero_bipeur: paymentInfo.numero_bipeur || editingInfo.numero_bipeur || null,
          notes: `${editingInfo.notes ? editingInfo.notes + '\n' : ''} (Convertie en livraison - supplément payé)`
        });
        
        await appClient.entities.Order.update(editingInfo.id, updatedPayload);
        savedOrder = { ...editingInfo, ...updatedPayload };
        savedOrder.articles = [...(editingInfo.articles || []), newFeeArticle];
        
      } else {
        const articles = Array.isArray(currentOrder.articles) ? currentOrder.articles : [];
        const discounts = Array.isArray(currentOrder.discounts) ? currentOrder.discounts : [];
        const { loyaltyDiscount, promoCode, orderType, table, notes, customer } = currentOrder;
        
        const finalOrderType = orderType || 'sur_place';
        const finalCustomer = customer || selectedCustomer;
        const customerId = finalCustomer?.id || null;
        
        const subTotalTTC = articles.reduce((sum, item) => sum + (item.prix_final_unitaire * item.quantite), 0);
        const offerDiscountTotal = discounts.reduce((sum, d) => sum + d.amount, 0); 
        const totalAfterOffers = subTotalTTC + offerDiscountTotal;
        
        let totalBeforeLoyalty = totalAfterOffers;
        let loyaltyDiscountAmount = 0;

        if (loyaltyDiscount && loyaltyDiscount.rule) {
          if (loyaltyDiscount.rule.type_recompense === 'percentage_discount') {
            loyaltyDiscountAmount = totalBeforeLoyalty * (loyaltyDiscount.rule.valeur_recompense / 100);
            loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
          } else if (loyaltyDiscount.rule.type_recompense === 'fixed_discount') {
            loyaltyDiscountAmount = loyaltyDiscount.rule.valeur_recompense;
            loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
          }
        }
        
        let totalAfterLoyalty = totalBeforeLoyalty - loyaltyDiscountAmount;
        let promoDiscountValue = 0;
        if (promoCode) {
          if (promoCode.type === 'percentage') {
            promoDiscountValue = totalAfterLoyalty * (promoCode.value / 100);
          } else {
            promoDiscountValue = promoCode.value;
          }
          promoDiscountValue = Math.min(promoDiscountValue, totalAfterLoyalty);
        }

        const scratchReductionInOrder = currentOrder.scratch_reduction || currentOrder.editingInfo?.scratch_reduction || 0;
        finalTotalTTC = Math.max(0, totalAfterLoyalty - promoDiscountValue - scratchReductionInOrder);

        const orderArticles = articles.map(item => {
          const normalizedOptions = Array.isArray(item.selected_options) ? item.selected_options : [];
          const normalizedExclusions = Array.isArray(item.excluded_ingredients) ? item.excluded_ingredients : [];
          
          return {
            product_id: item.isMenu ? null : item.product_id,
            menu_id: item.isMenu ? item.menu_id : null,
            nom_produit: item.nom_produit,
            quantite: item.quantite,
            prix_unitaire: item.prix_final_unitaire,
            total_ligne: item.prix_final_unitaire * item.quantite,
            tva: item.tva_rate,
            options: normalizedOptions.map(opt => ({ 
              id: opt.id, 
              nom: opt.nom, 
              price_surcharge: opt.price_surcharge 
            })),
            exclusions: normalizedExclusions.map(ing => ({ 
              id: ing.id, 
              nom: ing.nom 
            })),
            notes: item.notes || null,
            isMenu: item.isMenu,
            menuDetails: item.menuDetails || null,
            size: item.size || null,
          };
        });
        
        discounts.forEach(discount => {
          orderArticles.push({
            product_id: `discount-${discount.id}`,
            nom_produit: `Remise: ${discount.name}`,
            quantite: 1,
            prix_unitaire: discount.amount,
            total_ligne: discount.amount,
            tva: 0,
          });
        });

        if (loyaltyDiscount && loyaltyDiscountAmount > 0) {
          orderArticles.push({
            product_id: loyaltyDiscount.id,
            nom_produit: loyaltyDiscount.name,
            quantite: 1,
            prix_unitaire: -loyaltyDiscountAmount,
            total_ligne: -loyaltyDiscountAmount,
            tva: 0,
          });
        }

        if (promoCode && promoDiscountValue > 0) {
          orderArticles.push({
            product_id: `promo-${promoCode.id}`,
            nom_produit: `Code Promo: ${promoCode.code}`,
            quantite: 1,
            prix_unitaire: -promoDiscountValue,
            total_ligne: -promoDiscountValue,
            tva: 0,
          });
        }

        const taxSummary = computeTaxSummaryFromArticles(orderArticles, finalTotalTTC);

        let newStatus;
        if (paymentInfo.payee) {
          newStatus = 'payé';
        } else {
          newStatus = 'en_attente_paiement';
        }

        const numeroCaisse = currentOrder.editingInfo ? currentOrder.editingInfo.numero_caisse : actualNextNumeroCaisse;
        const formattedDate = format(workingDate, 'ddMMyy', { locale: fr });
        const numeroCommande = currentOrder.editingInfo ? currentOrder.editingInfo.numero_commande : `${actualNextNumeroCaisse}-${formattedDate}`;

        const orderPayload = withTenant({
          numero_commande: numeroCommande,
          type_commande: finalOrderType,
          customer_id: customerId,
          table_id: finalOrderType === 'sur_place' && table ? table.id : null,
          articles: orderArticles,
          total_ht: taxSummary.totalHt,
          total_tva: taxSummary.totalTva,
          total_ttc: finalTotalTTC,
          statut: newStatus,
          mode_paiement: paymentInfo.mode_paiement || [],
          mode_paiement_prevu: paymentInfo.plannedPaymentMethod || null,
          numero_bipeur: paymentInfo.numero_bipeur || null,
          payee: paymentInfo.payee,
          numero_caisse: numeroCaisse,
          notes: notes || '',
          cagnotte_spent: paymentInfo.cagnotte_spent || 0,
          scratch_reduction: scratchReductionInOrder,
          print_at_counter: isRemoteCashier && paymentInfo.payee ? true : false,
          from_kiosk: isRemoteCashier ? true : false,
        });

        if (currentOrder.editingInfo) {
          await appClient.entities.Order.update(currentOrder.editingInfo.id, orderPayload);
          savedOrder = { ...currentOrder.editingInfo, ...orderPayload };
        } else {
          savedOrder = await appClient.entities.Order.create(orderPayload);
        }
      }
      
      if (currentOrder.orderType === 'sur_place' && currentOrder.table && savedOrder) {
        if (!currentOrder.editingInfo || currentOrder.editingInfo.table_id !== currentOrder.table.id) {
          await appClient.entities.Table.update(currentOrder.table.id, withTenant({
            statut: 'occupee',
            order_id: savedOrder.id
          }));
          queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });

          if (currentOrder.editingInfo?.table_id && currentOrder.editingInfo.table_id !== currentOrder.table.id) {
            await appClient.entities.Table.update(currentOrder.editingInfo.table_id, withTenant({
              order_id: null,
              statut: 'disponible'
            }));
          }
        }
      }

      if (paymentInfo.payee && currentOrder.promoCode) {
        try {
          await appClient.entities.PromoCode.update(currentOrder.promoCode.id, withTenant({
            usage_count: (currentOrder.promoCode.usage_count || 0) + 1
          }));
        } catch (error) {
          console.error("Erreur lors de la mise à jour du code promo:", error);
        }
      }
      
      const finalCustomer = currentOrder.customer || selectedCustomer;
      if (finalCustomer && paymentInfo.payee) {
        const customerId = finalCustomer.id;
        let currentBalance = finalCustomer.cagnotte_balance || 0;

        if (paymentInfo.cagnotte_spent > 0) {
          const balanceBefore = currentBalance;
          currentBalance -= paymentInfo.cagnotte_spent;
          await appClient.entities.CagnotteHistory.create(withTenant({
            customer_id: customerId,
            order_id: savedOrder.id,
            type: 'spend',
            amount: -paymentInfo.cagnotte_spent,
            balance_before: balanceBefore,
            balance_after: currentBalance,
            created_date: new Date().toISOString()
          }));
        }

        if (cagnotteRule && cagnotteRule.accumulation_rate > 0) {
          const amountEarned = finalTotalTTC * (cagnotteRule.accumulation_rate / 100);
          if (amountEarned > 0.01) {
            const balanceBefore = currentBalance;
            currentBalance += amountEarned;
            await appClient.entities.CagnotteHistory.create(withTenant({
              customer_id: customerId,
              order_id: savedOrder.id,
              type: 'earn',
              amount: amountEarned,
              balance_before: balanceBefore,
              balance_after: currentBalance,
              created_date: new Date().toISOString()
            }));
          }
        }

        await appClient.entities.Customer.update(customerId, withTenant({ cagnotte_balance: currentBalance }));
        setSelectedCustomer({ ...finalCustomer, cagnotte_balance: currentBalance });
      }

      return savedOrder;

    } catch (error) {
      console.error("Erreur lors de la création/mise à jour de la commande:", error);
      toast({
        title: "Erreur",
        description: `Erreur: ${error.message}`,
        variant: "destructive"
      });
      return null;
    }
  }, [queryClient, currentOrder, toast, selectedCustomer, nextNumeroCaisse, cagnotteRule, withTenant, currentTenant]);

  return { handleCreateOrUpdateOrder };
}

