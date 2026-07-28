export const eInvoicingServiceContract = {
  providerIndependence: true,
  operations: [
    'createInvoiceTransmission',
    'createCreditNoteTransmission',
    'getTransmissionStatus',
    'retryTransmission',
    'listTransmissionEvents',
  ],
  providerExamples: ['Pennylane', 'PDP', 'custom-accounting-provider'],
  rule: 'Le POS ne depend jamais directement du fournisseur d e-facturation.',
};

export const eInvoicingService = {
  getContract() {
    return eInvoicingServiceContract;
  },
};
