
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from "date-fns";

/**
 * Retourne uniquement les commandes valides qui doivent être comptabilisées dans le chiffre d'affaires.
 * Exclut uniquement les commandes qui ont été explicitement annulées.
 * @param {Array} orders - La liste de toutes les commandes.
 * @returns {Array} - La liste des commandes valides.
 */
export const getValidOrders = (orders) => {
  if (!Array.isArray(orders)) return [];
  // On exclut uniquement les commandes annulées. Une commande "en attente" ou "en attente de paiement"
  // est considérée comme une vente pour les statistiques de chiffre d'affaires.
  const excludedStatus = ['annulee'];
  return orders.filter(order => !excludedStatus.includes(order.statut));
};

/**
 * Retourne les commandes valides pour une plage de dates donnée.
 * @param {Array} orders - La liste de toutes les commandes.
 * @param {String} dateRange - "today", "week", ou "month".
 * @returns {Array} - La liste des commandes valides et filtrées par date.
 */
export const filterValidOrdersByDateRange = (orders, dateRange) => {
  const validOrders = getValidOrders(orders);
  const now = new Date();
  let start, end;

  switch (dateRange) {
    case "week":
      start = startOfDay(subDays(now, 7));
      end = endOfDay(now);
      break;
    case "month":
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case "today":
    default:
      start = startOfDay(now);
      end = endOfDay(now);
      break;
  }

  return validOrders.filter(order => {
    if (!order.created_date) return false;
    const orderDate = new Date(order.created_date);
    return orderDate >= start && orderDate <= end;
  });
};

