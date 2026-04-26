import {
  PLATFORM_ISSUER_SNAPSHOT,
  buildResellerIssuerSnapshot,
  buildResellerRecipientSnapshot,
  buildTenantRecipientSnapshot,
} from '@/lib/invoiceSnapshots';

export const createInvoiceForm = () => ({
  montant: '',
  type: 'abonnement',
  description: '',
  date_facturation: new Date().toISOString().split('T')[0],
  tva_taux: 20,
  is_devis: false,
  materiel: '',
});

export const computeInvoiceAmounts = (montantInput, tvaInput) => {
  const montantHT = Number(montantInput || 0);
  const tauxTVA = Number(tvaInput || 0);
  const montantTVA = montantHT * (tauxTVA / 100);
  const montantTTC = montantHT + montantTVA;

  return {
    montantHT,
    tauxTVA,
    montantTVA,
    montantTTC,
  };
};

const buildInvoiceCore = (form = {}) => {
  const {
    montantHT,
    tauxTVA,
    montantTVA,
    montantTTC,
  } = computeInvoiceAmounts(form.montant, form.tva_taux);

  const payload = {
    numero_facture: `FAC-${Date.now()}`,
    montant: Number(montantTTC.toFixed(2)),
    tva_taux: tauxTVA,
    type: form.type || 'autre',
    description: (form.description || '').trim() || null,
    date_facturation: form.date_facturation || new Date().toISOString().split('T')[0],
    statut: 'en_attente',
    is_devis: Boolean(form.is_devis),
    metadata: {
      amount_ht: Number(montantHT.toFixed(2)),
      amount_tva: Number(montantTVA.toFixed(2)),
      amount_ttc: Number(montantTTC.toFixed(2)),
    },
  };

  if ((form.materiel || '').trim()) {
    payload.materiel = form.materiel.trim();
  }

  return payload;
};

export const buildPlatformToResellerInvoicePayload = ({ form, reseller }) => ({
  ...buildInvoiceCore(form),
  reseller_id: reseller?.id || null,
  issuer_type: 'platform',
  issuer_id: null,
  recipient_type: 'reseller',
  recipient_id: reseller?.id || null,
  issuer_snapshot: PLATFORM_ISSUER_SNAPSHOT,
  recipient_snapshot: buildResellerRecipientSnapshot(reseller),
});

export const buildResellerToTenantInvoicePayload = ({ form, reseller, branding, tenant }) => ({
  ...buildInvoiceCore(form),
  tenant_id: tenant?.id || null,
  reseller_id: reseller?.id || null,
  issuer_type: 'reseller',
  issuer_id: reseller?.id || null,
  recipient_type: 'tenant',
  recipient_id: tenant?.id || null,
  issuer_snapshot: buildResellerIssuerSnapshot({ reseller, branding }),
  recipient_snapshot: buildTenantRecipientSnapshot(tenant),
});

export const isInvoiceForReseller = (invoice, resellerId) => {
  if (!invoice || !resellerId) return false;

  if (invoice.recipient_type === 'reseller' && invoice.recipient_id === resellerId) {
    return true;
  }

  return invoice.reseller_id === resellerId && invoice.recipient_type === 'reseller';
};

export const isInvoiceForTenant = (invoice, tenantId) => {
  if (!invoice || !tenantId) return false;

  if (invoice.recipient_type === 'tenant' && invoice.recipient_id === tenantId) {
    return true;
  }

  return invoice.tenant_id === tenantId;
};

export const sortInvoicesByDateDesc = (invoices = []) => [...invoices].sort(
  (left, right) => new Date(right.date_facturation || right.created_date || 0) - new Date(left.date_facturation || left.created_date || 0),
);
