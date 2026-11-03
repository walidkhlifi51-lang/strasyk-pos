// Shared projections match the deployed schema; no writes or permission logic.
export const RESELLER_COMMISSION_FIELDS = [
  'id', 'reseller_id', 'tenant_id', 'source_type', 'source_reference',
  'period_start', 'period_end', 'base_amount', 'commission_amount',
  'status', 'notes', 'created_date', 'updated_date',
];
export const RESELLER_PAYOUT_FIELDS = [
  'id', 'reseller_id', 'period_start', 'period_end', 'total_amount',
  'status', 'paid_at', 'payment_reference', 'notes', 'created_date', 'updated_date',
];

export const RESELLER_RESOURCE_LABELS = {
  resellers: 'Revendeurs', resellerBranding: 'Marques', resellerTenants: 'Rattachements',
  resellerUsers: 'Membres', pricingRules: 'Offres', commissions: 'Commissions',
  payouts: 'Paiements revendeurs', tenants: 'Commerces', invoices: 'Factures',
  accessRequests: 'Demandes',
};

// Do not display raw SQL/HTTP errors, payloads or credential values.
export const resellerReadErrorCode = (error) => (
  typeof error?.code === 'string' && /^[A-Z0-9_]{3,32}$/.test(error.code)
    ? error.code : 'READ_UNAVAILABLE'
);

export const loadResellerPlatform = async (readers) => {
  if (typeof readers?.resellers !== 'function') throw new Error('RESELLER_READER_REQUIRED');
  const entries = Object.entries(readers);
  const results = await Promise.allSettled(entries.map(([, read]) => Promise.resolve().then(read)));
  const data = { loadErrors: [] };
  entries.forEach(([resource], index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      data[resource] = result.value;
      return;
    }
    const code = resellerReadErrorCode(result.status === 'rejected' ? result.reason : { code: 'INVALID_RESPONSE' });
    if (resource === 'resellers') {
      const error = new Error('RESELLER_LIST_UNAVAILABLE');
      error.code = code;
      throw error;
    }
    data[resource] = [];
    data.loadErrors.push({ resource, code });
  });
  return data;
};
