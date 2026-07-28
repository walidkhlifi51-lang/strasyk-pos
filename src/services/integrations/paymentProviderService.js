export const paymentProviderServiceContract = {
  supportedFutureProviders: ['Stripe', 'myPOS', 'Worldline', 'Adyen'],
  operations: [
    'initializeTerminalPayment',
    'captureTerminalPayment',
    'cancelTerminalPayment',
    'refundPayment',
    'getProviderHealth',
  ],
};

export const paymentProviderService = {
  getContract() {
    return paymentProviderServiceContract;
  },
};
