export const paymentServiceContract = {
  providerAgnostic: true,
  operations: [
    'createPaymentIntent',
    'capturePayment',
    'cancelPayment',
    'refundPayment',
    'getPaymentStatus',
  ],
  rule: 'Le POS manipule un contrat de paiement, jamais un SDK fournisseur directement.',
};

export const paymentService = {
  getContract() {
    return paymentServiceContract;
  },
};
