export const getOrderCollectedAmount = (order) => {
  if (!order) return 0;

  const paymentTotal = Array.isArray(order.mode_paiement)
    ? order.mode_paiement.reduce((sum, payment) => {
        const amount = Number(payment?.montant) || 0;
        const change = Number(payment?.monnaie_a_rendre) || 0;
        return sum + Math.max(0, amount - change);
      }, 0)
    : 0;

  const cagnotteSpent = Number(order.cagnotte_spent) || 0;
  return Number((paymentTotal + cagnotteSpent).toFixed(2));
};

export const getOrderOutstandingAmount = (order) => {
  const total = Number(order?.total_ttc) || 0;
  const outstanding = total - getOrderCollectedAmount(order);
  return Number(Math.max(0, outstanding).toFixed(2));
};

export const hasOutstandingBalance = (order) => getOrderOutstandingAmount(order) > 0.01;
