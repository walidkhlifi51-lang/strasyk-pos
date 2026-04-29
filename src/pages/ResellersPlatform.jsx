import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Handshake, Palette, Store, Euro, Plus, Link as LinkIcon, Unlink, ShieldAlert, FileText, Download, CheckCircle, Trash2, Loader2, Upload } from 'lucide-react';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';
import { buildTenantOwnerInviteMessage } from '@/lib/tenantProvisioning';
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
  isRecurringInvoiceType,
  isInvoiceForReseller,
  sortInvoicesByDateDesc,
} from '@/lib/invoiceDocuments';
import { PLATFORM_ISSUER_SNAPSHOT, buildResellerRecipientSnapshot } from '@/lib/invoiceSnapshots';
import {
  RESELLER_PRODUCT_CATALOG,
  buildPricingRuleMap,
  createPricingRuleDraft,
  getResellerPricingSummary,
} from '@/lib/resellerPricing';

const createEmptyResellerForm = () => ({
  name: '',
  type: 'standard',
  status: 'active',
  contact_email: '',
  contact_phone: '',
  company_name: '',
  address: '',
  siret: '',
  vat_number: '',
  kbis_document_url: '',
  identity_document_url: '',
  other_document_url: '',
  notes: '',
});

const createEmptyBrandingForm = () => ({
  brand_name: '',
  logo_url: '',
  primary_color: '#f97316',
  secondary_color: '#1d4ed8',
  support_email: '',
  support_phone: '',
  custom_domain: '',
});

const createEmptyResellerUserForm = () => ({
  user_email: '',
  role: 'manager',
  status: 'active',
});

const isEmbeddedImageUrl = (value) => `${value || ''}`.startsWith('data:image/');
const isEmbeddedFileUrl = (value) => `${value || ''}`.startsWith('data:');

const currency = (value) => `${Number(value || 0).toFixed(2)} EUR`;

const computeResellerStats = ({ resellers, resellerTenants, commissions }) => {
  const activeLinks = resellerTenants.filter((item) => item.status === 'active').length;
  const pendingCommissions = commissions
    .filter((item) => item.status === 'pending')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  return [
    {
      title: 'Revendeurs',
      value: resellers.length,
      icon: Building2,
      accent: 'bg-blue-600',
    },
    {
      title: 'White Label',
      value: resellers.filter((item) => item.type === 'white_label').length,
      icon: Palette,
      accent: 'bg-violet-600',
    },
    {
      title: 'Commerces rattaches',
      value: activeLinks,
      icon: Store,
      accent: 'bg-emerald-600',
    },
    {
      title: 'Commissions en attente',
      value: currency(pendingCommissions),
      icon: Euro,
      accent: 'bg-amber-500',
    },
  ];
};

const createInvoiceBucketTotals = () => ({
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
  }, createInvoiceBucketTotals())
);

export default function ResellersPlatform() {
  const { isPlatformAdmin } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedResellerId, setSelectedResellerId] = React.useState(null);
  const [newResellerForm, setNewResellerForm] = React.useState(createEmptyResellerForm());
  const [resellerForm, setResellerForm] = React.useState(createEmptyResellerForm());
  const [brandingForm, setBrandingForm] = React.useState(createEmptyBrandingForm());
  const [newResellerUserForm, setNewResellerUserForm] = React.useState(createEmptyResellerUserForm());
  const [tenantToAttach, setTenantToAttach] = React.useState('');
  const [resellerInvoiceForm, setResellerInvoiceForm] = React.useState(createInvoiceForm());
  const [resellerInvoiceFeedback, setResellerInvoiceFeedback] = React.useState({ type: '', message: '' });
  const [pricingRuleDrafts, setPricingRuleDrafts] = React.useState({});
  const [isUploadingBrandingLogo, setIsUploadingBrandingLogo] = React.useState(false);
  const [uploadingResellerDocument, setUploadingResellerDocument] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['resellers-platform'],
    queryFn: async () => {
      const [
        resellers,
        resellerBranding,
        resellerTenants,
        resellerUsers,
        pricingRules,
        commissions,
        payouts,
        tenants,
        invoices,
      ] = await Promise.all([
        appClient.entities.Reseller.list('-created_date'),
        appClient.entities.ResellerBranding.list('-created_date'),
        appClient.entities.ResellerTenant.list('-created_date'),
        appClient.entities.ResellerUser.list('-created_date'),
        appClient.entities.ResellerPricingRule.list('-created_date'),
        appClient.entities.ResellerCommission.list('-created_date'),
        appClient.entities.ResellerPayout.list('-created_date'),
        appClient.entities.Tenant.list('-created_date'),
        appClient.entities.TenantInvoice.list('-date_facturation').catch(() => []),
      ]);

      return {
        resellers,
        resellerBranding,
        resellerTenants,
        resellerUsers,
        pricingRules,
        commissions,
        payouts,
        tenants,
        invoices,
      };
    },
    enabled: isPlatformAdmin,
    staleTime: 30000,
  });

  const resellers = data?.resellers || [];
  const resellerBranding = data?.resellerBranding || [];
  const resellerTenants = data?.resellerTenants || [];
  const resellerUsers = data?.resellerUsers || [];
  const pricingRules = data?.pricingRules || [];
  const commissions = data?.commissions || [];
  const payouts = data?.payouts || [];
  const tenants = data?.tenants || [];
  const invoices = data?.invoices || [];

  const selectedReseller = resellers.find((item) => item.id === selectedResellerId) || null;
  const selectedBranding = resellerBranding.find((item) => item.reseller_id === selectedResellerId) || null;
  const selectedAssignments = resellerTenants.filter((item) => item.reseller_id === selectedResellerId);
  const selectedResellerUsers = resellerUsers.filter((item) => item.reseller_id === selectedResellerId);
  const selectedCommissions = commissions.filter((item) => item.reseller_id === selectedResellerId);
  const selectedPayouts = payouts.filter((item) => item.reseller_id === selectedResellerId);
  const selectedPricingRules = React.useMemo(
    () => pricingRules.filter((item) => item.reseller_id === selectedResellerId),
    [pricingRules, selectedResellerId],
  );
  const selectedPricingRuleMap = React.useMemo(
    () => buildPricingRuleMap(selectedPricingRules),
    [selectedPricingRules],
  );
  const selectedResellerInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => isInvoiceForReseller(invoice, selectedResellerId)),
  );
  const selectedResellerClientInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => invoice.issuer_type === 'reseller' && invoice.issuer_id === selectedResellerId),
  );
  const selectedResellerUnpaidInvoices = selectedResellerInvoices.filter(
    (invoice) => isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee',
  );
  const selectedResellerPaidInvoices = selectedResellerInvoices.filter(
    (invoice) => isFinalInvoice(invoice) && invoice.statut === 'payee',
  );
  const selectedResellerChargeTotals = React.useMemo(
    () => sumInvoiceBuckets(selectedResellerInvoices),
    [selectedResellerInvoices],
  );
  const selectedResellerSalesTotals = React.useMemo(
    () => sumInvoiceBuckets(selectedResellerClientInvoices),
    [selectedResellerClientInvoices],
  );
  const selectedResellerNetTotals = React.useMemo(() => ({
    paid_ttc: selectedResellerSalesTotals.paid_ttc - selectedResellerChargeTotals.paid_ttc,
    paid_ht: selectedResellerSalesTotals.paid_ht - selectedResellerChargeTotals.paid_ht,
    unpaid_ttc: selectedResellerSalesTotals.unpaid_ttc - selectedResellerChargeTotals.unpaid_ttc,
    unpaid_ht: selectedResellerSalesTotals.unpaid_ht - selectedResellerChargeTotals.unpaid_ht,
  }), [selectedResellerChargeTotals, selectedResellerSalesTotals]);
  const resellerInvoiceAmounts = computeInvoiceAmounts(resellerInvoiceForm.montant, resellerInvoiceForm.tva_taux);

  const getResellerInviteLink = React.useCallback((email, role, resellerId) => {
    return `${buildAbsoluteAppUrl('/InviteSignup')}?reseller=${encodeURIComponent(resellerId)}&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}&label=${encodeURIComponent(selectedReseller?.name || '')}`;
  }, [selectedReseller?.name]);

  const copyResellerInviteLink = React.useCallback(async (email, role, resellerId) => {
    const link = getResellerInviteLink(email, role, resellerId);
    const message = `Bonjour,

Vous etes invite a rejoindre l espace revendeur ${selectedReseller?.name || ''} sur Strasyk POS.

Lien d activation :
${link}

Etapes :
1. Ouvrez le lien
2. Definissez votre mot de passe
3. Connectez-vous avec votre email

A bientot.`;

    await navigator.clipboard.writeText(message);
    toast({
      title: 'âœ… Invitation copiee',
      description: 'Le lien d activation revendeur a ete copie.',
    });
  }, [getResellerInviteLink, selectedReseller?.name, toast]);

  const linkedTenants = selectedAssignments
    .map((assignment) => ({
      assignment,
      tenant: tenants.find((tenant) => tenant.id === assignment.tenant_id) || null,
    }))
    .filter((item) => item.tenant);

  const selectedPipelineStats = {
    activeClients: linkedTenants.filter((item) => item.assignment.status === 'active').length,
    clientsCreatedByReseller: linkedTenants.filter((item) => item.assignment.acquisition_channel === 'reseller_portal').length,
    activeTeam: selectedResellerUsers.filter((item) => item.status === 'active').length,
    pendingCommissions: selectedCommissions
      .filter((item) => item.status === 'pending')
      .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0),
  };

  const activeTenantLinksByTenantId = resellerTenants.reduce((accumulator, item) => {
    if (item.status === 'active' && item.tenant_id && !accumulator[item.tenant_id]) {
      accumulator[item.tenant_id] = item;
    }
    return accumulator;
  }, {});

  const availableTenants = tenants.filter((tenant) => {
    const currentActiveLink = activeTenantLinksByTenantId[tenant.id];
    if (!currentActiveLink) return true;
    return currentActiveLink.reseller_id === selectedResellerId;
  });

  const statsCards = computeResellerStats({ resellers, resellerTenants, commissions });

  const copyTenantOwnerInvite = React.useCallback(async (tenant) => {
    if (!tenant?.id || !tenant?.owner_email) {
      toast({
        title: 'âŒ Invitation impossible',
        description: 'Email proprietaire introuvable pour ce commerce.',
        variant: 'destructive',
      });
      return;
    }

    await navigator.clipboard.writeText(buildTenantOwnerInviteMessage({
      tenantId: tenant.id,
      email: tenant.owner_email,
      label: tenant.nom_commercial,
    }));

    toast({
      title: 'âœ… Invitation proprietaire copiee',
      description: `Lien d activation pret pour ${tenant.nom_commercial}.`,
    });
  }, [toast]);

  React.useEffect(() => {
    if (!selectedResellerId && resellers[0]?.id) {
      setSelectedResellerId(resellers[0].id);
    }
  }, [selectedResellerId, resellers]);

  React.useEffect(() => {
    if (!selectedReseller) {
      setResellerForm(createEmptyResellerForm());
      setBrandingForm(createEmptyBrandingForm());
      setResellerInvoiceForm(createInvoiceForm());
      setPricingRuleDrafts({});
      return;
    }

    setResellerForm({
      name: selectedReseller.name || '',
      type: selectedReseller.type || 'standard',
      status: selectedReseller.status || 'active',
      contact_email: selectedReseller.contact_email || '',
      contact_phone: selectedReseller.contact_phone || '',
      company_name: selectedReseller.company_name || '',
      address: selectedReseller.address || '',
      siret: selectedReseller.siret || '',
      vat_number: selectedReseller.vat_number || '',
      kbis_document_url: selectedReseller.kbis_document_url || '',
      identity_document_url: selectedReseller.identity_document_url || '',
      other_document_url: selectedReseller.other_document_url || '',
      notes: selectedReseller.notes || '',
    });

    setBrandingForm({
      brand_name: selectedBranding?.brand_name || '',
      logo_url: selectedBranding?.logo_url || '',
      primary_color: selectedBranding?.primary_color || '#f97316',
      secondary_color: selectedBranding?.secondary_color || '#1d4ed8',
      support_email: selectedBranding?.support_email || '',
      support_phone: selectedBranding?.support_phone || '',
      custom_domain: selectedBranding?.custom_domain || '',
    });

    setPricingRuleDrafts(
      RESELLER_PRODUCT_CATALOG.reduce((accumulator, product) => {
        accumulator[product.offer_code] = {
          ...createPricingRuleDraft(selectedReseller.id, product.offer_code),
          ...(selectedPricingRuleMap[product.offer_code] || {}),
        };
        return accumulator;
      }, {})
    );
  }, [selectedBranding, selectedReseller]);

  React.useEffect(() => {
    if (!selectedReseller?.id) return;

    setPricingRuleDrafts(
      RESELLER_PRODUCT_CATALOG.reduce((accumulator, product) => {
        accumulator[product.offer_code] = {
          ...createPricingRuleDraft(selectedReseller.id, product.offer_code),
          ...(selectedPricingRuleMap[product.offer_code] || {}),
        };
        return accumulator;
      }, {})
    );
  }, [selectedReseller?.id, selectedPricingRuleMap]);

  const invalidateResellers = () => queryClient.invalidateQueries({ queryKey: ['resellers-platform'] });

  const createResellerMutation = useMutation({
    mutationFn: async () => {
      if (!newResellerForm.name.trim()) {
        throw new Error('Le nom du revendeur est obligatoire.');
      }

      const created = await appClient.entities.Reseller.create({
        name: newResellerForm.name.trim(),
        type: newResellerForm.type,
        status: newResellerForm.status,
        contact_email: newResellerForm.contact_email.trim() || null,
        contact_phone: newResellerForm.contact_phone.trim() || null,
        company_name: newResellerForm.company_name.trim() || null,
        address: newResellerForm.address.trim() || null,
        siret: newResellerForm.siret.trim() || null,
        vat_number: newResellerForm.vat_number.trim() || null,
        kbis_document_url: newResellerForm.kbis_document_url.trim() || null,
        identity_document_url: newResellerForm.identity_document_url.trim() || null,
        other_document_url: newResellerForm.other_document_url.trim() || null,
        notes: newResellerForm.notes.trim() || null,
      });

      await appClient.entities.ResellerBranding.create({
        reseller_id: created.id,
        brand_name: created.name,
        primary_color: '#f97316',
        secondary_color: '#1d4ed8',
      });

      return created;
    },
    onSuccess: async (created) => {
      toast({ title: 'âœ… Revendeur cree', description: created.name });
      setNewResellerForm(createEmptyResellerForm());
      setSelectedResellerId(created.id);
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const saveResellerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      if (!resellerForm.name.trim()) throw new Error('Le nom du revendeur est obligatoire.');

      return appClient.entities.Reseller.update(selectedReseller.id, {
        name: resellerForm.name.trim(),
        type: resellerForm.type,
        status: resellerForm.status,
        contact_email: resellerForm.contact_email.trim() || null,
        contact_phone: resellerForm.contact_phone.trim() || null,
        company_name: resellerForm.company_name.trim() || null,
        address: resellerForm.address.trim() || null,
        siret: resellerForm.siret.trim() || null,
        vat_number: resellerForm.vat_number.trim() || null,
        kbis_document_url: resellerForm.kbis_document_url.trim() || null,
        identity_document_url: resellerForm.identity_document_url.trim() || null,
        other_document_url: resellerForm.other_document_url.trim() || null,
        notes: resellerForm.notes.trim() || null,
      });
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Fiche revendeur enregistree' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const saveBrandingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');

      const payload = {
        reseller_id: selectedReseller.id,
        brand_name: brandingForm.brand_name.trim() || null,
        logo_url: brandingForm.logo_url.trim() || null,
        primary_color: brandingForm.primary_color.trim() || '#f97316',
        secondary_color: brandingForm.secondary_color.trim() || '#1d4ed8',
        support_email: brandingForm.support_email.trim() || null,
        support_phone: brandingForm.support_phone.trim() || null,
        custom_domain: brandingForm.custom_domain.trim() || null,
        domain_verified: false,
      };

      if (selectedBranding?.id) {
        return appClient.entities.ResellerBranding.update(selectedBranding.id, payload);
      }

      return appClient.entities.ResellerBranding.create(payload);
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Branding revendeur enregistre' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleBrandingLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedLogoTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!file.type || !allowedLogoTypes.includes(file.type)) {
      toast({
        title: 'âŒ Fichier non valide',
        description: 'Le logo doit etre une image PNG, JPG ou WEBP.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setIsUploadingBrandingLogo(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setBrandingForm((prev) => ({ ...prev, logo_url: file_url }));
      toast({
        title: 'âœ… Logo telecharge',
        description: 'Le logo a ete charge. Enregistre le branding pour le sauvegarder.',
      });
    } catch (error) {
      toast({
        title: 'âŒ Erreur',
        description: error.message || 'Echec du telechargement du logo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingBrandingLogo(false);
      event.target.value = '';
    }
  };

  const handleResellerDocumentUpload = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedDocumentTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!file.type || !allowedDocumentTypes.includes(file.type)) {
      toast({
        title: 'âŒ Fichier non valide',
        description: 'Le document doit etre un PDF, PNG, JPG ou WEBP.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setUploadingResellerDocument(field);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setResellerForm((prev) => ({ ...prev, [field]: file_url }));
      toast({
        title: 'âœ… Document telecharge',
        description: 'Le document a ete charge. Enregistre la fiche pour le sauvegarder.',
      });
    } catch (error) {
      toast({
        title: 'âŒ Erreur',
        description: error.message || 'Echec du telechargement du document.',
        variant: 'destructive',
      });
    } finally {
      setUploadingResellerDocument('');
      event.target.value = '';
    }
  };

  const savePricingRuleMutation = useMutation({
    mutationFn: async (offerCode) => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      const draft = pricingRuleDrafts[offerCode];
      if (!draft) throw new Error('Tarif introuvable.');

      const payload = {
        reseller_id: selectedReseller.id,
        offer_code: offerCode,
        billing_type: draft.billing_type || 'one_shot',
        cost_price: Number(draft.cost_price || 0),
        reseller_price: Number(draft.reseller_price || 0),
        public_price: Number(draft.public_price || 0),
        commission_type: draft.commission_type || 'fixed',
        commission_value: Number(draft.commission_value || 0),
        active: Boolean(draft.active),
      };

      const existingRule = selectedPricingRuleMap[offerCode];
      if (existingRule?.id) {
        return appClient.entities.ResellerPricingRule.update(existingRule.id, payload);
      }

      return appClient.entities.ResellerPricingRule.create(payload);
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Tarif revendeur enregistre' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const attachTenantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      if (!tenantToAttach) throw new Error('Choisissez un commerce a rattacher.');

      const alreadyActive = resellerTenants.find((item) => item.tenant_id === tenantToAttach && item.status === 'active');
      if (alreadyActive && alreadyActive.reseller_id !== selectedReseller.id) {
        throw new Error('Ce commerce est deja rattache a un autre revendeur actif.');
      }

      const existingLink = resellerTenants.find((item) => item.tenant_id === tenantToAttach && item.reseller_id === selectedReseller.id);
      const targetTenant = tenants.find((item) => item.id === tenantToAttach);

      if (existingLink) {
        return appClient.entities.ResellerTenant.update(existingLink.id, {
          status: 'active',
          subscription_plan: targetTenant?.subscription_plan || existingLink.subscription_plan || null,
          started_at: existingLink.started_at || new Date().toISOString(),
        });
      }

      return appClient.entities.ResellerTenant.create({
        reseller_id: selectedReseller.id,
        tenant_id: tenantToAttach,
        acquisition_channel: 'platform_admin',
        subscription_plan: targetTenant?.subscription_plan || null,
        status: 'active',
        started_at: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Commerce rattache' });
      setTenantToAttach('');
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const createResellerUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      if (!newResellerUserForm.user_email.trim()) throw new Error('Email utilisateur obligatoire.');

      return appClient.entities.ResellerUser.create({
        reseller_id: selectedReseller.id,
        user_email: newResellerUserForm.user_email.trim().toLowerCase(),
        role: newResellerUserForm.role,
        status: newResellerUserForm.status,
      });
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Utilisateur revendeur ajoute' });
      await copyResellerInviteLink(newResellerUserForm.user_email.trim().toLowerCase(), newResellerUserForm.role, selectedReseller.id);
      setNewResellerUserForm(createEmptyResellerUserForm());
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateResellerUserMutation = useMutation({
    mutationFn: async ({ id, status }) => appClient.entities.ResellerUser.update(id, { status }),
    onSuccess: async () => {
      toast({ title: 'âœ… Statut utilisateur mis a jour' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const detachTenantMutation = useMutation({
    mutationFn: async (assignmentId) => appClient.entities.ResellerTenant.delete(assignmentId),
    onSuccess: async () => {
      toast({ title: 'âœ… Rattachement supprime' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const createResellerInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      const selectedType = document.getElementById('reseller-invoice-type')?.value || resellerInvoiceForm.type;
      if (!selectedType) throw new Error('Choisissez un type de facture.');
      if (!resellerInvoiceForm.montant || Number.isNaN(Number(resellerInvoiceForm.montant))) {
        throw new Error('Montant facture requis.');
      }

      const montantHT = parseFloat(resellerInvoiceForm.montant);
      const tauxTVA = parseFloat(resellerInvoiceForm.tva_taux) || 0;
      const montantMensuelTTC = parseFloat((montantHT * (1 + tauxTVA / 100)).toFixed(2));
      const montantMensuelTVA = parseFloat((montantMensuelTTC - montantHT).toFixed(2));
      const duree = Number(resellerInvoiceForm.duree_mois || 12);
      const isRecurring = selectedType === 'abonnement' || selectedType === 'frais_de_maintenance';
      const montantTotalTTC = isRecurring && resellerInvoiceForm.periode_debut ? montantMensuelTTC * duree : montantMensuelTTC;
      const montantTotalHT = isRecurring && resellerInvoiceForm.periode_debut ? montantHT * duree : montantHT;
      const montantTotalTVA = isRecurring && resellerInvoiceForm.periode_debut ? montantMensuelTVA * duree : montantMensuelTVA;

      const invoiceData = {
        reseller_id: selectedReseller.id,
        numero_facture: `FAC-${Date.now()}`,
        montant: parseFloat(montantTotalTTC.toFixed(2)),
        tva_taux: tauxTVA,
        type: selectedType,
        description: resellerInvoiceForm.description || null,
        date_facturation: resellerInvoiceForm.date_facturation,
        statut: 'en_attente',
        issuer_type: 'platform',
        issuer_id: null,
        recipient_type: 'reseller',
        recipient_id: selectedReseller.id,
        issuer_snapshot: PLATFORM_ISSUER_SNAPSHOT,
        recipient_snapshot: buildResellerRecipientSnapshot(selectedReseller),
        metadata: buildPaymentRequestMetadata({
          amountHT: parseFloat(montantTotalHT.toFixed(2)),
          amountTVA: parseFloat(montantTotalTVA.toFixed(2)),
          amountTTC: parseFloat(montantTotalTTC.toFixed(2)),
          monthlyAmountHT: parseFloat(montantHT.toFixed(2)),
          monthlyAmountTVA: parseFloat(montantMensuelTVA.toFixed(2)),
          monthlyAmountTTC: parseFloat(montantMensuelTTC.toFixed(2)),
        }),
      };

      if (resellerInvoiceForm.is_devis) {
        invoiceData.is_devis = true;
      }

      if ((resellerInvoiceForm.materiel || '').trim()) {
        invoiceData.materiel = resellerInvoiceForm.materiel.trim();
      }

      if (isRecurring && resellerInvoiceForm.periode_debut) {
        const debut = new Date(resellerInvoiceForm.periode_debut);
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
        invoiceData.periode_debut = resellerInvoiceForm.periode_debut;
        invoiceData.periode_fin = fin.toISOString().split('T')[0];
        invoiceData.monthly_payments = monthlyPayments;
      }

      return appClient.entities.TenantInvoice.create(invoiceData);
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Facture revendeur creee' });
      setResellerInvoiceForm(createInvoiceForm());
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateResellerInvoice = React.useCallback(async () => {
    setResellerInvoiceFeedback({ type: 'loading', message: 'Creation de la facture revendeur en cours...' });
    try {
      await createResellerInvoiceMutation.mutateAsync();
      setResellerInvoiceFeedback({ type: 'success', message: 'Facture revendeur creee.' });
    } catch (error) {
      setResellerInvoiceFeedback({
        type: 'error',
        message: error?.message || 'Impossible de creer la facture revendeur.',
      });
      console.error('Erreur creation facture revendeur:', error);
    }
  }, [createResellerInvoiceMutation]);

  const markResellerInvoicePaidMutation = useMutation({
    mutationFn: async (invoice) => {
      const finalInvoice = buildFinalInvoiceFromPaymentRequest(invoice);
      await appClient.entities.TenantInvoice.create(finalInvoice);
      return appClient.entities.TenantInvoice.update(invoice.id, {
        statut: 'payee',
        date_paiement: finalInvoice.date_paiement,
      });
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Paiement valide' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const toggleResellerMonthlyPaymentMutation = useMutation({
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
      toast({ title: 'âœ… Paiement mensuel mis a jour' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteResellerInvoiceMutation = useMutation({
    mutationFn: async (invoice) => {
      if (!invoice?.id) {
        throw new Error('Facture revendeur introuvable.');
      }

      const allInvoices = await appClient.entities.TenantInvoice.list('-created_date');
      const paymentRequestId = isPaymentRequestInvoice(invoice)
        ? invoice.id
        : invoice.metadata?.linked_payment_request_id || null;

      if (paymentRequestId) {
        const invoicesToDelete = allInvoices.filter((item) => (
          item.id === paymentRequestId
          || item.metadata?.linked_payment_request_id === paymentRequestId
        ));

        for (const linkedInvoice of invoicesToDelete) {
          if (linkedInvoice.id !== invoice.id) {
            await appClient.entities.TenantInvoice.delete(linkedInvoice.id);
          }
        }
      }

      return appClient.entities.TenantInvoice.delete(invoice.id);
    },
    onSuccess: async () => {
      toast({ title: 'âœ… Facture revendeur supprimee' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: 'âŒ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  if (!isPlatformAdmin) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-600 mt-0.5" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Acces reserve a la plateforme</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Cette section sert a gerer les revendeurs, leurs commerces rattaches et la base des commissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Revendeurs</h1>
        <p className="text-gray-600 mt-1">
          V1 plateforme: fiche revendeur, branding de base, rattachement commerce et socle commissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((card) => (
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

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nouveau revendeur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={newResellerForm.name}
                  onChange={(event) => setNewResellerForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Partner Paris Nord"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newResellerForm.type} onValueChange={(value) => setNewResellerForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="white_label">White label</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={newResellerForm.status} onValueChange={(value) => setNewResellerForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="suspended">Suspendu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email contact</Label>
                <Input
                  value={newResellerForm.contact_email}
                  onChange={(event) => setNewResellerForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                  placeholder="contact@revendeur.fr"
                />
              </div>
              <div className="space-y-2">
                <Label>Telephone contact</Label>
                <Input
                  value={newResellerForm.contact_phone}
                  onChange={(event) => setNewResellerForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                  placeholder="0600000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={newResellerForm.notes}
                  onChange={(event) => setNewResellerForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Conditions commerciales, particularites, remarques de suivi..."
                />
              </div>
              <Button
                onClick={() => createResellerMutation.mutate()}
                disabled={createResellerMutation.isPending}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Creer le revendeur
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Liste revendeurs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-gray-500">Chargement...</p>
              ) : resellers.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun revendeur pour le moment.</p>
              ) : (
                resellers.map((reseller) => {
                  const resellerTenantCount = resellerTenants.filter((item) => item.reseller_id === reseller.id && item.status === 'active').length;
                  const pendingAmount = commissions
                    .filter((item) => item.reseller_id === reseller.id && item.status === 'pending')
                    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

                  const isSelected = reseller.id === selectedResellerId;

                  return (
                    <button
                      key={reseller.id}
                      type="button"
                      onClick={() => setSelectedResellerId(reseller.id)}
                      className={`w-full text-left border rounded-xl p-4 transition ${
                        isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{reseller.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{reseller.contact_email || 'Sans email contact'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{reseller.type === 'white_label' ? 'White label' : 'Standard'}</Badge>
                          <Badge className={reseller.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {reseller.status === 'active' ? 'Actif' : 'Suspendu'}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
                        <div>
                          <p className="uppercase tracking-wide text-gray-400">Commerces</p>
                          <p className="font-semibold text-gray-800 mt-1">{resellerTenantCount}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-wide text-gray-400">Commissions pending</p>
                          <p className="font-semibold text-gray-800 mt-1">{currency(pendingAmount)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedReseller ? `Fiche revendeur: ${selectedReseller.name}` : 'Selectionnez un revendeur'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedReseller ? (
              <p className="text-sm text-gray-500">Choisissez un revendeur dans la colonne de gauche pour afficher sa fiche complete.</p>
            ) : (
              <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="identity">Identite</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="team">Equipe</TabsTrigger>
                  <TabsTrigger value="tenants">Commerces</TabsTrigger>
                  <TabsTrigger value="pricing">Tarifs</TabsTrigger>
                  <TabsTrigger value="invoices">Factures</TabsTrigger>
                  <TabsTrigger value="finance">Finance</TabsTrigger>
                </TabsList>

                <TabsContent value="identity" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Clients actifs</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPipelineStats.activeClients}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Crees par le revendeur</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPipelineStats.clientsCreatedByReseller}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Equipe active</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPipelineStats.activeTeam}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Commissions pending</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{currency(selectedPipelineStats.pendingCommissions)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom revendeur</Label>
                      <Input value={resellerForm.name} onChange={(event) => setResellerForm((prev) => ({ ...prev, name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email contact</Label>
                      <Input value={resellerForm.contact_email} onChange={(event) => setResellerForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={resellerForm.type} onValueChange={(value) => setResellerForm((prev) => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="white_label">White label</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select value={resellerForm.status} onValueChange={(value) => setResellerForm((prev) => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="suspended">Suspendu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Telephone contact</Label>
                      <Input value={resellerForm.contact_phone} onChange={(event) => setResellerForm((prev) => ({ ...prev, contact_phone: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Nom de la societe</Label>
                      <Input
                        value={resellerForm.company_name}
                        onChange={(event) => setResellerForm((prev) => ({ ...prev, company_name: event.target.value }))}
                        placeholder="Facultatif"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Adresse de la societe</Label>
                      <Textarea
                        value={resellerForm.address}
                        onChange={(event) => setResellerForm((prev) => ({ ...prev, address: event.target.value }))}
                        placeholder="Adresse de la societe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SIRET</Label>
                      <Input
                        value={resellerForm.siret}
                        onChange={(event) => setResellerForm((prev) => ({ ...prev, siret: event.target.value }))}
                        placeholder="Facultatif"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Numero de TVA</Label>
                      <Input
                        value={resellerForm.vat_number}
                        onChange={(event) => setResellerForm((prev) => ({ ...prev, vat_number: event.target.value }))}
                        placeholder="Facultatif"
                      />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label>KBIS</Label>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
                          {uploadingResellerDocument === 'kbis_document_url' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploadingResellerDocument === 'kbis_document_url' ? 'Telechargement...' : 'Choisir un fichier'}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => handleResellerDocumentUpload(event, 'kbis_document_url')}
                            disabled={uploadingResellerDocument === 'kbis_document_url'}
                          />
                        </label>
                        {isEmbeddedFileUrl(resellerForm.kbis_document_url) ? (
                          <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900 space-y-3 flex-1">
                            <p>Document telecharge localement. L URL brute est masquee.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResellerForm((prev) => ({ ...prev, kbis_document_url: '' }))}
                            >
                              Remplacer par une URL manuelle
                            </Button>
                          </div>
                        ) : (
                          <Input
                            value={resellerForm.kbis_document_url}
                            onChange={(event) => setResellerForm((prev) => ({ ...prev, kbis_document_url: event.target.value }))}
                            placeholder="URL document KBIS facultative"
                          />
                        )}
                      </div>
                      {resellerForm.kbis_document_url ? (
                        <div className="rounded-xl border bg-gray-50 p-4 flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-900">Document KBIS charge</p>
                            <p className="break-all">
                              {isEmbeddedFileUrl(resellerForm.kbis_document_url) ? 'Document telecharge localement' : resellerForm.kbis_document_url}
                            </p>
                          </div>
                          <Button type="button" variant="outline" asChild>
                            <a href={resellerForm.kbis_document_url} download="kbis-revendeur">
                              Telecharger
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label>Piece d identite</Label>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
                          {uploadingResellerDocument === 'identity_document_url' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploadingResellerDocument === 'identity_document_url' ? 'Telechargement...' : 'Choisir un fichier'}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => handleResellerDocumentUpload(event, 'identity_document_url')}
                            disabled={uploadingResellerDocument === 'identity_document_url'}
                          />
                        </label>
                        {isEmbeddedFileUrl(resellerForm.identity_document_url) ? (
                          <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900 space-y-3 flex-1">
                            <p>Document telecharge localement. L URL brute est masquee.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResellerForm((prev) => ({ ...prev, identity_document_url: '' }))}
                            >
                              Remplacer par une URL manuelle
                            </Button>
                          </div>
                        ) : (
                          <Input
                            value={resellerForm.identity_document_url}
                            onChange={(event) => setResellerForm((prev) => ({ ...prev, identity_document_url: event.target.value }))}
                            placeholder="URL piece d identite facultative"
                          />
                        )}
                      </div>
                      {resellerForm.identity_document_url ? (
                        <div className="rounded-xl border bg-gray-50 p-4 flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-900">Piece d identite chargee</p>
                            <p className="break-all">
                              {isEmbeddedFileUrl(resellerForm.identity_document_url) ? 'Document telecharge localement' : resellerForm.identity_document_url}
                            </p>
                          </div>
                          <Button type="button" variant="outline" asChild>
                            <a href={resellerForm.identity_document_url} download="piece-identite-revendeur">
                              Telecharger
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label>Autres</Label>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
                          {uploadingResellerDocument === 'other_document_url' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploadingResellerDocument === 'other_document_url' ? 'Telechargement...' : 'Choisir un fichier'}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => handleResellerDocumentUpload(event, 'other_document_url')}
                            disabled={uploadingResellerDocument === 'other_document_url'}
                          />
                        </label>
                        {isEmbeddedFileUrl(resellerForm.other_document_url) ? (
                          <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900 space-y-3 flex-1">
                            <p>Document telecharge localement. L URL brute est masquee.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResellerForm((prev) => ({ ...prev, other_document_url: '' }))}
                            >
                              Remplacer par une URL manuelle
                            </Button>
                          </div>
                        ) : (
                          <Input
                            value={resellerForm.other_document_url}
                            onChange={(event) => setResellerForm((prev) => ({ ...prev, other_document_url: event.target.value }))}
                            placeholder="URL autre document facultative"
                          />
                        )}
                      </div>
                      {resellerForm.other_document_url ? (
                        <div className="rounded-xl border bg-gray-50 p-4 flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-900">Autre document charge</p>
                            <p className="break-all">
                              {isEmbeddedFileUrl(resellerForm.other_document_url) ? 'Document telecharge localement' : resellerForm.other_document_url}
                            </p>
                          </div>
                          <Button type="button" variant="outline" asChild>
                            <a href={resellerForm.other_document_url} download="autre-document-revendeur">
                              Telecharger
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes internes</Label>
                      <Textarea value={resellerForm.notes} onChange={(event) => setResellerForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </div>
                  </div>
                  <Button onClick={() => saveResellerMutation.mutate()} disabled={saveResellerMutation.isPending}>
                    Enregistrer la fiche
                  </Button>
                </TabsContent>

                <TabsContent value="branding" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom de marque</Label>
                      <Input value={brandingForm.brand_name} onChange={(event) => setBrandingForm((prev) => ({ ...prev, brand_name: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Domaine public revendeur</Label>
                      <Input value={brandingForm.custom_domain} onChange={(event) => setBrandingForm((prev) => ({ ...prev, custom_domain: event.target.value }))} placeholder="www.marque-revendeur.fr" />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur principale</Label>
                      <div className="flex items-center gap-3 rounded-xl border px-3 py-2 bg-white">
                        <span
                          className="inline-block h-8 w-8 rounded-full border shadow-sm"
                          style={{ backgroundColor: brandingForm.primary_color || '#f97316' }}
                        />
                        <input
                          type="color"
                          value={brandingForm.primary_color || '#f97316'}
                          onChange={(event) => setBrandingForm((prev) => ({ ...prev, primary_color: event.target.value }))}
                          className="h-10 w-16 cursor-pointer rounded border bg-white p-1"
                        />
                        <span className="text-sm font-mono text-gray-600">
                          {brandingForm.primary_color || '#f97316'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur secondaire</Label>
                      <div className="flex items-center gap-3 rounded-xl border px-3 py-2 bg-white">
                        <span
                          className="inline-block h-8 w-8 rounded-full border shadow-sm"
                          style={{ backgroundColor: brandingForm.secondary_color || '#1d4ed8' }}
                        />
                        <input
                          type="color"
                          value={brandingForm.secondary_color || '#1d4ed8'}
                          onChange={(event) => setBrandingForm((prev) => ({ ...prev, secondary_color: event.target.value }))}
                          className="h-10 w-16 cursor-pointer rounded border bg-white p-1"
                        />
                        <span className="text-sm font-mono text-gray-600">
                          {brandingForm.secondary_color || '#1d4ed8'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email support</Label>
                      <Input value={brandingForm.support_email} onChange={(event) => setBrandingForm((prev) => ({ ...prev, support_email: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone support</Label>
                      <Input value={brandingForm.support_phone} onChange={(event) => setBrandingForm((prev) => ({ ...prev, support_phone: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>URL logo</Label>
                      {isEmbeddedImageUrl(brandingForm.logo_url) ? (
                        <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900 space-y-3">
                          <p>Logo telecharge localement. L URL brute est masquee pour eviter le bloc de texte.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBrandingForm((prev) => ({ ...prev, logo_url: '' }))}
                          >
                            Remplacer par une URL manuelle
                          </Button>
                        </div>
                      ) : (
                        <Input
                          value={brandingForm.logo_url}
                          onChange={(event) => setBrandingForm((prev) => ({ ...prev, logo_url: event.target.value }))}
                          placeholder="https://..."
                        />
                      )}
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label>Telecharger un logo</Label>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
                          {isUploadingBrandingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {isUploadingBrandingLogo ? 'Telechargement...' : 'Choisir un fichier'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleBrandingLogoUpload}
                            disabled={isUploadingBrandingLogo}
                          />
                        </label>
                        <p className="text-xs text-gray-500">
                          Formats acceptes : PNG, JPG, WEBP. Le fichier renseigne automatiquement le champ URL logo.
                        </p>
                      </div>
                      {brandingForm.logo_url ? (
                        <div className="rounded-xl border bg-gray-50 p-4 flex items-center gap-4">
                          <img
                            src={brandingForm.logo_url}
                            alt={brandingForm.brand_name || selectedReseller?.name || 'Logo revendeur'}
                            className="w-16 h-16 rounded-lg object-contain border bg-white"
                          />
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-900">Apercu du logo</p>
                            <p className="break-all">
                              {isEmbeddedImageUrl(brandingForm.logo_url) ? 'Image telechargee localement' : brandingForm.logo_url}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                    Ce bloc reste volontairement simple en v1. Le white label avance pourra reutiliser cette table sans toucher a la fiche identite.
                  </div>
                  <Button onClick={() => saveBrandingMutation.mutate()} disabled={saveBrandingMutation.isPending}>
                    Enregistrer le branding
                  </Button>
                </TabsContent>

                <TabsContent value="team" className="space-y-4 mt-4">
                  <div className="rounded-xl border bg-blue-50 p-4">
                    <p className="text-sm text-blue-900 font-medium">Ajouter un utilisateur revendeur</p>
                    <div className="grid md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 mt-4">
                      <Input
                        value={newResellerUserForm.user_email}
                        onChange={(event) => setNewResellerUserForm((prev) => ({ ...prev, user_email: event.target.value }))}
                        placeholder="email@revendeur.fr"
                      />
                      <Select value={newResellerUserForm.role} onValueChange={(value) => setNewResellerUserForm((prev) => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="sales">Commercial</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={newResellerUserForm.status} onValueChange={(value) => setNewResellerUserForm((prev) => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="suspended">Suspendu</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={() => createResellerUserMutation.mutate()} disabled={createResellerUserMutation.isPending}>
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  {selectedResellerUsers.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun utilisateur revendeur sur cette fiche.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedResellerUsers.map((item) => (
                        <div key={item.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.user_email}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{item.role}</Badge>
                              <Badge className={item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyResellerInviteLink(item.user_email, item.role, selectedReseller.id)}
                            >
                              Copier invitation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateResellerUserMutation.mutate({ id: item.id, status: item.status === 'active' ? 'suspended' : 'active' })}
                              disabled={updateResellerUserMutation.isPending}
                            >
                              {item.status === 'active' ? 'Suspendre' : 'Reactiver'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tenants" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Total commerces</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{linkedTenants.length}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Crees via portail</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPipelineStats.clientsCreatedByReseller}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Actifs</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPipelineStats.activeClients}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Portefeuille</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{currency(linkedTenants.reduce((sum, item) => sum + Number(item.assignment.sale_price || 0), 0))}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-xl border bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-blue-900 font-medium">
                      <Handshake className="w-4 h-4" />
                      Rattachement commerce
                    </div>
                    <p className="text-sm text-blue-800 mt-1">
                      V1 applique une regle simple: un commerce ne peut avoir qu un seul revendeur actif a la fois.
                    </p>
                    <div className="grid md:grid-cols-[1fr_auto] gap-3 mt-4">
                      <Select value={tenantToAttach} onValueChange={setTenantToAttach}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un commerce a rattacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.nom_commercial}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => attachTenantMutation.mutate()} disabled={attachTenantMutation.isPending}>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Rattacher
                      </Button>
                    </div>
                  </div>

                  {linkedTenants.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun commerce rattache a ce revendeur pour le moment.</p>
                  ) : (
                    <div className="space-y-3">
                      {linkedTenants.map(({ assignment, tenant }) => (
                        <div key={assignment.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900">{tenant.nom_commercial}</p>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                              <span>Owner: {tenant.owner_email || 'Non defini'}</span>
                              <span>Plan: {assignment.subscription_plan || tenant.subscription_plan || 'Non defini'}</span>
                              <span>Acquisition: {assignment.acquisition_channel || 'non precise'}</span>
                              <span>Creation commerce: {tenant.created_date ? new Date(tenant.created_date).toLocaleDateString('fr-FR') : 'N/A'}</span>
                              <span>Debut portefeuille: {assignment.started_at ? new Date(assignment.started_at).toLocaleDateString('fr-FR') : 'N/A'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Badge variant="outline">{assignment.status}</Badge>
                              {assignment.commission_type && <Badge variant="outline">Commission: {assignment.commission_type}</Badge>}
                              {assignment.sale_price ? <Badge variant="outline">Vente: {currency(assignment.sale_price)}</Badge> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyTenantOwnerInvite(tenant)}
                            >
                              Copier invitation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => detachTenantMutation.mutate(assignment.id)}
                              disabled={detachTenantMutation.isPending}
                            >
                              <Unlink className="w-4 h-4 mr-2" />
                              Retirer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pricing" className="space-y-4 mt-4">
                  <div className="rounded-xl border bg-blue-50 p-4 text-sm text-blue-900">
                    Tu fixes ici les tarifs plateforme de ce revendeur par produit. Quand le revendeur facture un commerce, une ligne de paiement plateforme vers revendeur sera creee automatiquement a partir de ces regles.
                  </div>

                  <div className="space-y-4">
                    {RESELLER_PRODUCT_CATALOG.map((product) => {
                      const draft = pricingRuleDrafts[product.offer_code] || createPricingRuleDraft(selectedReseller.id, product.offer_code);
                      const isPercentage = draft.commission_type === 'percentage';

                      return (
                        <Card key={product.offer_code} className="border border-gray-200 shadow-none">
                          <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between gap-3">
                              <span>{product.label}</span>
                              <Badge variant={draft.active ? 'default' : 'outline'}>
                                {draft.active ? 'Actif' : 'Inactif'}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
                              <div className="space-y-2">
                                <Label>Activer</Label>
                                <Select
                                  value={draft.active ? 'yes' : 'no'}
                                  onValueChange={(value) => setPricingRuleDrafts((prev) => ({
                                    ...prev,
                                    [product.offer_code]: {
                                      ...draft,
                                      active: value === 'yes',
                                    },
                                  }))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="yes">Oui</SelectItem>
                                    <SelectItem value="no">Non</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Mode</Label>
                                <Select
                                  value={draft.commission_type || 'fixed'}
                                  onValueChange={(value) => setPricingRuleDrafts((prev) => ({
                                    ...prev,
                                    [product.offer_code]: {
                                      ...draft,
                                      commission_type: value,
                                    },
                                  }))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">Prix fixe</SelectItem>
                                    <SelectItem value="percentage">Pourcentage</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Periodicite</Label>
                                <Select
                                  value={draft.billing_type || product.billing_type}
                                  onValueChange={(value) => setPricingRuleDrafts((prev) => ({
                                    ...prev,
                                    [product.offer_code]: {
                                      ...draft,
                                      billing_type: value,
                                    },
                                  }))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="monthly">Mensuel</SelectItem>
                                    <SelectItem value="yearly">Annuel</SelectItem>
                                    <SelectItem value="one_shot">Ponctuel</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Prix client conseille HT</Label>
                                <Input
                                  value={draft.public_price ?? 0}
                                  onChange={(event) => setPricingRuleDrafts((prev) => ({
                                    ...prev,
                                    [product.offer_code]: {
                                      ...draft,
                                      public_price: event.target.value,
                                    },
                                  }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{isPercentage ? 'Pourcentage plateforme' : 'Prix revendeur HT'}</Label>
                                <Input
                                  value={isPercentage ? (draft.commission_value ?? 0) : (draft.reseller_price ?? 0)}
                                  onChange={(event) => setPricingRuleDrafts((prev) => ({
                                    ...prev,
                                    [product.offer_code]: {
                                      ...draft,
                                      ...(isPercentage
                                        ? { commission_value: event.target.value }
                                        : { reseller_price: event.target.value }),
                                    },
                                  }))}
                                />
                              </div>
                            </div>

                            <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                              {getResellerPricingSummary(draft)}
                            </div>

                            <Button
                              onClick={() => savePricingRuleMutation.mutate(product.offer_code)}
                              disabled={savePricingRuleMutation.isPending}
                            >
                              Enregistrer le tarif
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="invoices" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-[380px_minmax(0,1fr)] gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg">Nouvelle facture revendeur</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-xl border bg-orange-50 p-3 text-sm text-orange-900">
                          Cette facture est emise par la plateforme vers le revendeur courant. Elle sera visible dans sa fiche.
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <select
                            id="reseller-invoice-type"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={resellerInvoiceForm.type || ''}
                            onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, type: event.target.value || null }))}
                          >
                            <option value="">Choisir un type</option>
                            <option value="abonnement">Abonnement</option>
                            <option value="achat_complet">Vente complete</option>
                            <option value="materiel">Materiel</option>
                            <option value="module_supplementaire">Module supplementaire</option>
                            <option value="frais_de_maintenance">Maintenance</option>
                            <option value="autre">Autre</option>
                          </select>
                          <p className="text-xs text-gray-500">Type choisi: {getInvoiceTypeLabel(resellerInvoiceForm.type)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Montant HT</Label>
                            <Input
                              value={resellerInvoiceForm.montant}
                              onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, montant: event.target.value }))}
                              placeholder="199.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>TVA %</Label>
                            <Input
                              value={resellerInvoiceForm.tva_taux}
                              onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, tva_taux: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                          HT: {resellerInvoiceAmounts.montantHT.toFixed(2)} EUR | TVA: {resellerInvoiceAmounts.montantTVA.toFixed(2)} EUR | TTC: {resellerInvoiceAmounts.montantTTC.toFixed(2)} EUR
                        </div>
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={resellerInvoiceForm.date_facturation}
                            onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, date_facturation: event.target.value }))}
                          />
                        </div>
                        {isRecurringInvoiceType(resellerInvoiceForm.type) ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Debut abonnement</Label>
                              <Input
                                type="date"
                                value={resellerInvoiceForm.periode_debut}
                                onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, periode_debut: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Duree mois</Label>
                              <Input
                                type="number"
                                min="1"
                                value={resellerInvoiceForm.duree_mois}
                                onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, duree_mois: event.target.value }))}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={resellerInvoiceForm.description}
                            onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, description: event.target.value }))}
                            placeholder="Abonnement revendeur, activation modules, support..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Materiel / details</Label>
                          <Textarea
                            value={resellerInvoiceForm.materiel}
                            onChange={(event) => setResellerInvoiceForm((prev) => ({ ...prev, materiel: event.target.value }))}
                            placeholder="Optionnel"
                          />
                        </div>
                        <Button type="button" onClick={handleCreateResellerInvoice} disabled={createResellerInvoiceMutation.isPending}>
                          Creer la facture
                        </Button>
                        {resellerInvoiceFeedback.message ? (
                          <div
                            className={`rounded-xl border p-3 text-sm ${
                              resellerInvoiceFeedback.type === 'error'
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : resellerInvoiceFeedback.type === 'success'
                                  ? 'border-green-200 bg-green-50 text-green-800'
                                  : 'border-blue-200 bg-blue-50 text-blue-800'
                            }`}
                          >
                            {resellerInvoiceFeedback.message}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg">Factures du revendeur</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedResellerInvoices.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            Aucune facture plateforme vers revendeur pour le moment. Appliquez d abord le schema SQL billing avant emission.
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between pt-1">
                              <h4 className="text-sm font-semibold text-amber-700">Paiements en attente</h4>
                              <Badge variant="outline">{selectedResellerUnpaidInvoices.length}</Badge>
                            </div>
                            {selectedResellerUnpaidInvoices.length === 0 ? (
                              <p className="text-sm text-gray-500">Aucune ligne de paiement en attente.</p>
                            ) : (
                              selectedResellerUnpaidInvoices.map((invoice) => {
                                const amounts = getInvoiceAmounts(invoice);
                                const hasMonthlyPayments = hasRecurringPayments(invoice);
                                return (
                                  <div key={invoice.id} className="border rounded-xl p-4 flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">
                                          {Number(invoice.montant || 0).toFixed(2)} EUR - {getInvoiceTypeLabel(invoice.type)}
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
                                                onClick={() => toggleResellerMonthlyPaymentMutation.mutate({ invoice, monthKey: month })}
                                                className={`mt-2 w-6 h-6 rounded flex items-center justify-center ${payment.paye ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
                                              >
                                                {payment.paye ? 'OK' : 'X'}
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateInvoicePDF(invoice, null)}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        PDF
                                      </Button>
                                      {!hasMonthlyPayments ? (
                                        <Button
                                          size="sm"
                                          onClick={() => markResellerInvoicePaidMutation.mutate(invoice)}
                                          disabled={markResellerInvoicePaidMutation.isPending}
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          Valider paiement
                                        </Button>
                                      ) : null}
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          if (!confirm('Supprimer cette facture revendeur ?')) return;
                                          deleteResellerInvoiceMutation.mutate(invoice);
                                        }}
                                        disabled={deleteResellerInvoiceMutation.isPending}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div className="flex items-center justify-between pt-3">
                              <h4 className="text-sm font-semibold text-green-700">Factures payees</h4>
                              <Badge variant="outline">{selectedResellerPaidInvoices.length}</Badge>
                            </div>
                            {selectedResellerPaidInvoices.length === 0 ? (
                              <p className="text-sm text-gray-500">Aucune facture payee pour le moment.</p>
                            ) : (
                              selectedResellerPaidInvoices.map((invoice) => {
                                const amounts = getInvoiceAmounts(invoice);
                                return (
                                  <div key={invoice.id} className="border rounded-xl p-4 flex items-start justify-between gap-4 bg-green-50/40">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">
                                          {Number(invoice.montant || 0).toFixed(2)} EUR - {getInvoiceTypeLabel(invoice.type)}
                                        </p>
                                        {invoice.is_devis ? <Badge variant="secondary">DEVIS</Badge> : null}
                                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">payee</Badge>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        HT: {amounts.amountHT.toFixed(2)} EUR | TVA: {amounts.amountTVA.toFixed(2)} EUR | TTC: {amounts.amountTTC.toFixed(2)} EUR
                                      </p>
                                      {invoice.description ? <p className="text-sm text-gray-600 mt-2">{invoice.description}</p> : null}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateInvoicePDF(invoice, null)}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        PDF
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          if (!confirm('Supprimer cette facture revendeur ?')) return;
                                          deleteResellerInvoiceMutation.mutate(invoice);
                                        }}
                                        disabled={deleteResellerInvoiceMutation.isPending}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="finance" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Charges plateforme en attente TTC</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {currency(selectedResellerChargeTotals.unpaid_ttc)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Charges plateforme payees TTC</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {currency(selectedResellerChargeTotals.paid_ttc)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Ventes clients payees TTC</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{currency(selectedResellerSalesTotals.paid_ttc)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Net revendeur paye TTC</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{currency(selectedResellerNetTotals.paid_ttc)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Resume HT / TVA plateforme</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-700">
                        <p>Charges en attente: HT {selectedResellerChargeTotals.unpaid_ht.toFixed(2)} EUR | TVA {selectedResellerChargeTotals.unpaid_tva.toFixed(2)} EUR</p>
                        <p>Charges payees: HT {selectedResellerChargeTotals.paid_ht.toFixed(2)} EUR | TVA {selectedResellerChargeTotals.paid_tva.toFixed(2)} EUR</p>
                        <p>Ventes clients en attente: HT {selectedResellerSalesTotals.unpaid_ht.toFixed(2)} EUR | TVA {selectedResellerSalesTotals.unpaid_tva.toFixed(2)} EUR</p>
                        <p>Ventes clients payees: HT {selectedResellerSalesTotals.paid_ht.toFixed(2)} EUR | TVA {selectedResellerSalesTotals.paid_tva.toFixed(2)} EUR</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Vue reelle finance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-700">
                        <p>Cette vue est maintenant basee sur les factures revendeur et les charges plateforme reelles.</p>
                        <p>Payouts manuels enregistres: {selectedPayouts.length}</p>
                        <p>Commissions manuelles enregistrees: {selectedCommissions.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border border-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Derniers mouvements plateforme / revendeur</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedResellerInvoices.length === 0 && selectedResellerClientInvoices.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucun mouvement financier detecte pour ce revendeur.</p>
                      ) : (
                        sortInvoicesByDateDesc([...selectedResellerInvoices, ...selectedResellerClientInvoices])
                          .slice(0, 10)
                          .map((item) => {
                            const amounts = getInvoiceAmounts(item);
                            const direction = item.issuer_type === 'platform' ? 'Plateforme -> Revendeur' : 'Revendeur -> Client';
                            return (
                              <div key={item.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                                <div>
                                  <p className="font-medium text-gray-900">{direction}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {item.numero_facture || item.id?.substring(0, 8) || 'N/A'} - {getInvoiceTypeLabel(item.type)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">{currency(amounts.amountTTC)}</p>
                                  <Badge variant="outline" className="mt-2">{item.statut || 'en_attente'}</Badge>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </CardContent>
                  </Card>

                  {(selectedCommissions.length > 0 || selectedPayouts.length > 0) && (
                    <div className="space-y-3">
                      {selectedCommissions.slice(0, 8).map((item) => (
                        <div key={`commission-${item.id}`} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">Commission manuelle - {item.source_type}</p>
                            <p className="text-xs text-gray-500 mt-1">{item.source_reference || 'Sans reference'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{currency(item.commission_amount)}</p>
                            <Badge variant="outline" className="mt-2">{item.status}</Badge>
                          </div>
                        </div>
                      ))}
                      {selectedPayouts.slice(0, 6).map((item) => (
                        <div key={`payout-${item.id}`} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">Payout manuel</p>
                            <p className="text-xs text-gray-500 mt-1">{item.payment_reference || 'Sans reference de paiement'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{currency(item.total_amount)}</p>
                            <Badge variant="outline" className="mt-2">{item.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

