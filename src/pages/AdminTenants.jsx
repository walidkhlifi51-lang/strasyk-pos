import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Store, Plus, Trash2, CheckCircle, XCircle, Loader2, Bell, Mail, Phone, MapPin, Calendar, Users, Monitor, Eye, FileText, Download, LayoutGrid, Edit, Wand2, Truck, Copy, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateInvoicePDF } from '@/components/admin/InvoicePDFGenerator';
import AdminTemplateSelector from '@/components/admin/AdminTemplateSelector';
import {
  buildFinalInvoiceFromPaymentRequest,
  buildPaymentRequestMetadata,
  computeInvoiceStatusFromMonthlyPayments,
  getInvoiceTypeLabel,
  hasRecurringPayments,
  isFinalInvoice,
  isPaymentRequestInvoice,
  isRecurringInvoiceType,
} from '@/lib/invoiceDocuments';
import { normalizeCustomDomain } from '@/lib/publicSiteTenant';
import {
  createTenantAndResolve,
  ensureRestaurantProfile,
  normalizeEmail,
  resolveTenantByOwnerEmail,
} from '@/lib/tenantProvisioning';

const buildCreationSummary = ({ tenant, profile, ownerEmail }) => [
  `Commerce : ${tenant.nom_commercial}`,
  `Proprietaire : ${ownerEmail}`,
  `Tenant ID : ${tenant.id}`,
  `Profil : ${profile ? 'cree' : 'absent'}`,
].join(' | ');

class AdminSectionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('AdminTenants section crash:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-sm text-red-700">
            Cette section a provoque une erreur d affichage. La fiche reste ouverte mais ce bloc a ete neutralise.
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default function AdminTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewTenant, setPreviewTenant] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const selectedProfile = selectedTenant?.profile || null;
  const [tenantsWithProfiles, setTenantsWithProfiles] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [formData, setFormData] = useState({ nom_commercial: '', adresse: '', telephone: '', owner_email: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    montant: '',
    type: null,
    description: '',
    date_facturation: new Date().toISOString().split('T')[0],
    tva_taux: 20,
    periode_debut: new Date().toISOString().split('T')[0],
    periode_fin: '',
    duree_mois: 12,
    is_devis: false,
    lignes_materiel: []
  });
  const [editingPayment, setEditingPayment] = useState(null);
  const [tenantDomainDraft, setTenantDomainDraft] = useState('');
  const [copiedValue, setCopiedValue] = useState('');

  const { data: tenants = [], refetch, isLoading } = useQuery({
    queryKey: ['allTenants'],
    queryFn: async () => {
      const tenantsList = await appClient.entities.Tenant.list();
      const profiles = await appClient.entities.RestaurantProfile.list();
      const enriched = tenantsList.map(tenant => ({
        ...tenant,
        profile: profiles.find(p => p.tenant_id === tenant.id)
      }));
      setTenantsWithProfiles(enriched);
      return tenantsList;
    },
  });

  const { data: requests = [], refetch: refetchRequests } = useQuery({
    queryKey: ['inscriptionRequests'],
    queryFn: () => appClient.entities.InscriptionRequest.list('-created_date'),
    refetchInterval: 10000,
  });

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', selectedTenant?.id],
    queryFn: () => appClient.entities.TenantInvoice.filter({ tenant_id: selectedTenant.id }, '-date_facturation'),
    enabled: !!selectedTenant?.id,
  });

  const { data: previewInvoices = [], refetch: refetchPreviewInvoices } = useQuery({
    queryKey: ['previewInvoices', previewTenant?.id],
    queryFn: () => appClient.entities.TenantInvoice.filter({ tenant_id: previewTenant.id }, '-date_facturation'),
    enabled: !!previewTenant?.id,
  });

  const billingTenant = previewTenant || selectedTenant || null;
  const billingInvoices = previewTenant ? previewInvoices : invoices;

  const { data: platformAdmins = [], refetch: refetchPlatformAdmins } = useQuery({
    queryKey: ['platformAdmins'],
    queryFn: () => appClient.entities.PlatformAdminAccess.list(),
  });

  const mergeInvoiceInCache = React.useCallback((queryKey, invoice) => {
    queryClient.setQueryData(queryKey, (current = []) => {
      const next = Array.isArray(current) ? [...current] : [];
      const index = next.findIndex((item) => item.id === invoice.id);
      if (index >= 0) next[index] = { ...next[index], ...invoice };
      else next.unshift(invoice);
      return next.sort((a, b) => new Date(b.created_date || b.date_facturation || 0) - new Date(a.created_date || a.date_facturation || 0));
    });
  }, [queryClient]);

  const removeInvoiceFromCache = React.useCallback((queryKey, invoiceId) => {
    queryClient.setQueryData(queryKey, (current = []) => (Array.isArray(current) ? current.filter((item) => item.id !== invoiceId) : []));
  }, [queryClient]);

  React.useEffect(() => {
    const unsubscribe = appClient.entities.InscriptionRequest.subscribe((event) => {
      if (event.type === 'create') {
        refetchRequests();
      }
    });
    return unsubscribe;
  }, [refetchRequests]);

  React.useEffect(() => {
    setTenantDomainDraft(selectedProfile?.custom_domain || '');
  }, [selectedProfile?.custom_domain, selectedTenant?.id]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data) => await appClient.entities.TenantInvoice.create(data),
    onSuccess: () => {
      toast({ title: "✅ Facture créée" });
      setInvoiceForm({ 
        montant: '', 
        type: null, 
        description: '', 
        materiel: '',
        date_facturation: new Date().toISOString().split('T')[0],
        tva_taux: 20,
        periode_debut: new Date().toISOString().split('T')[0],
        periode_fin: '',
        duree_mois: 12,
        is_devis: false,
        lignes_materiel: []
      });
      refetchInvoices();
      refetchPreviewInvoices();
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId) => await appClient.entities.TenantInvoice.delete(invoiceId),
    onSuccess: () => {
      toast({ title: "✅ Facture supprimée" });
      refetchInvoices();
      refetchPreviewInvoices();
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (invoice) => {
      const finalInvoice = buildFinalInvoiceFromPaymentRequest(invoice);
      await appClient.entities.TenantInvoice.create(finalInvoice);
      return appClient.entities.TenantInvoice.update(invoice.id, {
        statut: 'payee',
        date_paiement: finalInvoice.date_paiement,
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Statut mis à jour" });
      refetchInvoices();
      refetchPreviewInvoices();
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  React.useEffect(() => {
    const createdInvoice = createInvoiceMutation.data;
    if (!createdInvoice?.tenant_id) return;

    mergeInvoiceInCache(['invoices', createdInvoice.tenant_id], createdInvoice);
    mergeInvoiceInCache(['previewInvoices', createdInvoice.tenant_id], createdInvoice);
  }, [createInvoiceMutation.data, mergeInvoiceInCache]);

  const handleCreateInvoice = async () => {
    if (!billingTenant || !invoiceForm.montant || isNaN(Number(invoiceForm.montant))) {
      toast({ title: "❌ Montant requis et valide", variant: "destructive" });
      return;
    }

    if (!invoiceForm.type) {
      toast({ title: "Type de facture requis", variant: "destructive" });
      return;
    }
    const montantHT = parseFloat(invoiceForm.montant);
    const tauxTVA = parseFloat(invoiceForm.tva_taux) || 0;
    const montantTVA = parseFloat((montantHT * (tauxTVA / 100)).toFixed(2));
    const montantMensuelTTC = parseFloat((montantHT + montantTVA).toFixed(2));

    // Si abonnement ou frais de maintenance, le montant saisi est le montant MENSUEL
    const duree = invoiceForm.duree_mois || 12;
    const isRecurring = isRecurringInvoiceType(invoiceForm.type);
    const montantTotalHT = isRecurring && invoiceForm.periode_debut ? montantHT * duree : montantHT;
    const montantTotalTVA = isRecurring && invoiceForm.periode_debut ? montantTVA * duree : montantTVA;
    const montantTotalTTC = isRecurring && invoiceForm.periode_debut ? montantMensuelTTC * duree : montantMensuelTTC;

    const invoiceData = {
      tenant_id: billingTenant.id,
      numero_facture: `FAC-${Date.now()}`,
      montant: parseFloat(montantTotalTTC.toFixed(2)),
      tva_taux: tauxTVA,
      type: invoiceForm.type,
      description: invoiceForm.description,
      date_facturation: invoiceForm.date_facturation,
      statut: 'en_attente',
      metadata: buildPaymentRequestMetadata({
        amountHT: parseFloat(montantTotalHT.toFixed(2)),
        amountTVA: parseFloat(montantTotalTVA.toFixed(2)),
        amountTTC: parseFloat(montantTotalTTC.toFixed(2)),
        monthlyAmountHT: parseFloat(montantHT.toFixed(2)),
        monthlyAmountTVA: parseFloat(montantTVA.toFixed(2)),
        monthlyAmountTTC: parseFloat(montantMensuelTTC.toFixed(2)),
      }),
    };

    if (invoiceForm.is_devis) {
      invoiceData.is_devis = true;
    }

    if ((invoiceForm.materiel || '').trim()) {
      invoiceData.materiel = invoiceForm.materiel.trim();
    }

    if (Array.isArray(invoiceForm.lignes_materiel) && invoiceForm.lignes_materiel.length > 0) {
      invoiceData.lignes_materiel = invoiceForm.lignes_materiel
        .filter((ligne) => (ligne.designation || '').trim())
        .map((ligne) => ({
          designation: (ligne.designation || '').trim(),
          quantite: Number(ligne.quantite) || 1,
          prix_unitaire_ht: Number(ligne.prix_unitaire_ht) || 0,
          tva_taux: Number(ligne.tva_taux) || 0,
        }));
    }

    // Si abonnement ou frais de maintenance, générer les paiements mensuels
    if (isRecurring && invoiceForm.periode_debut) {
      const debut = new Date(invoiceForm.periode_debut);
      const monthlyPayments = {};

      for (let i = 0; i < duree; i++) {
        const moisDate = new Date(debut);
        moisDate.setMonth(debut.getMonth() + i);
        const moisKey = moisDate.toISOString().split('T')[0];
        monthlyPayments[moisKey] = {
          montant: montantMensuelTTC,
          paye: false,
          date_paiement: null
        };
      }

      const fin = new Date(debut);
      fin.setMonth(debut.getMonth() + duree);
      invoiceData.periode_debut = invoiceForm.periode_debut;
      invoiceData.periode_fin = fin.toISOString().split('T')[0];
      invoiceData.monthly_payments = monthlyPayments;
    }

    await createInvoiceMutation.mutateAsync(invoiceData);
  };

  const downloadInvoice = (invoice) => {
    const tenant = tenantsWithProfiles.find(t => t.id === invoice.tenant_id);
    if (!tenant) {
      toast({ title: "❌ Commerce introuvable", variant: "destructive" });
      return;
    }
    generateInvoicePDF(invoice, tenant);
    toast({ title: "📄 Facture PDF téléchargée" });
  };

  const handleToggleMonthlyPayment = async (invoice, monthKey) => {
    try {
      const updatedPayments = { ...(invoice.monthly_payments || {}) };
      const currentPayment = updatedPayments[monthKey] || {};
      const currentStatus = Boolean(currentPayment.paye);
      updatedPayments[monthKey] = {
        ...currentPayment,
        paye: !currentStatus,
        date_paiement: !currentStatus ? new Date().toISOString().split('T')[0] : null
      };
      const allInvoices = await appClient.entities.TenantInvoice.list('-created_date');
      const existingFinalInvoice = allInvoices.find((item) => (
        item.metadata?.linked_payment_request_id === invoice.id
        && item.metadata?.paid_month === monthKey
      ));

      if (!currentStatus && !existingFinalInvoice) {
        await appClient.entities.TenantInvoice.create(
          buildFinalInvoiceFromPaymentRequest({
            ...invoice,
            monthly_payments: updatedPayments,
          }, monthKey),
        );
      }

      if (currentStatus && existingFinalInvoice) {
        await appClient.entities.TenantInvoice.delete(existingFinalInvoice.id);
      }

      await appClient.entities.TenantInvoice.update(invoice.id, {
        monthly_payments: updatedPayments,
        statut: computeInvoiceStatusFromMonthlyPayments(updatedPayments),
        date_paiement: Object.values(updatedPayments).every((payment) => payment?.paye)
          ? new Date().toISOString().split('T')[0]
          : null,
      });
      toast({ title: currentStatus ? "❌ Paiement annulé" : "✅ Paiement validé" });
      refetchInvoices();
      refetchPreviewInvoices();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleModule = async (tenant, moduleField) => {
    try {
      const profiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: tenant.id });
      const profile = profiles[0];
      if (!profile) {
        toast({ title: "❌ Erreur", description: "Profil introuvable", variant: "destructive" });
        return;
      }
      const newStatus = !profile[moduleField];
      await appClient.entities.RestaurantProfile.update(profile.id, { [moduleField]: newStatus });
      const moduleNames = {
        manages_kiosk: 'Borne',
        customer_display_enabled: 'Écran client',
        manages_table_plan: 'Plan de tables',
        delivery_app_allowed: 'Application livreur',
        manages_web_ordering: 'Commande en ligne',
      };
      toast({
        title: newStatus ? `✅ ${moduleNames[moduleField]} activé` : `🚫 ${moduleNames[moduleField]} désactivé`,
        description: tenant.nom_commercial,
      });
      // Mettre à jour le profil dans selectedTenant sans fermer la dialog
      setSelectedTenant(prev => prev ? { ...prev, profile: { ...prev.profile, [moduleField]: newStatus } } : null);
      await refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveTenantDomain = async () => {
    if (!selectedTenant?.id || !selectedProfile?.id) {
      toast({ title: "❌ Erreur", description: "Profil commerce introuvable", variant: "destructive" });
      return;
    }

    try {
      const normalizedDomain = normalizeCustomDomain(tenantDomainDraft);
      const domainChanged = normalizedDomain !== normalizeCustomDomain(selectedProfile.custom_domain || '');

      const updatedProfile = await appClient.entities.RestaurantProfile.update(selectedProfile.id, {
        custom_domain: normalizedDomain || null,
        domain_verified: domainChanged ? false : (selectedProfile.domain_verified ?? false),
      });

      setSelectedTenant((prev) => prev ? {
        ...prev,
        profile: {
          ...prev.profile,
          ...updatedProfile,
        },
      } : prev);

      toast({
        title: "✅ Domaine enregistré",
        description: normalizedDomain ? `Domaine public: ${normalizedDomain}` : "Domaine personnalisé supprimé",
      });

      await refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(label);
      window.setTimeout(() => setCopiedValue(''), 2000);
      toast({ title: "✅ Copié", description: `${label} copié dans le presse-papiers` });
    } catch {
      toast({ title: "❌ Erreur", description: "Impossible de copier", variant: "destructive" });
    }
  };

  const refreshTenantSnapshot = async (tenantId) => {
    const [tenantsList, profiles] = await Promise.all([
      appClient.entities.Tenant.list(),
      appClient.entities.RestaurantProfile.filter({ tenant_id: tenantId }, '-created_date', 5),
    ]);

    const refreshedTenant = tenantsList.find((tenant) => tenant.id === tenantId) || null;
    if (!refreshedTenant) return null;

    return {
      ...refreshedTenant,
      profile: profiles[0] || null,
    };
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.nom_commercial || !formData.adresse || !formData.telephone || !formData.owner_email) {
      toast({ title: "❌ Champs requis", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const ownerEmail = normalizeEmail(formData.owner_email);
      const existingTenants = await appClient.entities.Tenant.filter({ owner_email: ownerEmail }, '-created_date', 5);
      const existingTenant = existingTenants.find((tenant) => normalizeEmail(tenant.owner_email) === ownerEmail);

      if (existingTenant) {
        throw new Error('Un commerce existe deja pour cet email proprietaire.');
      }

      await createTenantAndResolve({
        nomCommercial: formData.nom_commercial,
        ownerEmail,
        subscriptionPlan: 'basic',
        adresse: formData.adresse,
        telephone: formData.telephone,
      });
      toast({ title: "✅ Commerce créé", description: `${formData.nom_commercial} a été créé avec succès` });
      setFormData({ nom_commercial: '', adresse: '', telephone: '', owner_email: '' });
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message || "Impossible de créer le commerce", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (tenant) => {
    if (!confirm(`Supprimer le commerce "${tenant.nom_commercial}" ?\n\nATTENTION : Cette action est irréversible !`)) return;
    try {
      await appClient.entities.Tenant.delete(tenant.id);
      toast({ title: "🗑️ Commerce supprimé", description: tenant.nom_commercial });
      refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (tenant) => {
    try {
      await appClient.entities.Tenant.update(tenant.id, { active: !tenant.active });
      toast({ title: tenant.active ? "⏸️ Commerce désactivé" : "✅ Commerce activé", description: tenant.nom_commercial });
      refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleTogglePOS = async (tenant) => {
    try {
      await appClient.entities.Tenant.update(tenant.id, { pos_suspended: !tenant.pos_suspended });
      toast({ title: tenant.pos_suspended ? "✅ Caisse réactivée" : "🔒 Caisse suspendue", description: tenant.nom_commercial });
      refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleRequestAction = async (requestId, newStatus) => {
    try {
      await appClient.entities.InscriptionRequest.update(requestId, { statut: newStatus });
      toast({ title: 'Demande mise à jour', description: `Statut changé en "${newStatus}"` });
      refetchRequests();
      return true;
    } catch (error) {
      if (newStatus === 'accepte') {
        try {
          await appClient.entities.InscriptionRequest.delete(requestId);
          toast({
            title: 'Demande retiree',
            description: 'Le commerce a ete cree. La demande a ete retiree de la file admin.',
          });
          refetchRequests();
          return true;
        } catch (deleteError) {
          toast({ title: 'Erreur', description: deleteError.message || error.message, variant: 'destructive' });
          throw deleteError;
        }
      }
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleAddPlatformAdmin = async () => {
    if (!newAdminEmail.trim()) {
      toast({ title: "❌ Email requis", variant: "destructive" });
      return;
    }

    const normalizedEmail = normalizeEmail(newAdminEmail);
    const existing = platformAdmins.find((entry) => normalizeEmail(entry.user_email) === normalizedEmail);

    try {
      if (existing) {
        await appClient.entities.PlatformAdminAccess.update(existing.id, { is_active: true });
      } else {
        await appClient.entities.PlatformAdminAccess.create({
          user_email: normalizedEmail,
          is_active: true,
        });
      }

      setNewAdminEmail('');
      toast({ title: "✅ Admin plateforme autorisé" });
      refetchPlatformAdmins();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleTogglePlatformAdmin = async (entry) => {
    try {
      await appClient.entities.PlatformAdminAccess.update(entry.id, {
        is_active: entry.is_active === false,
      });
      toast({ title: entry.is_active === false ? "✅ Admin réactivé" : "⏸️ Admin suspendu" });
      refetchPlatformAdmins();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDeletePlatformAdmin = async (entry) => {
    if (!confirm(`Supprimer l'accès admin de ${entry.user_email} ?`)) return;

    try {
      await appClient.entities.PlatformAdminAccess.delete(entry.id);
      toast({ title: "🗑️ Accès admin supprimé" });
      refetchPlatformAdmins();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleAcceptAndCreate = async (request) => {
    if (!confirm(`Créer le commerce "${request.nom_commercial}" pour ${request.email} ?`)) return;
    setIsCreating(true);
    try {
      const ownerEmail = normalizeEmail(request.email);
      const existingTenants = await appClient.entities.Tenant.filter({ owner_email: ownerEmail }, '-created_date', 5);
      const existingTenant = existingTenants.find((tenant) => normalizeEmail(tenant.owner_email) === ownerEmail);

      if (existingTenant) {
        const existingProfile = await ensureRestaurantProfile({
          tenantId: existingTenant.id,
          nomCommercial: request.nom_commercial,
          adresse: request.adresse,
          telephone: request.telephone,
        });
        await handleRequestAction(request.id, 'accepte');
        toast({
          title: "Demande deja rattachee",
          description: buildCreationSummary({
            tenant: existingTenant,
            profile: existingProfile,
            ownerEmail,
          }),
        });
        refetch();
        return;
      }

      const { tenant: newTenant, profile: createdProfile } = await createTenantAndResolve({
        nomCommercial: request.nom_commercial,
        ownerEmail,
        subscriptionPlan: request.formule_choisie === 'essai' ? 'trial' : 'basic',
        adresse: request.adresse,
        telephone: request.telephone,
      });
      await handleRequestAction(request.id, 'accepte');
      toast({
        title: "Verification creation",
        description: buildCreationSummary({
          tenant: newTenant,
          profile: createdProfile,
          ownerEmail,
        }),
      });
      toast({ title: "Commerce cree et demande acceptee", description: `${request.nom_commercial} est maintenant actif` });
      refetch();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message || "Impossible de créer le commerce", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const pendingRequests = requests.filter(r => r.statut === 'en_attente');
  const processedRequests = requests.filter(r => r.statut !== 'en_attente');

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Commerces</h1>
            <p className="text-gray-600 mt-1">Gestion centralisée des commerces et abonnements</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Commerce
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un nouveau commerce</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Nom du commerce *</Label>
                  <Input placeholder="Restaurant Le Gourmet" value={formData.nom_commercial} onChange={(e) => setFormData({ ...formData, nom_commercial: e.target.value })} required />
                </div>
                <div>
                  <Label>Email propriétaire *</Label>
                  <Input type="email" placeholder="proprietaire@example.com" value={formData.owner_email} onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })} required />
                </div>
                <div>
                  <Label>Adresse *</Label>
                  <Input placeholder="1 rue de Paris, 75001 Paris" value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} required />
                </div>
                <div>
                  <Label>Téléphone *</Label>
                  <Input placeholder="01 23 45 67 89" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : 'Créer le commerce'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Admins plateforme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="admin@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
              <Button onClick={handleAddPlatformAdmin}>Autoriser</Button>
            </div>
            <div className="space-y-2">
              {platformAdmins.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun admin plateforme configuré.</p>
              ) : (
                platformAdmins.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3 bg-white">
                    <div>
                      <p className="font-medium">{entry.user_email}</p>
                      <p className="text-xs text-gray-500">{entry.is_active === false ? 'Suspendu' : 'Actif'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={entry.is_active === false ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTogglePlatformAdmin(entry)}
                      >
                        {entry.is_active === false ? 'Réactiver' : 'Suspendre'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDeletePlatformAdmin(entry)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal détaillée du commerce */}
        <Dialog open={!!previewTenant} onOpenChange={(open) => !open && setPreviewTenant(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                Fiche Commerce - {previewTenant?.nom_commercial}
              </DialogTitle>
            </DialogHeader>
            {previewTenant && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Proprietaire</span>
                      <span className="font-medium text-right">{previewTenant.owner_email || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Plan</span>
                      <span className="font-medium text-right">{previewTenant.subscription_plan || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Statut</span>
                      <span className="font-medium text-right">{previewTenant.active ? 'Actif' : 'Inactif'}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profil</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {previewTenant.profile ? (
                      <>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Nom etablissement</span>
                          <span className="font-medium text-right">{previewTenant.profile.nom_etablissement || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">Telephone</span>
                          <span className="font-medium text-right">{previewTenant.profile.telephone || '-'}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-amber-800">Profil commerce introuvable.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Actions admin</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      variant={previewTenant.active ? "outline" : "default"}
                      size="sm"
                      onClick={async () => {
                        await handleToggleActive(previewTenant);
                        await refetch();
                        const refreshed = await refreshTenantSnapshot(previewTenant.id);
                        if (refreshed) setPreviewTenant(refreshed);
                      }}
                    >
                      {previewTenant.active ? 'Desactiver le commerce' : 'Activer le commerce'}
                    </Button>
                    <Button
                      variant={previewTenant.pos_suspended ? "default" : "outline"}
                      size="sm"
                      onClick={async () => {
                        await handleTogglePOS(previewTenant);
                        await refetch();
                        const refreshed = await refreshTenantSnapshot(previewTenant.id);
                        if (refreshed) setPreviewTenant(refreshed);
                      }}
                    >
                      {previewTenant.pos_suspended ? 'Reactiver la caisse' : 'Suspendre la caisse'}
                    </Button>
                  </CardContent>
                </Card>

                {previewTenant.profile && (
                  <>
                    <AdminTemplateSelector tenant={previewTenant} onSaved={() => refetch()} />

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Modules</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Borne de commande', field: 'manages_kiosk' },
                          { label: 'Ecran client', field: 'customer_display_enabled' },
                          { label: 'Plan de tables autorise', field: 'table_plan_allowed' },
                          { label: 'Commande en ligne', field: 'manages_web_ordering' },
                          { label: 'Application livreur autorisee', field: 'delivery_app_allowed' },
                          { label: 'IA images', field: 'ai_image_generation_enabled' },
                        ].map(({ label, field }) => {
                          const isActive = !!previewTenant.profile?.[field];
                          return (
                            <div key={field} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                              <div>
                                <p className="font-medium">{label}</p>
                                <p className="text-xs text-gray-500">{isActive ? 'Actif' : 'Inactif'}</p>
                              </div>
                              <Button
                                variant={isActive ? "destructive" : "default"}
                                size="sm"
                                onClick={async () => {
                                  await handleToggleModule(previewTenant, field);
                                  await refetch();
                                  const refreshed = await refreshTenantSnapshot(previewTenant.id);
                                  if (refreshed) setPreviewTenant(refreshed);
                                }}
                              >
                                {isActive ? 'Desactiver' : 'Activer'}
                              </Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-lg">Facturation</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(previewTenant);
                              setPreviewTenant(null);
                            }}
                          >
                            Ouvrir la gestion complete
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <span className="text-gray-500">Total facture</span>
                          <span className="font-semibold">
                            {previewInvoices.reduce((sum, inv) => sum + Number(inv.montant || 0), 0).toFixed(2)}€
                          </span>
                        </div>
                        {previewInvoices.length === 0 ? (
                          <p className="text-sm text-gray-500">Aucune facture pour ce commerce.</p>
                        ) : (
                          previewInvoices.slice(0, 5).map((invoice) => (
                            <div key={invoice.id} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{invoice.description || invoice.type || 'Facture'}</p>
                                  <p className="text-xs text-gray-500">
                                    {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'}
                                  </p>
                                  <p className="text-sm font-semibold mt-1">
                                    {Number(invoice.montant || 0).toFixed(2)}€ TTC
                                  </p>
                                </div>
                                <Badge variant={invoice.statut === 'payee' ? 'success' : invoice.statut === 'en_attente' ? 'outline' : 'destructive'}>
                                  {invoice.statut}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Button variant="outline" size="sm" onClick={() => downloadInvoice(invoice)}>
                                  <Download className="w-4 h-4 mr-1" />
                                  PDF
                                </Button>
                                {isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee' && !hasRecurringPayments(invoice) && (
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={async () => {
                                      await markAsPaidMutation.mutateAsync(invoice);
                                      await refetchPreviewInvoices();
                                    }}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Marquer payee
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    if (!confirm('Supprimer cette facture ?')) return;
                                    await deleteInvoiceMutation.mutateAsync(invoice.id);
                                    await refetchPreviewInvoices();
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Supprimer
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                Fiche Commerce - {selectedTenant?.nom_commercial}
              </DialogTitle>
            </DialogHeader>
            {selectedTenant && (
              <Tabs defaultValue="modules" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="modules">Modules</TabsTrigger>
                  <TabsTrigger value="invoices">Factures</TabsTrigger>
                  <TabsTrigger value="history">Historique</TabsTrigger>
                </TabsList>

                <TabsContent value="modules" className="space-y-4 mt-4">
                  <AdminSectionBoundary>
                  {selectedProfile ? (
                    <AdminTemplateSelector tenant={selectedTenant} onSaved={() => refetch()} />
                  ) : (
                    <Card className="border-amber-200">
                      <CardContent className="pt-6 text-sm text-amber-800">
                        Le profil du commerce est introuvable. Rechargez la liste ou recreez le profil avant de gerer les modules.
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Activation des modules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: 'Borne de commande', desc: 'Interface client pour commandes automatiques', field: 'manages_kiosk', icon: Monitor, color: 'text-blue-600' },
                        { label: 'Écran client', desc: 'Affichage secondaire pour le client', field: 'customer_display_enabled', icon: Monitor, color: 'text-green-600' },
                        { label: 'Plan de tables', desc: 'Autoriser le client à activer/désactiver le plan de tables', field: 'table_plan_allowed', icon: LayoutGrid, color: 'text-purple-600' },
                        { label: 'Commande en ligne (Web)', desc: null, field: 'manages_web_ordering', icon: Store, color: 'text-orange-600' },
                        { label: 'Application livreur', desc: 'Autoriser le client a activer/desactiver l application livreur', field: 'delivery_app_allowed', icon: Truck, color: 'text-cyan-600' },
                        { label: 'Génération d\'images IA', desc: 'Bouton IA visible dans les fiches produits/catégories', field: 'ai_image_generation_enabled', icon: Wand2, color: 'text-purple-600' },
                      ].map(({ label, desc, field, icon: Icon, color }) => {
                        const isActive = !!selectedProfile?.[field];
                        return (
                          <div key={field} className={`flex items-center justify-between p-3 border-2 rounded-lg ${isActive ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                          <Icon className={`w-5 h-5 ${color}`} />
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <p className="font-semibold">{label}</p>
                                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-gray-500'}`}></span>
                                                {isActive ? 'ACTIF' : 'INACTIF'}
                                              </span>
                                            </div>
                                            {desc && <p className="text-xs text-gray-500">{desc}</p>}
                                            {field === 'manages_web_ordering' && (
                                              <a
                                                  href={`${window.location.origin}/OrderOnline?slug=${selectedTenant?.slug || ''}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-orange-600 hover:underline font-medium"
                                                >
                                                  🔗 Voir le site : /OrderOnline?slug={selectedTenant?.slug}
                                                </a>
                                            )}
                                          </div>
                                        </div>
                            <Button
                              variant={isActive ? "destructive" : "default"}
                              size="sm"
                              disabled={!selectedProfile}
                              onClick={() => handleToggleModule(selectedTenant, field)}
                            >
                              {isActive ? 'Désactiver' : 'Activer'}
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Domaine du site web</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!selectedProfile?.manages_web_ordering ? (
                        <div className="text-sm text-gray-500">
                          Activez d'abord le module `Commande en ligne` pour utiliser un domaine personnalisé.
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="tenant-custom-domain">Nom de domaine public</Label>
                            <Input
                              id="tenant-custom-domain"
                              value={tenantDomainDraft}
                              onChange={(e) => setTenantDomainDraft(e.target.value)}
                              placeholder="www.mondomaine.fr"
                            />
                            <p className="text-xs text-gray-500">
                              Saisir uniquement le domaine, sans `https://` ni chemin.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={selectedProfile?.domain_verified ? "success" : "outline"}>
                              {selectedProfile?.domain_verified ? "Vérifié" : "À vérifier"}
                            </Badge>
                            {normalizeCustomDomain(tenantDomainDraft) && (
                              <span className="text-xs text-gray-500 font-mono">
                                https://{normalizeCustomDomain(tenantDomainDraft)}
                              </span>
                            )}
                          </div>

                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-orange-500" />
                              <p className="text-sm font-semibold text-gray-800">Guide d’utilisation</p>
                            </div>
                            <div className="space-y-2 text-xs text-gray-600">
                              <p>1. Saisir le domaine public du commerçant, par exemple `www.mondomaine.fr`.</p>
                              <p>2. Enregistrer le domaine dans cette fiche tenant.</p>
                              <p>3. Donner au commerçant la configuration DNS ci-dessous à créer chez son hébergeur (IONOS, OVH, Cloudflare, etc.).</p>
                              <p>4. Une fois le DNS propagé, vérifier le domaine puis tester l’URL publique.</p>
                            </div>
                          </div>

                          {normalizeCustomDomain(tenantDomainDraft) ? (
                            <>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                                <p className="text-sm font-semibold text-emerald-800">URL publique attendue</p>
                                <div className="rounded border border-blue-100 bg-white p-3 space-y-2">
                                  <p className="font-semibold text-blue-900">Texte pret a copier pour IONOS</p>
                                  <code className="block break-all text-blue-900">
                                    Type: CNAME | Hote: www | Pointe vers: {window.location.hostname}
                                  </code>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(`Type: CNAME | Hote: www | Pointe vers: ${window.location.hostname}`, 'Configuration IONOS')}
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    {copiedValue === 'Configuration IONOS' ? 'Copie' : 'Copier pour IONOS'}
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 rounded bg-white px-3 py-2 text-xs text-emerald-900 border border-emerald-100 break-all">
                                    https://{normalizeCustomDomain(tenantDomainDraft)}
                                  </code>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(`https://${normalizeCustomDomain(tenantDomainDraft)}`, 'URL publique')}
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    {copiedValue === 'URL publique' ? 'Copié' : 'Copier'}
                                  </Button>
                                </div>
                              </div>

                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3 text-xs text-blue-800">
                                <p className="text-sm font-semibold">Informations à donner à l’hébergeur du domaine</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div className="rounded border border-blue-100 bg-white p-2">
                                    <p className="text-gray-500 mb-1">Type DNS</p>
                                    <p className="font-mono">CNAME</p>
                                  </div>
                                  <div className="rounded border border-blue-100 bg-white p-2">
                                    <p className="text-gray-500 mb-1">Nom / Hôte</p>
                                    <p className="font-mono">www</p>
                                  </div>
                                  <div className="rounded border border-blue-100 bg-white p-2">
                                    <p className="text-gray-500 mb-1">Valeur / Cible</p>
                                    <p className="font-mono break-all">{window.location.hostname}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(window.location.hostname, 'Cible DNS')}
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    {copiedValue === 'Cible DNS' ? 'Copié' : 'Copier la cible'}
                                  </Button>
                                  <span className="text-xs text-blue-700">Chez IONOS, la donnee importante est bien `pointe vers` = `{window.location.hostname}`.</span>
                                </div>
                              </div>

                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                                <p className="font-semibold">Recommandation d’architecture</p>
                                <p>`www.mondomaine.fr` → site public du restaurant</p>
                                <p>`app.mondomaine.fr` → caisse, admin, borne, livraison</p>
                                <p>Cette séparation évite toute confusion entre site client et back-office.</p>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
                              <p className="font-semibold text-gray-800">Infos DNS</p>
                              <p>Tu n’as pas besoin d’enregistrer d’abord.</p>
                              <p>Saisis simplement un domaine comme `www.mondomaine.fr` dans le champ ci-dessus.</p>
                              <p>Dès que le domaine est saisi, l’interface affiche automatiquement :</p>
                              <p>- l’URL publique attendue</p>
                              <p>- la ligne prête à copier pour IONOS</p>
                              <p>- la cible DNS à transmettre au commerçant</p>
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button variant="outline" disabled>
                              Vérifier le domaine
                            </Button>
                            <Button onClick={handleSaveTenantDomain}>
                              Enregistrer le domaine
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  </AdminSectionBoundary>
                </TabsContent>

                <TabsContent value="invoices" className="space-y-4 mt-4">
                  <AdminSectionBoundary>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{invoiceForm.is_devis ? 'Créer un devis' : 'Créer une facture'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>
                            {(invoiceForm.type === 'abonnement' || invoiceForm.type === 'frais_de_maintenance') 
                              ? 'Montant mensuel HT (€)' 
                              : 'Montant HT (€)'}
                          </Label>
                          <Input type="number" step="0.01" placeholder="99.00" value={invoiceForm.montant} onChange={(e) => setInvoiceForm({...invoiceForm, montant: e.target.value})} />
                        </div>
                        <div>
                          <Label>TVA (%)</Label>
                          <Input type="number" placeholder="20" value={invoiceForm.tva_taux} onChange={(e) => setInvoiceForm({...invoiceForm, tva_taux: e.target.value})} />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={invoiceForm.type ?? undefined} onValueChange={(v) => setInvoiceForm({...invoiceForm, type: v})}>
                            <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="abonnement">Abonnement</SelectItem>
                              <SelectItem value="achat_complet">Achat complet</SelectItem>
                              <SelectItem value="module_supplementaire">Module supplémentaire</SelectItem>
                              <SelectItem value="materiel">Matériel</SelectItem>
                              <SelectItem value="frais_de_maintenance">Frais de maintenance</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {invoiceForm.montant && invoiceForm.tva_taux && (
                        <div className="bg-gray-100 p-2 rounded text-sm space-y-1">
                          <p className="text-gray-700">
                            💶 {(invoiceForm.type === 'abonnement' || invoiceForm.type === 'frais_de_maintenance') ? 'Montant mensuel' : 'Total'} TTC: <span className="font-bold">{(Number(invoiceForm.montant) * (1 + Number(invoiceForm.tva_taux) / 100)).toFixed(2)}€</span>
                          </p>
                          {(invoiceForm.type === 'abonnement' || invoiceForm.type === 'frais_de_maintenance') && invoiceForm.duree_mois && (
                            <p className="text-gray-700">
                              💰 Total sur {invoiceForm.duree_mois} mois: <span className="font-bold">{(Number(invoiceForm.montant) * (1 + Number(invoiceForm.tva_taux) / 100) * invoiceForm.duree_mois).toFixed(2)}€</span>
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={invoiceForm.is_devis} 
                            onChange={(e) => setInvoiceForm({...invoiceForm, is_devis: e.target.checked})}
                            className="w-4 h-4"
                          />
                          <span className="font-semibold">Créer un devis</span>
                        </Label>
                        <p className="text-xs text-gray-500">(Au lieu d'une facture)</p>
                      </div>

                      <div>
                        <Label>Date de facturation</Label>
                        <Input type="date" value={invoiceForm.date_facturation} onChange={(e) => setInvoiceForm({...invoiceForm, date_facturation: e.target.value})} />
                      </div>
                      
                      {(invoiceForm.type === 'abonnement' || invoiceForm.type === 'frais_de_maintenance') && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                          <p className="text-sm font-semibold text-blue-800">Paramètres paiements mensuels</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Début de période</Label>
                              <Input type="date" value={invoiceForm.periode_debut} onChange={(e) => setInvoiceForm({...invoiceForm, periode_debut: e.target.value})} />
                            </div>
                            <div>
                              <Label className="text-xs">Durée (mois)</Label>
                              <Input type="number" min="1" value={invoiceForm.duree_mois} onChange={(e) => setInvoiceForm({...invoiceForm, duree_mois: parseInt(e.target.value) || 12})} />
                            </div>
                          </div>
                          <p className="text-xs text-blue-700">
                            💡 Le client paiera <span className="font-bold">{invoiceForm.montant && invoiceForm.tva_taux ? (Number(invoiceForm.montant) * (1 + Number(invoiceForm.tva_taux) / 100)).toFixed(2) : '0.00'}€ TTC</span> chaque mois pendant {invoiceForm.duree_mois || 12} mois
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <Label>Description</Label>
                        <Textarea placeholder="Détails de la facture..." value={invoiceForm.description} onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})} />
                      </div>
                      <div>
                        <Label>Matériel fourni (optionnel)</Label>
                        <Textarea placeholder="Ex: 2x Tablette Samsung, 1x Imprimante thermique..." value={invoiceForm.materiel || ''} onChange={(e) => setInvoiceForm({...invoiceForm, materiel: e.target.value})} />
                      </div>

                      {/* Section lignes de matériel */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-purple-800">Lignes de matériel (avec prix détaillé)</Label>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline"
                            onClick={() => setInvoiceForm({
                              ...invoiceForm, 
                              lignes_materiel: [...(invoiceForm.lignes_materiel || []), { designation: '', quantite: 1, prix_unitaire_ht: 0, tva_taux: 20 }]
                            })}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Ajouter ligne
                          </Button>
                        </div>
                        {invoiceForm.lignes_materiel && invoiceForm.lignes_materiel.length > 0 && (
                          <div className="space-y-2">
                            {invoiceForm.lignes_materiel.map((ligne, index) => (
                              <div key={index} className="bg-white border rounded p-2 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input 
                                    placeholder="Désignation (ex: Tablette Samsung)" 
                                    value={ligne.designation}
                                    onChange={(e) => {
                                      const newLignes = [...invoiceForm.lignes_materiel];
                                      newLignes[index].designation = e.target.value;
                                      setInvoiceForm({...invoiceForm, lignes_materiel: newLignes});
                                    }}
                                    className="flex-1"
                                  />
                                  <Button 
                                    type="button"
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => {
                                      const newLignes = invoiceForm.lignes_materiel.filter((_, i) => i !== index);
                                      setInvoiceForm({...invoiceForm, lignes_materiel: newLignes});
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Quantité</Label>
                                    <Input 
                                      type="number" 
                                      min="1"
                                      value={ligne.quantite}
                                      onChange={(e) => {
                                        const newLignes = [...invoiceForm.lignes_materiel];
                                        newLignes[index].quantite = Number(e.target.value);
                                        setInvoiceForm({...invoiceForm, lignes_materiel: newLignes});
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Prix HT (€)</Label>
                                    <Input 
                                      type="number" 
                                      step="0.01"
                                      value={ligne.prix_unitaire_ht}
                                      onChange={(e) => {
                                        const newLignes = [...invoiceForm.lignes_materiel];
                                        newLignes[index].prix_unitaire_ht = Number(e.target.value);
                                        setInvoiceForm({...invoiceForm, lignes_materiel: newLignes});
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">TVA (%)</Label>
                                    <Input 
                                      type="number"
                                      value={ligne.tva_taux}
                                      onChange={(e) => {
                                        const newLignes = [...invoiceForm.lignes_materiel];
                                        newLignes[index].tva_taux = Number(e.target.value);
                                        setInvoiceForm({...invoiceForm, lignes_materiel: newLignes});
                                      }}
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600">
                                  Total ligne TTC: <span className="font-semibold">{(ligne.quantite * ligne.prix_unitaire_ht * (1 + ligne.tva_taux / 100)).toFixed(2)}€</span>
                                </p>
                              </div>
                            ))}
                            <div className="bg-purple-100 p-2 rounded text-sm font-semibold text-purple-900">
                              Total matériel TTC: {invoiceForm.lignes_materiel.reduce((acc, l) => acc + (l.quantite * l.prix_unitaire_ht * (1 + l.tva_taux / 100)), 0).toFixed(2)}€
                            </div>
                          </div>
                        )}
                      </div>

                      <Button onClick={handleCreateInvoice} className="w-full" disabled={createInvoiceMutation.isPending}>
                        {createInvoiceMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : <><FileText className="w-4 h-4 mr-2" />{invoiceForm.is_devis ? 'Créer le devis' : 'Créer la facture'}</>}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Factures ({invoices.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {invoices.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Aucune facture</p>
                      ) : (
                        <div className="space-y-3">
                          {invoices.map((invoice) => (
                            <div key={invoice.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">{Number(invoice.montant || 0).toFixed(2)}€ TTC - {invoice.type}</p>
                                    {invoice.is_devis && (
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">DEVIS</Badge>
                                    )}
                                    <Badge variant={invoice.statut === 'payee' ? 'success' : invoice.statut === 'en_attente' ? 'outline' : 'destructive'}>
                                      {invoice.statut}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    N° {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'} - {invoice.date_facturation ? new Date(invoice.date_facturation).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                  </p>
                                  {invoice.tva_taux && <p className="text-xs text-gray-600">TVA {invoice.tva_taux}%</p>}
                                  {invoice.description && <p className="text-xs text-gray-600 mt-1">{invoice.description}</p>}
                                  {invoice.materiel && <p className="text-xs text-gray-600 mt-1"><strong>Matériel:</strong> {invoice.materiel}</p>}
                                  {invoice.lignes_materiel && invoice.lignes_materiel.length > 0 && (
                                    <div className="mt-2 text-xs text-gray-600">
                                      <strong>Lignes matériel:</strong>
                                      <ul className="ml-3 mt-1 space-y-0.5">
                                        {(invoice.lignes_materiel || []).map((ligne, idx) => (
                                          <li key={idx}>• {ligne.designation} (x{ligne.quantite}) - {(ligne.quantite * ligne.prix_unitaire_ht * (1 + ligne.tva_taux / 100)).toFixed(2)}€ TTC</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => downloadInvoice(invoice)}>
                                    <Download className="w-4 h-4 mr-1" />
                                    PDF
                                  </Button>
                                  {isPaymentRequestInvoice(invoice) && invoice.statut !== 'payee' && !hasRecurringPayments(invoice) && (
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      onClick={() => markAsPaidMutation.mutate(invoice)}
                                      disabled={markAsPaidMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => {
                                      if (confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
                                        deleteInvoiceMutation.mutate(invoice.id);
                                      }
                                    }}
                                    disabled={deleteInvoiceMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {hasRecurringPayments(invoice) && isPaymentRequestInvoice(invoice) && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-xs font-semibold mb-2">Paiements mensuels:</p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(invoice.monthly_payments || {}).map(([month, payment]) => (
                                      <div key={month} className={`flex items-center justify-between p-2 rounded text-xs ${payment.paye ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border'}`}>
                                        <div>
                                          <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                                          <p className="text-gray-600">{Number(payment.montant || 0).toFixed(2)}€</p>
                                        </div>
                                        <button
                                          onClick={() => handleToggleMonthlyPayment(invoice, month)}
                                          className={`w-6 h-6 rounded flex items-center justify-center ${payment.paye ? 'bg-green-500 text-white' : 'bg-gray-300 hover:bg-gray-400'}`}
                                        >
                                          {payment.paye ? '✓' : '✗'}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  </AdminSectionBoundary>
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-4">
                  <AdminSectionBoundary>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Historique du commerce</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 border-b">
                          <span className="text-gray-600">Créé le :</span>
                          <span className="font-semibold">{new Date(selectedTenant.created_date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div className="flex justify-between p-2 border-b">
                          <span className="text-gray-600">Propriétaire :</span>
                          <span className="font-semibold">{selectedTenant.owner_email}</span>
                        </div>
                        <div className="flex justify-between p-2 border-b">
                          <span className="text-gray-600">Statut :</span>
                          <Badge variant={selectedTenant.active ? "success" : "secondary"}>
                            {selectedTenant.active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                        <div className="flex justify-between p-2 border-b">
                          <span className="text-gray-600">Plan :</span>
                          <Badge variant="outline">{selectedTenant.subscription_plan}</Badge>
                        </div>
                        {selectedTenant.stripe_subscription_id && (
                          <div className="flex justify-between p-2 border-b">
                            <span className="text-gray-600">ID Abonnement Stripe :</span>
                            <span className="font-mono text-xs">{selectedTenant.stripe_subscription_id}</span>
                          </div>
                        )}
                        <div className="flex justify-between p-2">
                          <span className="text-gray-600">Total facturé :</span>
                          <span className="font-bold text-green-600">
                            {invoices.reduce((sum, inv) => sum + Number(inv.montant || 0), 0).toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Résumé des abonnements actifs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        État des abonnements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {invoices.filter(inv => isPaymentRequestInvoice(inv) && hasRecurringPayments(inv)).length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Aucun abonnement actif</p>
                      ) : (
                        <div className="space-y-3">
                          {invoices
                            .filter(inv => isPaymentRequestInvoice(inv) && hasRecurringPayments(inv))
                            .map((invoice) => {
                              const payments = Object.entries(invoice.monthly_payments || {});
                              const paidCount = payments.filter(([_, p]) => p.paye).length;
                              const failedCount = payments.filter(([_, p]) => p.echec).length;
                              const totalPayments = payments.length;
                              
                              return (
                                <div key={invoice.id} className="border rounded-lg p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="font-semibold">{invoice.description || invoice.type}</p>
                                      <p className="text-xs text-gray-600">
                                        Facture N° {invoice.numero_facture || invoice.id?.substring(0, 8) || 'N/A'}
                                      </p>
                                    </div>
                                    <Badge variant={paidCount === totalPayments ? "success" : failedCount > 0 ? "destructive" : "outline"}>
                                      {paidCount}/{totalPayments} payés
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-green-100 text-green-800 p-2 rounded text-center">
                                      <p className="font-bold">{paidCount}</p>
                                      <p>Payés</p>
                                    </div>
                                    <div className="bg-orange-100 text-orange-800 p-2 rounded text-center">
                                      <p className="font-bold">{totalPayments - paidCount - failedCount}</p>
                                      <p>En attente</p>
                                    </div>
                                    {failedCount > 0 && (
                                      <div className="bg-red-100 text-red-800 p-2 rounded text-center">
                                        <p className="font-bold">{failedCount}</p>
                                        <p>Échecs</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  </AdminSectionBoundary>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="tenants" className="w-full">
          <TabsList>
            <TabsTrigger value="tenants">Commerces ({tenants.length})</TabsTrigger>
            <TabsTrigger value="requests">Demandes ({pendingRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <CardTitle>Commerces enregistrés ({tenants.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {tenants.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucun commerce enregistré</p>
                ) : (
                  <div className="space-y-3">
                    {tenantsWithProfiles.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <Store className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{tenant.nom_commercial}</h3>
                            <p className="text-sm text-gray-600">Propriétaire: {tenant.owner_email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={tenant.active ? "success" : "secondary"}>
                                {tenant.active ? 'Actif' : 'Inactif'}
                              </Badge>
                              <Badge variant="outline">{tenant.subscription_plan}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setPreviewTenant(tenant)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Voir
                          </Button>
                          <Button
                            variant={tenant.pos_suspended ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleTogglePOS(tenant)}
                            className={tenant.pos_suspended ? "bg-orange-500 hover:bg-orange-600 text-white" : "border-orange-400 text-orange-600 hover:bg-orange-50"}
                          >
                            {tenant.pos_suspended ? '🔓 Caisse' : '🔒 Caisse'}
                          </Button>
                          <Button variant={tenant.active ? "outline" : "default"} size="sm" onClick={() => handleToggleActive(tenant)}>
                            {tenant.active ? 'Désactiver' : 'Activer'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(tenant)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Nouvelles demandes ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune demande en attente</p>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg">{req.nom_commercial}</h3>
                            <p className="text-sm text-gray-600">{req.prenom_contact} {req.nom_contact}</p>
                          </div>
                          <Badge className="bg-orange-500">{req.formule_choisie === 'essai' ? 'Essai' : 'Abonnement'}</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-sm mb-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-500" />
                            {req.email}
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            {req.telephone}
                          </div>
                          {req.adresse && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              {req.adresse}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {new Date(req.created_date).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        {req.message && <p className="text-sm bg-white p-2 rounded mb-3">{req.message}</p>}
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" onClick={() => handleAcceptAndCreate(req)} disabled={isCreating}>
                            {isCreating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Création...</> : <><CheckCircle className="w-4 h-4 mr-1" />Accepter & Créer</>}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleRequestAction(req.id, 'refuse')}>❌ Refuser</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
