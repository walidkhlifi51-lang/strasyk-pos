import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Handshake,
  Store,
  Euro,
  CreditCard,
  Palette,
  Users,
  Plus,
  Copy,
  Loader2,
  ShieldCheck,
  Mail,
  FileText,
  Download,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { generateInvoicePDF } from '@/components/admin/InvoicePDFGenerator';
import {
  buildFinalInvoiceFromPaymentRequest,
  buildPaymentRequestMetadata,
  computeInvoiceStatusFromMonthlyPayments,
  computeInvoiceAmounts,
  createInvoiceForm,
  getInvoiceTypeLabel,
  getInvoiceAmounts,
  hasRecurringPayments,
  isFinalInvoice,
  isPaymentRequestInvoice,
  isInvoiceForReseller,
  isRecurringInvoiceType,
  isInvoiceForTenant,
  sortInvoicesByDateDesc,
} from '@/lib/invoiceDocuments';
import {
  buildTenantOwnerInviteMessage,
  createTenantAndResolve,
  normalizeEmail,
  resolveTenantByOwnerEmail,
} from '@/lib/tenantProvisioning';
import { buildResellerIssuerSnapshot, buildTenantRecipientSnapshot } from '@/lib/invoiceSnapshots';
import {
  RESELLER_PRODUCT_CATALOG,
  buildPricingRuleMap,
  getEffectiveResellerChargeHT,
  getResellerPricingSummary,
} from '@/lib/resellerPricing';

const currency = (value) => `${Number(value || 0).toFixed(2)} EUR`;
const RESELLER_STATS_COLORS = ['#2563eb', '#f97316', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4'];
const getInvoiceBrandingColor = (invoice) => invoice?.issuer_snapshot?.primary_color || '#f97316';
const getInvoiceIssuerName = (invoice) => invoice?.issuer_snapshot?.display_name || invoice?.issuer_snapshot?.legal_name || '';

const createInvoiceTotals = () => ({
  paid_ttc: 0,
  paid_ht: 0,
  paid_tva: 0,
  unpaid_ttc: 0,
  unpaid_ht: 0,
  unpaid_tva: 0,
});

const sumInvoiceBuckets = (invoices = []) => (
  invoices.reduce((accumulator, invoice) => {
    const amounts = getInvoiceAmounts(invoice);
    if (isFinalInvoice(invoice) && invoice.statut === 'payee') {
      accumulator.paid_ttc += amounts.amountTTC;
      accumulator.paid_ht += amounts.amountHT;
      accumulator.paid_tva += amounts.amountTVA;
    } else if (isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee') {
      accumulator.unpaid_ttc += amounts.amountTTC;
      accumulator.unpaid_ht += amounts.amountHT;
      accumulator.unpaid_tva += amounts.amountTVA;
    }
    return accumulator;
  }, createInvoiceTotals())
);

const createClientForm = () => ({
  nom_commercial: '',
  owner_email: '',
  telephone: '',
  adresse: '',
  subscription_plan: 'basic',
});

const withTimeout = async (promise, message, timeoutMs = 20000) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export default function ResellerPortal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentReseller, isReseller, resellerRole } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newClientForm, setNewClientForm] = React.useState(createClientForm());
  const [submitFeedback, setSubmitFeedback] = React.useState({ type: '', message: '' });
  const [selectedClientId, setSelectedClientId] = React.useState('');
  const [clientInvoiceForm, setClientInvoiceForm] = React.useState(createInvoiceForm());
  const allowedTabs = React.useMemo(() => new Set(['clients', 'stats', 'accounting', 'invoices', 'commissions', 'pricing', 'branding', 'team']), []);
  const requestedTab = React.useMemo(() => new URLSearchParams(location.search).get('tab') || 'clients', [location.search]);
  const [activeTab, setActiveTab] = React.useState(allowedTabs.has(requestedTab) ? requestedTab : 'clients');

  const canManageClients = ['owner', 'manager', 'sales'].includes(resellerRole);

  const { data, isLoading } = useQuery({
    queryKey: ['reseller-portal', currentReseller?.id],
    queryFn: async () => {
      const [
        resellerTenants,
        tenants,
        brandingList,
        commissions,
        payouts,
        resellerUsers,
        pricingRules,
        invoices,
      ] = await Promise.all([
        appClient.entities.ResellerTenant.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.Tenant.list('-created_date'),
        appClient.entities.ResellerBranding.filter({ reseller_id: currentReseller.id }, '-created_date', 5),
        appClient.entities.ResellerCommission.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerPayout.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerUser.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerPricingRule.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.TenantInvoice.list('-date_facturation').catch(() => []),
      ]);

      return {
        resellerTenants,
        tenants,
        branding: brandingList[0] || null,
        commissions,
        payouts,
        resellerUsers,
        pricingRules,
        invoices,
      };
    },
    enabled: !!currentReseller?.id && isReseller,
    staleTime: 30000,
  });

  const resellerTenants = data?.resellerTenants || [];
  const tenants = data?.tenants || [];
  const branding = data?.branding || null;
  const commissions = data?.commissions || [];
  const payouts = data?.payouts || [];
  const resellerUsers = data?.resellerUsers || [];
  const pricingRules = data?.pricingRules || [];
  const invoices = data?.invoices || [];
  const pricingRuleMap = buildPricingRuleMap(pricingRules);

  const linkedTenants = resellerTenants
    .map((assignment) => ({
      assignment,
      tenant: tenants.find((tenant) => tenant.id === assignment.tenant_id) || null,
    }))
    .filter((item) => item.tenant)
    .sort((a, b) => new Date(b.assignment.created_date || 0) - new Date(a.assignment.created_date || 0));

  const selectedClient = linkedTenants.find((item) => item.tenant.id === selectedClientId) || null;
  const selectedClientInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => isInvoiceForTenant(invoice, selectedClientId)),
  );
  const receivedResellerInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => isInvoiceForReseller(invoice, currentReseller?.id)),
  );
  const sentClientInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => invoice.issuer_type === 'reseller' && invoice.issuer_id === currentReseller?.id),
  );
  const receivedResellerUnpaidInvoices = receivedResellerInvoices.filter((invoice) => isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee');
  const receivedResellerPaidInvoices = receivedResellerInvoices.filter((invoice) => isFinalInvoice(invoice) && invoice.statut === 'payee');
  const clientInvoiceAmounts = computeInvoiceAmounts(clientInvoiceForm.montant, clientInvoiceForm.tva_taux);
  const activeSelectedPricingRule = pricingRuleMap[clientInvoiceForm.type];
  const resellerSalesTotals = React.useMemo(() => sumInvoiceBuckets(sentClientInvoices), [sentClientInvoices]);
  const platformChargesTotals = React.useMemo(() => sumInvoiceBuckets(receivedResellerInvoices), [receivedResellerInvoices]);
  const resellerNetTotals = React.useMemo(() => ({
    paid_ttc: resellerSalesTotals.paid_ttc - platformChargesTotals.paid_ttc,
    paid_ht: resellerSalesTotals.paid_ht - platformChargesTotals.paid_ht,
    unpaid_ttc: resellerSalesTotals.unpaid_ttc - platformChargesTotals.unpaid_ttc,
    unpaid_ht: resellerSalesTotals.unpaid_ht - platformChargesTotals.unpaid_ht,
  }), [platformChargesTotals, resellerSalesTotals]);
  const resellerSalesByClient = React.useMemo(() => {
    const byClient = sentClientInvoices.reduce((accumulator, invoice) => {
      const label = invoice.recipient_snapshot?.name || invoice.recipient_snapshot?.nom_commercial || 'Client';
      const amounts = getInvoiceAmounts(invoice);
      accumulator[label] = (accumulator[label] || 0) + amounts.amountTTC;
      return accumulator;
    }, {});

    return Object.entries(byClient)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [sentClientInvoices]);
  const resellerSalesByType = React.useMemo(() => {
    const byType = sentClientInvoices.reduce((accumulator, invoice) => {
      const type = getInvoiceTypeLabel(invoice.type);
      const amounts = getInvoiceAmounts(invoice);
      accumulator[type] = (accumulator[type] || 0) + amounts.amountTTC;
      return accumulator;
    }, {});

    return Object.entries(byType)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((left, right) => right.value - left.value);
  }, [sentClientInvoices]);
  const resellerFlowComparison = React.useMemo(() => ([
    {
      name: 'Ventes clients',
      paye: Number(resellerSalesTotals.paid_ttc.toFixed(2)),
      attente: Number(resellerSalesTotals.unpaid_ttc.toFixed(2)),
    },
    {
      name: 'Charges plateforme',
      paye: Number(platformChargesTotals.paid_ttc.toFixed(2)),
      attente: Number(platformChargesTotals.unpaid_ttc.toFixed(2)),
    },
    {
      name: 'Net revendeur',
      paye: Number(resellerNetTotals.paid_ttc.toFixed(2)),
      attente: Number(resellerNetTotals.unpaid_ttc.toFixed(2)),
    },
  ]), [platformChargesTotals, resellerNetTotals, resellerSalesTotals]);

  const pendingCommissions = commissions
    .filter((item) => item.status === 'pending')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const paidCommissions = commissions
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const createdByPortalCount = linkedTenants.filter((item) => item.assignment.acquisition_channel === 'reseller_portal').length;

  const cards = [
    { title: 'Commerces actifs', value: linkedTenants.filter((item) => item.assignment.status === 'active').length, icon: Store, accent: 'bg-blue-600' },
    { title: 'Crees par vous', value: createdByPortalCount, icon: Plus, accent: 'bg-orange-500' },
    { title: 'Commissions pending', value: currency(pendingCommissions), icon: Euro, accent: 'bg-amber-500' },
    { title: 'Commissions payees', value: currency(paidCommissions), icon: CreditCard, accent: 'bg-emerald-600' },
  ];

  React.useEffect(() => {
    setActiveTab(allowedTabs.has(requestedTab) ? requestedTab : 'clients');
  }, [allowedTabs, requestedTab]);

  React.useEffect(() => {
    if (!linkedTenants.length) {
      setSelectedClientId('');
      return;
    }

    if (!selectedClientId || !linkedTenants.some((item) => item.tenant.id === selectedClientId)) {
      setSelectedClientId(linkedTenants[0].tenant.id);
    }
  }, [linkedTenants, selectedClientId]);

  const upsertResellerTenantLink = React.useCallback(async ({ tenantId, subscriptionPlan }) => {
    const existingAssignment = resellerTenants.find((item) => item.tenant_id === tenantId && item.reseller_id === currentReseller.id);

    if (existingAssignment?.id) {
      await appClient.entities.ResellerTenant.update(existingAssignment.id, {
        status: 'active',
        acquisition_channel: existingAssignment.acquisition_channel || 'reseller_portal',
        subscription_plan: subscriptionPlan,
        started_at: existingAssignment.started_at || new Date().toISOString(),
      });
      return 'updated';
    }

    await appClient.entities.ResellerTenant.create({
      reseller_id: currentReseller.id,
      tenant_id: tenantId,
      acquisition_channel: 'reseller_portal',
      subscription_plan: subscriptionPlan,
      status: 'active',
      started_at: new Date().toISOString(),
    });

    return 'created';
  }, [currentReseller.id, resellerTenants]);

  const copyOwnerInvite = React.useCallback(async ({ tenantId, email, label }) => {
    const message = buildTenantOwnerInviteMessage({ tenantId, email, label });
    if (!navigator?.clipboard?.writeText) {
      throw new Error('Le presse-papiers n est pas disponible sur ce navigateur.');
    }
    await navigator.clipboard.writeText(message);
    toast({
      title: 'Invitation client copiee',
      description: 'Le lien d activation proprietaire a ete copie.',
    });
  }, [toast]);

  const createClientMutation = useMutation({
    mutationFn: async () => {
      if (!currentReseller?.id) {
        throw new Error('Revendeur introuvable.');
      }

      if (!canManageClients) {
        throw new Error('Votre role revendeur ne permet pas de creer un commerce.');
      }

      if (!newClientForm.nom_commercial.trim() || !newClientForm.owner_email.trim() || !newClientForm.telephone.trim() || !newClientForm.adresse.trim()) {
        throw new Error('Tous les champs commerce sont obligatoires.');
      }

      const ownerEmail = normalizeEmail(newClientForm.owner_email);
      const existingTenant = await withTimeout(
        resolveTenantByOwnerEmail(ownerEmail),
        'La verification du commerce existant prend trop de temps. Reessayez.'
      );
      if (existingTenant) {
        throw new Error('Ce commerce existe deja. Merci de me contacter pour le rattachement.');
      }

      const { tenant, profile } = await withTimeout(
        createTenantAndResolve({
          nomCommercial: newClientForm.nom_commercial.trim(),
          ownerEmail,
          subscriptionPlan: newClientForm.subscription_plan,
          adresse: newClientForm.adresse.trim(),
          telephone: newClientForm.telephone.trim(),
        }),
        'La creation du commerce prend trop de temps. Verifiez Supabase ou reessayez.'
      );

      await withTimeout(
        upsertResellerTenantLink({
          tenantId: tenant.id,
          subscriptionPlan: newClientForm.subscription_plan,
        }),
        'Le rattachement du commerce prend trop de temps. Verifiez les droits revendeur.'
      );

      return { tenant, profile, ownerEmail, mode: 'created' };
    },
    onMutate: () => {
      setSubmitFeedback({
        type: 'loading',
        message: 'Creation et rattachement en cours...',
      });
    },
    onSuccess: async ({ tenant, ownerEmail, mode }) => {
      setNewClientForm(createClientForm());
      await queryClient.invalidateQueries({ queryKey: ['reseller-portal'] });
      setSubmitFeedback({
        type: 'success',
        message: `${tenant.nom_commercial} a bien ete cree et rattache.`,
      });
      toast({
        title: mode === 'attached_existing' ? 'Commerce rattache' : 'Commerce cree',
        description: `${tenant.nom_commercial} a ete cree et rattache a votre portefeuille.`,
      });

      try {
        await copyOwnerInvite({
          tenantId: tenant.id,
          email: ownerEmail,
          label: tenant.nom_commercial,
        });
      } catch (clipboardError) {
        console.error('Erreur copie invitation proprietaire:', clipboardError);
        toast({
          title: 'Commerce cree, copie impossible',
          description: 'Le commerce est cree mais le lien n a pas pu etre copie automatiquement.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      console.error('Erreur creation commerce revendeur:', error);
      setSubmitFeedback({
        type: 'error',
        message: error.message || 'Impossible de creer le commerce.',
      });
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de creer le commerce.',
        variant: 'destructive',
      });
    },
  });

  const createClientInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient?.tenant?.id) {
        throw new Error('Selectionnez un client commerce.');
      }
      const selectedType = document.getElementById('client-invoice-type')?.value || clientInvoiceForm.type;
      if (!selectedType) {
        throw new Error('Choisissez un type de facture.');
      }
      if (!clientInvoiceForm.montant || Number.isNaN(Number(clientInvoiceForm.montant))) {
        throw new Error('Montant facture requis.');
      }

      const montantHT = parseFloat(clientInvoiceForm.montant);
      const tauxTVA = parseFloat(clientInvoiceForm.tva_taux) || 0;
      const montantMensuelTTC = parseFloat((montantHT * (1 + tauxTVA / 100)).toFixed(2));
      const montantMensuelTVA = parseFloat((montantMensuelTTC - montantHT).toFixed(2));
      const duree = Number(clientInvoiceForm.duree_mois || 12);
      const isRecurring = selectedType === 'abonnement' || selectedType === 'frais_de_maintenance';
      const montantTotalTTC = isRecurring && clientInvoiceForm.periode_debut ? montantMensuelTTC * duree : montantMensuelTTC;
      const montantTotalHT = isRecurring && clientInvoiceForm.periode_debut ? montantHT * duree : montantHT;
      const montantTotalTVA = isRecurring && clientInvoiceForm.periode_debut ? montantMensuelTVA * duree : montantMensuelTVA;

      const invoiceData = {
        tenant_id: selectedClient.tenant.id,
        reseller_id: currentReseller.id,
        numero_facture: `FAC-${Date.now()}`,
        montant: parseFloat(montantTotalTTC.toFixed(2)),
        tva_taux: tauxTVA,
        type: selectedType,
        description: clientInvoiceForm.description || null,
        date_facturation: clientInvoiceForm.date_facturation,
        statut: 'en_attente',
        issuer_type: 'reseller',
        issuer_id: currentReseller.id,
        recipient_type: 'tenant',
        recipient_id: selectedClient.tenant.id,
        issuer_snapshot: buildResellerIssuerSnapshot({ reseller: currentReseller, branding }),
        recipient_snapshot: buildTenantRecipientSnapshot(selectedClient.tenant),
        metadata: buildPaymentRequestMetadata({
          amountHT: parseFloat(montantTotalHT.toFixed(2)),
          amountTVA: parseFloat(montantTotalTVA.toFixed(2)),
          amountTTC: parseFloat(montantTotalTTC.toFixed(2)),
          monthlyAmountHT: parseFloat(montantHT.toFixed(2)),
          monthlyAmountTVA: parseFloat(montantMensuelTVA.toFixed(2)),
          monthlyAmountTTC: parseFloat(montantMensuelTTC.toFixed(2)),
        }),
      };

      if (clientInvoiceForm.is_devis) {
        invoiceData.is_devis = true;
      }

      if ((clientInvoiceForm.materiel || '').trim()) {
        invoiceData.materiel = clientInvoiceForm.materiel.trim();
      }

      if (isRecurring && clientInvoiceForm.periode_debut) {
        const debut = new Date(clientInvoiceForm.periode_debut);
        const monthlyPayments = {};

        for (let i = 0; i < duree; i += 1) {
          const moisDate = new Date(debut);
          moisDate.setMonth(debut.getMonth() + i);
          const moisKey = moisDate.toISOString().split('T')[0];
          monthlyPayments[moisKey] = {
            montant: montantMensuelTTC,
            paye: false,
            date_paiement: null,
          };
        }

        const fin = new Date(debut);
        fin.setMonth(debut.getMonth() + duree);
        invoiceData.periode_debut = clientInvoiceForm.periode_debut;
        invoiceData.periode_fin = fin.toISOString().split('T')[0];
        invoiceData.monthly_payments = monthlyPayments;
      }

      const createdClientInvoice = await appClient.entities.TenantInvoice.create(invoiceData);

      const pricingRule = pricingRuleMap[selectedType];
      if (pricingRule?.active && !clientInvoiceForm.is_devis) {
        const chargeMonthlyHT = getEffectiveResellerChargeHT({
          rule: pricingRule,
          saleAmountHT: montantHT,
        });
        const chargeMonthlyTVA = Number((chargeMonthlyHT * (tauxTVA / 100)).toFixed(2));
        const chargeMonthlyTTC = Number((chargeMonthlyHT + chargeMonthlyTVA).toFixed(2));
        const chargeTotalHT = isRecurring && clientInvoiceForm.periode_debut ? chargeMonthlyHT * duree : chargeMonthlyHT;
        const chargeTotalTVA = isRecurring && clientInvoiceForm.periode_debut ? chargeMonthlyTVA * duree : chargeMonthlyTVA;
        const chargeTotalTTC = isRecurring && clientInvoiceForm.periode_debut ? chargeMonthlyTTC * duree : chargeMonthlyTTC;

        const platformPaymentRequest = {
          reseller_id: currentReseller.id,
          numero_facture: `FAC-${Date.now() + 1}`,
          montant: Number(chargeTotalTTC.toFixed(2)),
          tva_taux: tauxTVA,
          type: selectedType,
          description: `Facturation plateforme auto - ${selectedClient.tenant.nom_commercial} - ${getInvoiceTypeLabel(selectedType)}`,
          date_facturation: clientInvoiceForm.date_facturation,
          statut: 'en_attente',
          issuer_type: 'platform',
          issuer_id: null,
          recipient_type: 'reseller',
          recipient_id: currentReseller.id,
          issuer_snapshot: {
            type: 'platform',
            legal_name: 'Strasyk POS',
            email: 'contact@strasyk.com',
            phone: null,
            address: null,
          },
          recipient_snapshot: {
            type: 'reseller',
            name: currentReseller.name,
            contact_email: currentReseller.contact_email || null,
            phone: currentReseller.contact_phone || null,
          },
          metadata: {
            ...buildPaymentRequestMetadata({
              amountHT: Number(chargeTotalHT.toFixed(2)),
              amountTVA: Number(chargeTotalTVA.toFixed(2)),
              amountTTC: Number(chargeTotalTTC.toFixed(2)),
              monthlyAmountHT: Number(chargeMonthlyHT.toFixed(2)),
              monthlyAmountTVA: Number(chargeMonthlyTVA.toFixed(2)),
              monthlyAmountTTC: Number(chargeMonthlyTTC.toFixed(2)),
            }),
            source_reseller_invoice_id: createdClientInvoice.id,
            source_tenant_id: selectedClient.tenant.id,
            source_pricing_rule_id: pricingRule.id,
            auto_generated_from_reseller_sale: true,
          },
        };

        if (isRecurring && clientInvoiceForm.periode_debut) {
          const debut = new Date(clientInvoiceForm.periode_debut);
          const monthlyPayments = {};
          for (let i = 0; i < duree; i += 1) {
            const moisDate = new Date(debut);
            moisDate.setMonth(debut.getMonth() + i);
            const moisKey = moisDate.toISOString().split('T')[0];
            monthlyPayments[moisKey] = {
              montant: chargeMonthlyTTC,
              paye: false,
              date_paiement: null,
            };
          }
          const fin = new Date(debut);
          fin.setMonth(debut.getMonth() + duree);
          platformPaymentRequest.periode_debut = clientInvoiceForm.periode_debut;
          platformPaymentRequest.periode_fin = fin.toISOString().split('T')[0];
          platformPaymentRequest.monthly_payments = monthlyPayments;
        }

        await appClient.entities.TenantInvoice.create(platformPaymentRequest);
      }

      return createdClientInvoice;
    },
    onSuccess: async () => {
      toast({ title: '✅ Facture client creee' });
      setClientInvoiceForm(createInvoiceForm());
      await queryClient.invalidateQueries({ queryKey: ['reseller-portal'] });
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const markInvoicePaidMutation = useMutation({
    mutationFn: async (invoice) => {
      const finalInvoice = buildFinalInvoiceFromPaymentRequest(invoice);
      await appClient.entities.TenantInvoice.create(finalInvoice);
      return appClient.entities.TenantInvoice.update(invoice.id, {
        statut: 'payee',
        date_paiement: finalInvoice.date_paiement,
      });
    },
    onSuccess: async () => {
      toast({ title: '✅ Paiement valide' });
      await queryClient.invalidateQueries({ queryKey: ['reseller-portal'] });
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMonthlyPaymentMutation = useMutation({
    mutationFn: async ({ invoice, monthKey }) => {
      const updatedPayments = { ...(invoice.monthly_payments || {}) };
      const currentPayment = updatedPayments[monthKey] || {};
      const isBecomingPaid = !currentPayment.paye;
      updatedPayments[monthKey] = {
        ...currentPayment,
        paye: isBecomingPaid,
        date_paiement: isBecomingPaid ? new Date().toISOString().split('T')[0] : null,
      };
      const nextStatus = computeInvoiceStatusFromMonthlyPayments(updatedPayments);

      const allInvoices = await appClient.entities.TenantInvoice.list('-created_date');
      const existingFinalInvoice = allInvoices.find((item) => (
        isFinalInvoice(item)
        && item.metadata?.linked_payment_request_id === invoice.id
        && item.metadata?.paid_month === monthKey
      ));

      if (isBecomingPaid && !existingFinalInvoice) {
        await appClient.entities.TenantInvoice.create(
          buildFinalInvoiceFromPaymentRequest({
            ...invoice,
            monthly_payments: updatedPayments,
          }, monthKey),
        );
      }

      if (!isBecomingPaid && existingFinalInvoice?.id) {
        await appClient.entities.TenantInvoice.delete(existingFinalInvoice.id);
      }

      return appClient.entities.TenantInvoice.update(invoice.id, {
        monthly_payments: updatedPayments,
        statut: nextStatus,
        date_paiement: nextStatus === 'payee' ? new Date().toISOString().split('T')[0] : null,
      });
    },
    onSuccess: async () => {
      toast({ title: '✅ Paiement mensuel mis a jour' });
      await queryClient.invalidateQueries({ queryKey: ['reseller-portal'] });
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateAndAttach = React.useCallback(async () => {
    setSubmitFeedback({
      type: 'loading',
      message: 'Demande envoyee. Creation et rattachement en cours...',
    });

    try {
      await createClientMutation.mutateAsync();
    } catch (error) {
      console.error('Echec handler creation commerce revendeur:', error);
    }
  }, [createClientMutation]);

  if (!isReseller || !currentReseller) {
    return (
      <div className="p-6 md:p-8">
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">
            Cet espace est reserve aux revendeurs actifs.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Espace revendeur</h1>
        <p className="text-gray-600 mt-1">
          Vous pouvez maintenant creer un commerce, le rattacher a votre portefeuille et copier directement son invitation proprietaire.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`${card.accent} w-11 h-11 rounded-xl flex items-center justify-center`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-orange-600" />
            {currentReseller.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{currentReseller.type === 'white_label' ? 'White label' : 'Standard'}</Badge>
            <Badge className={currentReseller.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {currentReseller.status === 'active' ? 'Actif' : 'Suspendu'}
            </Badge>
            {currentReseller.contact_email && <Badge variant="outline">{currentReseller.contact_email}</Badge>}
            {resellerRole && <Badge variant="outline">Role: {resellerRole}</Badge>}
          </div>

          <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
            Le portail revendeur reste volontairement simple: creation commerce, rattachement, invitation proprietaire et suivi de portefeuille sur une base claire.
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          const searchParams = new URLSearchParams(location.search);
          searchParams.set('tab', value);
          navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="accounting">Comptabilite</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="pricing">Tarifs</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nouveau commerce client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManageClients ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Votre role revendeur actuel ne permet pas de creer un commerce. Demandez a un owner ou manager revendeur.
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du commerce</Label>
                      <Input
                        value={newClientForm.nom_commercial}
                        onChange={(event) => setNewClientForm((prev) => ({ ...prev, nom_commercial: event.target.value }))}
                        placeholder="Ex: Pizza Gare Centrale"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email proprietaire</Label>
                      <Input
                        type="email"
                        value={newClientForm.owner_email}
                        onChange={(event) => setNewClientForm((prev) => ({ ...prev, owner_email: event.target.value }))}
                        placeholder="proprietaire@client.fr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input
                        value={newClientForm.telephone}
                        onChange={(event) => setNewClientForm((prev) => ({ ...prev, telephone: event.target.value }))}
                        placeholder="0600000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select
                        value={newClientForm.subscription_plan}
                        onValueChange={(value) => setNewClientForm((prev) => ({ ...prev, subscription_plan: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Adresse</Label>
                      <Input
                        value={newClientForm.adresse}
                        onChange={(event) => setNewClientForm((prev) => ({ ...prev, adresse: event.target.value }))}
                        placeholder="12 rue Exemple, 75000 Paris"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleCreateAndAttach} disabled={createClientMutation.isPending}>
                      {createClientMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Creer et rattacher
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="w-4 h-4" />
                      Le lien proprietaire est copie automatiquement apres creation.
                    </div>
                  </div>

                  {submitFeedback.message ? (
                    <div className={`rounded-xl border p-3 text-sm ${
                      submitFeedback.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : submitFeedback.type === 'success'
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : 'border-blue-200 bg-blue-50 text-blue-800'
                    }`}>
                      {submitFeedback.message}
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commerces rattaches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-gray-500">Chargement...</p>
              ) : linkedTenants.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun commerce rattache pour le moment.</p>
              ) : (
                linkedTenants.map(({ assignment, tenant }) => (
                  <div key={assignment.id} className="border rounded-xl p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-900">{tenant.nom_commercial}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>Owner: {tenant.owner_email}</span>
                        <span>Plan: {assignment.subscription_plan || tenant.subscription_plan || 'Non defini'}</span>
                        <span>Acquisition: {assignment.acquisition_channel || 'non precise'}</span>
                        <span>Creation: {tenant.created_date ? new Date(tenant.created_date).toLocaleDateString('fr-FR') : 'N/A'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{assignment.status}</Badge>
                        {assignment.commission_type && <Badge variant="outline">Commission: {assignment.commission_type}</Badge>}
                        {assignment.sale_price ? <Badge variant="outline">Vente: {currency(assignment.sale_price)}</Badge> : null}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClientId(tenant.id);
                        copyOwnerInvite({ tenantId: tenant.id, email: tenant.owner_email, label: tenant.nom_commercial });
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copier invitation client
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fiche client et factures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkedTenants.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun client commerce a ouvrir pour le moment.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {linkedTenants.map(({ tenant }) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.nom_commercial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedClient ? (
                    <>
                      <div className="rounded-xl border bg-gray-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{selectedClient.tenant.nom_commercial}</p>
                          <Badge variant="outline">{selectedClient.assignment.status}</Badge>
                          <Badge variant="outline">{selectedClient.assignment.subscription_plan || selectedClient.tenant.subscription_plan || 'Plan non defini'}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                          <span>Owner: {selectedClient.tenant.owner_email || 'Non defini'}</span>
                          <span>Acquisition: {selectedClient.assignment.acquisition_channel || 'non precise'}</span>
                          <span>Debut: {selectedClient.assignment.started_at ? new Date(selectedClient.assignment.started_at).toLocaleDateString('fr-FR') : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
                        <Card className="border border-gray-200 shadow-none">
                          <CardHeader>
                            <CardTitle className="text-lg">Nouvelle facture client</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="rounded-xl border bg-blue-50 p-3 text-sm text-blue-900">
                              Le PDF sortira avec l identite du revendeur courant, pas celle de la plateforme.
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <select
                                id="client-invoice-type"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={clientInvoiceForm.type || ''}
                                onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, type: event.target.value || null }))}
                              >
                                <option value="">Choisir un type</option>
                                <option value="abonnement">Abonnement</option>
                                <option value="achat_complet">Vente complete</option>
                                <option value="materiel">Materiel</option>
                                <option value="module_supplementaire">Module supplementaire</option>
                                <option value="frais_de_maintenance">Maintenance</option>
                                <option value="autre">Autre</option>
                              </select>
                              <p className="text-xs text-gray-500">Type choisi: {getInvoiceTypeLabel(clientInvoiceForm.type)}</p>
                              <p className="text-xs text-blue-700">
                                {activeSelectedPricingRule
                                  ? `Tarif plateforme auto: ${getResellerPricingSummary(activeSelectedPricingRule)}`
                                  : 'Aucun tarif automatique configure pour ce type.'}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Montant HT</Label>
                                <Input
                                  value={clientInvoiceForm.montant}
                                  onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, montant: event.target.value }))}
                                  placeholder="99.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>TVA %</Label>
                                <Input
                                  value={clientInvoiceForm.tva_taux}
                                  onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, tva_taux: event.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                              HT: {clientInvoiceAmounts.montantHT.toFixed(2)} EUR | TVA: {clientInvoiceAmounts.montantTVA.toFixed(2)} EUR | TTC: {clientInvoiceAmounts.montantTTC.toFixed(2)} EUR
                            </div>
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={clientInvoiceForm.date_facturation}
                                onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, date_facturation: event.target.value }))}
                              />
                            </div>
                            {isRecurringInvoiceType(clientInvoiceForm.type) ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label>Debut abonnement</Label>
                                  <Input
                                    type="date"
                                    value={clientInvoiceForm.periode_debut}
                                    onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, periode_debut: event.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Duree mois</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={clientInvoiceForm.duree_mois}
                                    onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, duree_mois: event.target.value }))}
                                  />
                                </div>
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={clientInvoiceForm.description}
                                onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Abonnement, vente, materiel, support..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Materiel / details</Label>
                              <Textarea
                                value={clientInvoiceForm.materiel}
                                onChange={(event) => setClientInvoiceForm((prev) => ({ ...prev, materiel: event.target.value }))}
                                placeholder="Optionnel"
                              />
                            </div>
                            <Button onClick={() => createClientInvoiceMutation.mutate()} disabled={createClientInvoiceMutation.isPending}>
                              <FileText className="w-4 h-4 mr-2" />
                              Creer la facture
                            </Button>
                          </CardContent>
                        </Card>

                        <Card className="border border-gray-200 shadow-none">
                          <CardHeader>
                            <CardTitle className="text-lg">Factures de ce client</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedClientInvoices.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                Aucune facture pour ce client. Si la creation echoue, appliquez d abord `docs/SUPABASE_BILLING_SCHEMA.sql` puis le RLS facture.
                              </p>
                            ) : (
                              selectedClientInvoices.map((invoice) => {
                                const amounts = getInvoiceAmounts(invoice);
                                const hasMonthlyPayments = hasRecurringPayments(invoice) && isPaymentRequestInvoice(invoice);
                                const canValidate = isPaymentRequestInvoice(invoice);
                                return (
                                <div key={invoice.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">
                                        {Number(invoice.montant || 0).toFixed(2)} EUR - {invoice.type}
                                      </p>
                                      {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                                      <Badge variant="outline">{invoice.statut || 'en_attente'}</Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                    </p>
                              <p className="text-xs text-gray-600">
                                HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                              </p>
                              {getInvoiceIssuerName(invoice) ? (
                                <div
                                  className="rounded-lg border bg-white/70 p-3 text-xs text-gray-600"
                                  style={{ borderLeft: `4px solid ${getInvoiceBrandingColor(invoice)}` }}
                                >
                                  <p className="font-semibold text-gray-900">{getInvoiceIssuerName(invoice)}</p>
                                  {invoice.issuer_snapshot?.email ? <p>{invoice.issuer_snapshot.email}</p> : null}
                                  {invoice.issuer_snapshot?.phone ? <p>{invoice.issuer_snapshot.phone}</p> : null}
                                </div>
                              ) : null}
                              {hasMonthlyPayments ? (
                                <p className="text-xs text-blue-700">
                                  Abonnement: {amounts.monthlyAmountTTC.toFixed(2)} EUR / mois sur {Object.keys(invoice.monthly_payments).length} mois
                                      </p>
                                    ) : null}
                                    {invoice.description ? <p className="text-sm text-gray-600 mt-2">{invoice.description}</p> : null}
                                    {hasMonthlyPayments ? (
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                        {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                                          <div key={month} className={`rounded border p-2 text-xs ${payment.paye ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                            <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                                            <p>{Number(payment.montant || 0).toFixed(2)} EUR</p>
                                            <button
                                              onClick={() => toggleMonthlyPaymentMutation.mutate({ invoice, monthKey: month })}
                                              className={`mt-2 w-6 h-6 rounded flex items-center justify-center ${payment.paye ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
                                            >
                                              {payment.paye ? '✓' : '×'}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generateInvoicePDF(invoice, selectedClient.tenant)}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    PDF
                                  </Button>
                                  {!hasMonthlyPayments && canValidate && invoice.statut !== 'payee' ? (
                                    <Button
                                      size="sm"
                                      onClick={() => markInvoicePaidMutation.mutate(invoice)}
                                      disabled={markInvoicePaidMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Valider paiement
                                    </Button>
                                  ) : null}
                                </div>
                              );
                              })
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">CA clients paye TTC</p><p className="text-2xl font-bold text-gray-900 mt-1">{currency(resellerSalesTotals.paid_ttc)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">CA clients en attente TTC</p><p className="text-2xl font-bold text-amber-600 mt-1">{currency(resellerSalesTotals.unpaid_ttc)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Charges plateforme payees TTC</p><p className="text-2xl font-bold text-gray-900 mt-1">{currency(platformChargesTotals.paid_ttc)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Charges plateforme en attente TTC</p><p className="text-2xl font-bold text-amber-600 mt-1">{currency(platformChargesTotals.unpaid_ttc)}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Marge encaissee TTC</p><p className="text-2xl font-bold text-emerald-700 mt-1">{currency(resellerNetTotals.paid_ttc)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Marge encaissee HT</p><p className="text-2xl font-bold text-emerald-700 mt-1">{currency(resellerNetTotals.paid_ht)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Marge a venir TTC</p><p className="text-2xl font-bold text-blue-700 mt-1">{currency(resellerNetTotals.unpaid_ttc)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-gray-500">Marge a venir HT</p><p className="text-2xl font-bold text-blue-700 mt-1">{currency(resellerNetTotals.unpaid_ht)}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-500" /> Vue rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>Cette vue suit l activite du revendeur sur ses ventes clients et sur les lignes de paiement plateforme associees.</p>
              <p>Les chiffres payes comptent uniquement les factures finales reglees. Les chiffres en attente comptent les lignes de paiement non encore validees.</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top clients</CardTitle>
              </CardHeader>
              <CardContent>
                {resellerSalesByClient.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune vente client a afficher.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={resellerSalesByClient} layout="vertical" margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tickFormatter={(value) => `${Number(value || 0).toFixed(0)}€`} />
                        <YAxis type="category" dataKey="name" width={120} />
                        <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(2)}€`, 'CA TTC']} />
                        <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventes par type</CardTitle>
              </CardHeader>
              <CardContent>
                {resellerSalesByType.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune vente a afficher.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={resellerSalesByType}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={105}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {resellerSalesByType.map((entry, index) => (
                            <Cell key={entry.name} fill={RESELLER_STATS_COLORS[index % RESELLER_STATS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(2)}€`, 'CA TTC']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparaison ventes / charges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resellerFlowComparison} margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${Number(value || 0).toFixed(0)}€`} />
                    <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(2)}€`, 'Montant TTC']} />
                    <Legend />
                    <Bar dataKey="paye" fill="#16a34a" radius={[6, 6, 0, 0]} name="Paye" />
                    <Bar dataKey="attente" fill="#f59e0b" radius={[6, 6, 0, 0]} name="En attente" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounting" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comptabilite revendeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900">
                Document de synthese HT / TTC / TVA du revendeur, separe entre ventes clients et facturation plateforme.
              </div>

              <div className="grid xl:grid-cols-2 gap-4">
                <Card className="border border-gray-200 shadow-none">
                  <CardHeader><CardTitle className="text-base">Ventes clients</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-4 gap-2 font-medium text-gray-500">
                      <span></span><span className="text-right">TTC</span><span className="text-right">HT</span><span className="text-right">TVA</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2"><span>Paye</span><span className="text-right">{currency(resellerSalesTotals.paid_ttc)}</span><span className="text-right">{currency(resellerSalesTotals.paid_ht)}</span><span className="text-right">{currency(resellerSalesTotals.paid_tva)}</span></div>
                    <div className="grid grid-cols-4 gap-2"><span>En attente</span><span className="text-right">{currency(resellerSalesTotals.unpaid_ttc)}</span><span className="text-right">{currency(resellerSalesTotals.unpaid_ht)}</span><span className="text-right">{currency(resellerSalesTotals.unpaid_tva)}</span></div>
                    <div className="grid grid-cols-4 gap-2 border-t pt-2 font-semibold"><span>Total</span><span className="text-right">{currency(resellerSalesTotals.paid_ttc + resellerSalesTotals.unpaid_ttc)}</span><span className="text-right">{currency(resellerSalesTotals.paid_ht + resellerSalesTotals.unpaid_ht)}</span><span className="text-right">{currency(resellerSalesTotals.paid_tva + resellerSalesTotals.unpaid_tva)}</span></div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 shadow-none">
                  <CardHeader><CardTitle className="text-base">Facturation plateforme</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-4 gap-2 font-medium text-gray-500">
                      <span></span><span className="text-right">TTC</span><span className="text-right">HT</span><span className="text-right">TVA</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2"><span>Paye</span><span className="text-right">{currency(platformChargesTotals.paid_ttc)}</span><span className="text-right">{currency(platformChargesTotals.paid_ht)}</span><span className="text-right">{currency(platformChargesTotals.paid_tva)}</span></div>
                    <div className="grid grid-cols-4 gap-2"><span>En attente</span><span className="text-right">{currency(platformChargesTotals.unpaid_ttc)}</span><span className="text-right">{currency(platformChargesTotals.unpaid_ht)}</span><span className="text-right">{currency(platformChargesTotals.unpaid_tva)}</span></div>
                    <div className="grid grid-cols-4 gap-2 border-t pt-2 font-semibold"><span>Total</span><span className="text-right">{currency(platformChargesTotals.paid_ttc + platformChargesTotals.unpaid_ttc)}</span><span className="text-right">{currency(platformChargesTotals.paid_ht + platformChargesTotals.unpaid_ht)}</span><span className="text-right">{currency(platformChargesTotals.paid_tva + platformChargesTotals.unpaid_tva)}</span></div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-gray-200 shadow-none">
                <CardHeader><CardTitle className="text-base">Resultat net</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-2 font-medium text-gray-500">
                    <span></span><span className="text-right">TTC</span><span className="text-right">HT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2"><span>Net paye</span><span className="text-right">{currency(resellerNetTotals.paid_ttc)}</span><span className="text-right">{currency(resellerNetTotals.paid_ht)}</span></div>
                  <div className="grid grid-cols-3 gap-2"><span>Net en attente</span><span className="text-right">{currency(resellerNetTotals.unpaid_ttc)}</span><span className="text-right">{currency(resellerNetTotals.unpaid_ht)}</span></div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Factures recues de la plateforme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {receivedResellerInvoices.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-orange-900">Paiements en attente</p>
                      <Badge className="bg-orange-100 text-orange-800">{receivedResellerUnpaidInvoices.length}</Badge>
                    </div>
                    {receivedResellerUnpaidInvoices.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun paiement en attente.</p>
                    ) : (
                      receivedResellerUnpaidInvoices.map((invoice) => {
                        const amounts = getInvoiceAmounts(invoice);
                        const hasMonthlyPayments = hasRecurringPayments(invoice) && isPaymentRequestInvoice(invoice);
                        return (
                          <div key={`pending-${invoice.id}`} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {Number(invoice.montant || 0).toFixed(2)} EUR - {invoice.type}
                                </p>
                                {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                                <Badge variant="outline">{invoice.statut || 'en_attente'}</Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                              </p>
                              <p className="text-xs text-gray-600">
                                HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                              </p>
                              {hasMonthlyPayments ? (
                                <p className="text-xs text-blue-700">
                                  Ligne de paiement abonnement: {amounts.monthlyAmountTTC.toFixed(2)} EUR / mois sur {Object.keys(invoice.monthly_payments).length} mois
                                </p>
                              ) : (
                                <p className="text-sm text-orange-900">Ligne de paiement en attente de validation par la plateforme.</p>
                              )}
                              {invoice.description ? <p className="text-sm text-gray-600">{invoice.description}</p> : null}
                              {hasMonthlyPayments ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                  {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                                    <div key={month} className={`rounded border p-2 text-xs ${payment.paye ? 'bg-green-50 border-green-200' : 'bg-white border-orange-200'}`}>
                                      <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                                      <p>{Number(payment.montant || 0).toFixed(2)} EUR</p>
                                      <p className={payment.paye ? 'text-green-700' : 'text-orange-700'}>
                                        {payment.paye ? 'Valide par la plateforme' : 'En attente'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-green-900">Factures payees</p>
                        <Badge className="bg-green-100 text-green-800">{receivedResellerPaidInvoices.length}</Badge>
                    </div>
                    {receivedResellerPaidInvoices.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucune facture payee pour le moment.</p>
                    ) : (
                      receivedResellerPaidInvoices.map((invoice) => {
                        const amounts = getInvoiceAmounts(invoice);
                        return (
                          <div key={`paid-${invoice.id}`} className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {Number(invoice.montant || 0).toFixed(2)} EUR - {invoice.type}
                                </p>
                                {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                                <Badge className="bg-green-100 text-green-800">payee</Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                              </p>
                              <p className="text-xs text-gray-600">
                                HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                              </p>
                              {getInvoiceIssuerName(invoice) ? (
                                <div
                                  className="rounded-lg border bg-white/80 p-3 text-xs text-gray-600"
                                  style={{ borderLeft: `4px solid ${getInvoiceBrandingColor(invoice)}` }}
                                >
                                  <p className="font-semibold text-gray-900">{getInvoiceIssuerName(invoice)}</p>
                                  {invoice.issuer_snapshot?.email ? <p>{invoice.issuer_snapshot.email}</p> : null}
                                  {invoice.issuer_snapshot?.phone ? <p>{invoice.issuer_snapshot.phone}</p> : null}
                                </div>
                              ) : null}
                              {invoice.date_paiement ? (
                                <p className="text-xs text-green-700">
                                  Paiement valide le {new Date(invoice.date_paiement).toLocaleDateString('fr-FR')}
                                </p>
                              ) : null}
                              {invoice.description ? <p className="text-sm text-gray-600">{invoice.description}</p> : null}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateInvoicePDF(invoice, null)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              PDF
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
              {true ? null : receivedResellerInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune facture recue pour le moment.</p>
              ) : (
                receivedResellerInvoices.map((invoice) => {
                  const amounts = getInvoiceAmounts(invoice);
                  return (
                                <div key={invoice.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">
                          {Number(invoice.montant || 0).toFixed(2)} EUR - {invoice.type}
                        </p>
                        {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                        <Badge variant="outline">{invoice.statut || 'en_attente'}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                      </p>
                                    <p className="text-xs text-gray-600">
                                      HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                                    </p>
                                    {getInvoiceIssuerName(invoice) ? (
                                      <div
                                        className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600"
                                        style={{ borderLeft: `4px solid ${getInvoiceBrandingColor(invoice)}` }}
                                      >
                                        <div className="flex items-center gap-3">
                                          {invoice.issuer_snapshot?.logo_url ? (
                                            <img
                                              src={invoice.issuer_snapshot.logo_url}
                                              alt={getInvoiceIssuerName(invoice)}
                                              className="w-10 h-10 rounded object-contain border bg-white"
                                            />
                                          ) : null}
                                          <div>
                                            <p className="font-semibold text-gray-900">{getInvoiceIssuerName(invoice)}</p>
                                            {invoice.issuer_snapshot?.email ? <p>{invoice.issuer_snapshot.email}</p> : null}
                                            {invoice.issuer_snapshot?.phone ? <p>{invoice.issuer_snapshot.phone}</p> : null}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                    {hasMonthlyPayments ? (
                                      <p className="text-xs text-blue-700">
                                        Abonnement: {amounts.monthlyAmountTTC.toFixed(2)} EUR / mois sur {Object.keys(invoice.monthly_payments).length} mois
                        </p>
                      ) : null}
                      {invoice.description ? <p className="text-sm text-gray-600 mt-2">{invoice.description}</p> : null}
                      {hasMonthlyPayments ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                          {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                            <div key={month} className={`rounded border p-2 text-xs ${payment.paye ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                              <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                              <p>{Number(payment.montant || 0).toFixed(2)} EUR</p>
                              <button
                                onClick={() => toggleMonthlyPaymentMutation.mutate({ invoice, monthKey: month })}
                                className={`mt-2 w-6 h-6 rounded flex items-center justify-center ${payment.paye ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
                              >
                                {payment.paye ? '✓' : '×'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateInvoicePDF(invoice, null)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    {!hasMonthlyPayments && isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee' ? (
                      <Button
                        size="sm"
                        onClick={() => markInvoicePaidMutation.mutate(invoice)}
                        disabled={markInvoicePaidMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Valider paiement
                      </Button>
                    ) : null}
                  </div>
                );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Factures envoyees a mes clients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sentClientInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune facture envoyee a vos clients pour le moment.</p>
              ) : (
                sentClientInvoices.map((invoice) => {
                  const targetTenant = linkedTenants.find((item) => item.tenant.id === (invoice.recipient_id || invoice.tenant_id))?.tenant || null;
                  const amounts = getInvoiceAmounts(invoice);
                  const hasMonthlyPayments = hasRecurringPayments(invoice) && isPaymentRequestInvoice(invoice);
                  const canValidate = isPaymentRequestInvoice(invoice);
                  return (
                    <div key={invoice.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {Number(invoice.montant || 0).toFixed(2)} EUR - {invoice.type}
                          </p>
                          {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                          <Badge variant="outline">{invoice.statut || 'en_attente'}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                        </p>
                        <p className="text-xs text-gray-600">
                          HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                        </p>
                        {getInvoiceIssuerName(invoice) ? (
                          <div
                            className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600"
                            style={{ borderLeft: `4px solid ${getInvoiceBrandingColor(invoice)}` }}
                          >
                            <div className="flex items-center gap-3">
                              {invoice.issuer_snapshot?.logo_url ? (
                                <img
                                  src={invoice.issuer_snapshot.logo_url}
                                  alt={getInvoiceIssuerName(invoice)}
                                  className="w-10 h-10 rounded object-contain border bg-white"
                                />
                              ) : null}
                              <div>
                                <p className="font-semibold text-gray-900">{getInvoiceIssuerName(invoice)}</p>
                                {invoice.issuer_snapshot?.email ? <p>{invoice.issuer_snapshot.email}</p> : null}
                                {invoice.issuer_snapshot?.phone ? <p>{invoice.issuer_snapshot.phone}</p> : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {hasMonthlyPayments ? (
                          <p className="text-xs text-blue-700">
                            Abonnement: {amounts.monthlyAmountTTC.toFixed(2)} EUR / mois sur {Object.keys(invoice.monthly_payments).length} mois
                          </p>
                        ) : null}
                        <p className="text-xs text-gray-500 mt-1">
                          Client: {targetTenant?.nom_commercial || invoice.recipient_snapshot?.recipient_name || 'Inconnu'}
                        </p>
                        {invoice.description ? <p className="text-sm text-gray-600 mt-2">{invoice.description}</p> : null}
                        {hasMonthlyPayments ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                            {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                              <div key={month} className={`rounded border p-2 text-xs ${payment.paye ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                                <p>{Number(payment.montant || 0).toFixed(2)} EUR</p>
                                <button
                                  onClick={() => toggleMonthlyPaymentMutation.mutate({ invoice, monthKey: month })}
                                  className={`mt-2 w-6 h-6 rounded flex items-center justify-center ${payment.paye ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
                                >
                                  {payment.paye ? '✓' : '×'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateInvoicePDF(invoice, targetTenant)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                      {!hasMonthlyPayments && canValidate && invoice.statut !== 'payee' ? (
                        <Button
                          size="sm"
                          onClick={() => markInvoicePaidMutation.mutate(invoice)}
                          disabled={markInvoicePaidMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Valider paiement
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mes tarifs plateforme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900">
                Cette vue est en lecture seule. Elle affiche les tarifs plateforme qui s appliquent a tes ventes selon le produit facture.
              </div>

              <div className="space-y-3">
                {RESELLER_PRODUCT_CATALOG.map((product) => {
                  const rule = pricingRuleMap[product.offer_code];

                  return (
                    <div key={product.offer_code} className="border rounded-xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{product.label}</p>
                          <Badge variant={rule?.active ? 'default' : 'outline'}>
                            {rule?.active ? 'Actif' : 'Non configure'}
                          </Badge>
                          <Badge variant="outline">{rule?.billing_type || product.billing_type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {rule ? getResellerPricingSummary(rule) : 'Aucun tarif actif pour ce produit.'}
                        </p>
                      </div>

                      {rule ? (
                        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 lg:min-w-[320px]">
                          <div>
                            <p className="uppercase tracking-wide">Prix client conseille</p>
                            <p className="font-semibold text-gray-800 mt-1">{Number(rule.public_price || 0).toFixed(2)} EUR HT</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide">Mode tarif</p>
                            <p className="font-semibold text-gray-800 mt-1">{rule.commission_type === 'percentage' ? 'Pourcentage' : 'Prix fixe'}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Commissions et paiements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commissions.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune commission enregistree.</p>
              ) : (
                commissions.slice(0, 12).map((item) => (
                  <div key={item.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.source_type}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.source_reference || 'Sans reference'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{currency(item.commission_amount)}</p>
                      <Badge variant="outline" className="mt-2">{item.status}</Badge>
                    </div>
                  </div>
                ))
              )}

              {payouts.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-900 mb-3">Derniers paiements revendeur</p>
                  <div className="space-y-3">
                    {payouts.slice(0, 6).map((item) => (
                      <div key={item.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{item.period_start || 'Periode non definie'} - {item.period_end || '...'}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.payment_reference || 'Sans reference de paiement'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{currency(item.total_amount)}</p>
                          <Badge variant="outline" className="mt-2">{item.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding revendeur</CardTitle>
            </CardHeader>
            <CardContent>
              {!branding ? (
                <p className="text-sm text-gray-500">Aucun branding defini.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p><strong>Marque:</strong> {branding.brand_name || 'Non definie'}</p>
                    <p><strong>Domaine:</strong> {branding.custom_domain || 'Non defini'}</p>
                    <p><strong>Email support:</strong> {branding.support_email || 'Non defini'}</p>
                    <p><strong>Telephone support:</strong> {branding.support_phone || 'Non defini'}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Palette className="w-4 h-4 text-gray-500" />
                      <span>Primaire</span>
                      <span className="inline-block w-6 h-6 rounded border" style={{ backgroundColor: branding.primary_color || '#f97316' }} />
                      <span className="text-gray-500">{branding.primary_color || '#f97316'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Palette className="w-4 h-4 text-gray-500" />
                      <span>Secondaire</span>
                      <span className="inline-block w-6 h-6 rounded border" style={{ backgroundColor: branding.secondary_color || '#1d4ed8' }} />
                      <span className="text-gray-500">{branding.secondary_color || '#1d4ed8'}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipe revendeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resellerUsers.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun utilisateur revendeur enregistre.</p>
              ) : (
                resellerUsers.map((item) => (
                  <div key={item.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.user_email}</p>
                      <p className="text-xs text-gray-500 mt-1">Role: {item.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.role === 'owner' && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
