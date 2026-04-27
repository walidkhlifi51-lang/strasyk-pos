import {
  PLATFORM_ISSUER_SNAPSHOT,
  buildResellerIssuerSnapshot,
  buildResellerRecipientSnapshot,
  buildTenantRecipientSnapshot,
} from '@/lib/invoiceSnapshots';

export const createInvoiceForm = () => ({
  montant: '',
  type: '',
  description: '',
  date_facturation: new Date().toISOString().split('T')[0],
  tva_taux: 20,
  periode_debut: new Date().toISOString().split('T')[0],
  duree_mois: 12,
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

export const isRecurringInvoiceType = (type) => type === 'abonnement' || type === 'frais_de_maintenance';

export const computeInvoiceStatusFromMonthlyPayments = (monthlyPayments = {}) => {
  const payments = Object.values(monthlyPayments || {});
  if (!payments.length) return 'en_attente';
  return payments.every((payment) => payment?.paye) ? 'payee' : 'en_attente';
};

export const getInvoiceAmounts = (invoice = {}) => {
  const metadata = invoice.metadata || {};
  const montantTTC = Number(metadata.amount_ttc ?? invoice.montant ?? 0);
  const montantHT = Number(
    metadata.amount_ht
    ?? (invoice.tva_taux ? montantTTC / (1 + Number(invoice.tva_taux || 0) / 100) : montantTTC),
  );
  const montantTVA = Number(metadata.amount_tva ?? (montantTTC - montantHT));

  return {
    amountHT: montantHT,
    amountTVA: montantTVA,
    amountTTC: montantTTC,
    monthlyAmountHT: Number(metadata.monthly_amount_ht ?? montantHT),
    monthlyAmountTVA: Number(metadata.monthly_amount_tva ?? montantTVA),
    monthlyAmountTTC: Number(metadata.monthly_amount_ttc ?? montantTTC),
  };
};

const buildInvoiceCore = (form = {}) => {
  const {
    montantHT,
    tauxTVA,
    montantTVA,
    montantTTC,
  } = computeInvoiceAmounts(form.montant, form.tva_taux);
  const duree = Number(form.duree_mois || 12);
  const recurring = isRecurringInvoiceType(form.type) && form.periode_debut;
  const totalHT = recurring ? montantHT * duree : montantHT;
  const totalTVA = recurring ? montantTVA * duree : montantTVA;
  const totalTTC = recurring ? montantTTC * duree : montantTTC;

  const payload = {
    numero_facture: `FAC-${Date.now()}`,
    montant: Number(totalTTC.toFixed(2)),
    tva_taux: tauxTVA,
    type: form.type || 'autre',
    description: (form.description || '').trim() || null,
    date_facturation: form.date_facturation || new Date().toISOString().split('T')[0],
    statut: 'en_attente',
    is_devis: Boolean(form.is_devis),
    metadata: {
      amount_ht: Number(totalHT.toFixed(2)),
      amount_tva: Number(totalTVA.toFixed(2)),
      amount_ttc: Number(totalTTC.toFixed(2)),
      monthly_amount_ht: Number(montantHT.toFixed(2)),
      monthly_amount_tva: Number(montantTVA.toFixed(2)),
      monthly_amount_ttc: Number(montantTTC.toFixed(2)),
    },
  };

  if ((form.materiel || '').trim()) {
    payload.materiel = form.materiel.trim();
  }

  if (recurring) {
    const debut = new Date(form.periode_debut);
    const monthlyPayments = {};

    for (let i = 0; i < duree; i += 1) {
      const monthDate = new Date(debut);
      monthDate.setMonth(debut.getMonth() + i);
      const monthKey = monthDate.toISOString().split('T')[0];
      monthlyPayments[monthKey] = {
        montant: Number(montantTTC.toFixed(2)),
        paye: false,
        date_paiement: null,
      };
    }

    const fin = new Date(debut);
    fin.setMonth(debut.getMonth() + duree);
    payload.periode_debut = form.periode_debut;
    payload.periode_fin = fin.toISOString().split('T')[0];
    payload.monthly_payments = monthlyPayments;
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
