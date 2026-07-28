export const deliveryIntegrationServiceContract = {
  externalSystem: 'STRASYK Delivery API',
  assumptions: [
    'Aucune hypothese sur les tables internes',
    'Aucune hypothese sur les routes definitives',
    'Aucune hypothese sur l authentification finale',
    'Aucune hypothese sur les statuts definitifs',
  ],
  requiredOperations: [
    'createDeliveryMission',
    'getDeliveryMission',
    'cancelDeliveryMission',
    'getDeliveryStatus',
    'retryDeliverySync',
  ],
};

export const deliveryIntegrationService = {
  getContract() {
    return deliveryIntegrationServiceContract;
  },
};
