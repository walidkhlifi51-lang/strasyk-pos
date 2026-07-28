export const strasykApiV1Contracts = {
  version: 'v1',
  stabilityRule: 'Les contrats v1 restent stables pour les integrations existantes.',
  evolutionRule: 'Toute evolution incompatible devra utiliser /api/v2/.',
  openApiConvention: {
    pathPrefix: '/api/v1',
    contentType: 'application/json',
    idempotencyHeader: 'Idempotency-Key',
    tenantHeader: 'X-Strasyk-Tenant',
  },
  futureEndpoints: [
    '/orders',
    '/orders/{orderId}/cancel',
    '/orders/{orderId}/settle',
    '/customers/{customerId}/loyalty',
    '/deliveries/{missionId}',
    '/invoices',
    '/credit-notes',
  ],
};
