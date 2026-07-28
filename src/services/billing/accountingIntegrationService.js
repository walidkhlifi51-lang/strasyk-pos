export const accountingIntegrationServiceContract = {
  operations: [
    'exportSalesJournal',
    'exportInvoiceJournal',
    'exportPayments',
    'pushInvoice',
    'getProviderStatus',
  ],
  rule: 'Le coeur POS appelle une interface comptable generique, jamais un fournisseur directement.',
};

export const accountingIntegrationService = {
  getContract() {
    return accountingIntegrationServiceContract;
  },
};
