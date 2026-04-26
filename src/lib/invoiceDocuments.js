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

const buildInvoiceCore = (form = {}) => {
  const payload = {
    numero_facture: `FAC-${Date.now()}`,
    montant: Number(form.montant || 0),
    tva_taux: Number(form.tva_taux || 0),
    type: form.type || 'autre',
    description: (form.description || '').trim() || null,
    date_facturation: form.date_facturation || new Date().toISOString().split('T')[0],
    statut: 'en_attente',
    is_devis: Boolean(form.is_devis),
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
