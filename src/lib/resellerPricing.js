export const RESELLER_PRODUCT_CATALOG = [
  { offer_code: 'abonnement', label: 'Abonnement', billing_type: 'monthly' },
  { offer_code: 'achat_complet', label: 'Vente complete', billing_type: 'one_shot' },
  { offer_code: 'materiel', label: 'Materiel', billing_type: 'one_shot' },
  { offer_code: 'module_supplementaire', label: 'Module supplementaire', billing_type: 'one_shot' },
  { offer_code: 'frais_de_maintenance', label: 'Maintenance', billing_type: 'monthly' },
  { offer_code: 'autre', label: 'Autre', billing_type: 'one_shot' },
];

export const getResellerProductConfig = (offerCode) => (
  RESELLER_PRODUCT_CATALOG.find((item) => item.offer_code === offerCode) || null
);

export const getResellerProductLabel = (offerCode) => (
  getResellerProductConfig(offerCode)?.label || offerCode || 'Produit'
);

export const createPricingRuleDraft = (resellerId = null, offerCode = 'autre') => ({
  reseller_id: resellerId,
  offer_code: offerCode,
  billing_type: getResellerProductConfig(offerCode)?.billing_type || 'one_shot',
  cost_price: 0,
  reseller_price: 0,
  public_price: 0,
  commission_type: 'fixed',
  commission_value: 0,
  active: false,
});

export const buildPricingRuleMap = (rules = []) => (
  rules.reduce((accumulator, rule) => {
    if (rule?.offer_code) {
      accumulator[rule.offer_code] = rule;
    }
    return accumulator;
  }, {})
);

export const getEffectiveResellerChargeHT = ({ rule, saleAmountHT }) => {
  if (!rule?.active) return 0;

  if (rule.commission_type === 'percentage') {
    return Number(((Number(saleAmountHT || 0) * Number(rule.commission_value || 0)) / 100).toFixed(2));
  }

  if (rule.commission_type === 'margin') {
    const publicPrice = Number(rule.public_price || 0);
    const costPrice = Number(rule.cost_price || 0);
    return Number(Math.max(publicPrice - costPrice, 0).toFixed(2));
  }

  return Number(rule.reseller_price || 0);
};

export const getResellerPricingSummary = (rule) => {
  if (!rule?.active) {
    return 'Aucun tarif automatique actif.';
  }

  if (rule.commission_type === 'percentage') {
    return `${Number(rule.commission_value || 0).toFixed(2)}% du montant HT de vente`;
  }

  if (rule.commission_type === 'margin') {
    return `Marge calculee sur prix public ${Number(rule.public_price || 0).toFixed(2)} EUR HT`;
  }

  return `${Number(rule.reseller_price || 0).toFixed(2)} EUR HT`;
};
