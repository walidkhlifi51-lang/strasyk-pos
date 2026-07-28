export const loyaltyServiceContract = {
  operations: [
    'computeEarnedLoyalty',
    'applyLoyaltyRedemption',
    'creditWallet',
    'debitWallet',
    'listLoyaltyEvents',
  ],
  rule: 'Les calculs de fidelite et de cagnotte devront etre transactionnels cote serveur.',
};

export const loyaltyService = {
  getContract() {
    return loyaltyServiceContract;
  },
};
