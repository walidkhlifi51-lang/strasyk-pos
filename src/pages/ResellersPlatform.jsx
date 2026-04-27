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
import { Building2, Handshake, Palette, Store, Euro, Plus, Link as LinkIcon, Unlink, ShieldAlert, FileText, Download, CheckCircle } from 'lucide-react';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';
import { buildTenantOwnerInviteMessage } from '@/lib/tenantProvisioning';
import { generateInvoicePDF } from '@/components/admin/InvoicePDFGenerator';
import {
  buildPlatformToResellerInvoicePayload,
  computeInvoiceStatusFromMonthlyPayments,
  computeInvoiceAmounts,
  createInvoiceForm,
  getInvoiceAmounts,
  isRecurringInvoiceType,
  isInvoiceForReseller,
  sortInvoicesByDateDesc,
} from '@/lib/invoiceDocuments';

const createEmptyResellerForm = () => ({
  name: '',
  type: 'standard',
  status: 'active',
  contact_email: '',
  contact_phone: '',
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

const currency = (value) => `${Number(value || 0).toFixed(2)}€`;

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

  const { data, isLoading } = useQuery({
    queryKey: ['resellers-platform'],
    queryFn: async () => {
      const [
        resellers,
        resellerBranding,
        resellerTenants,
        resellerUsers,
        commissions,
        payouts,
        tenants,
        invoices,
      ] = await Promise.all([
        appClient.entities.Reseller.list('-created_date'),
        appClient.entities.ResellerBranding.list('-created_date'),
        appClient.entities.ResellerTenant.list('-created_date'),
        appClient.entities.ResellerUser.list('-created_date'),
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
  const selectedResellerInvoices = sortInvoicesByDateDesc(
    invoices.filter((invoice) => isInvoiceForReseller(invoice, selectedResellerId)),
  );
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
      title: '✅ Invitation copiee',
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
        title: '❌ Invitation impossible',
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
      title: '✅ Invitation proprietaire copiee',
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
      return;
    }

    setResellerForm({
      name: selectedReseller.name || '',
      type: selectedReseller.type || 'standard',
      status: selectedReseller.status || 'active',
      contact_email: selectedReseller.contact_email || '',
      contact_phone: selectedReseller.contact_phone || '',
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
  }, [selectedBranding, selectedReseller]);

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
      toast({ title: '✅ Revendeur cree', description: created.name });
      setNewResellerForm(createEmptyResellerForm());
      setSelectedResellerId(created.id);
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
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
        notes: resellerForm.notes.trim() || null,
      });
    },
    onSuccess: async () => {
      toast({ title: '✅ Fiche revendeur enregistree' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
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
      toast({ title: '✅ Branding revendeur enregistre' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
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
      toast({ title: '✅ Commerce rattache' });
      setTenantToAttach('');
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
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
      toast({ title: '✅ Utilisateur revendeur ajoute' });
      await copyResellerInviteLink(newResellerUserForm.user_email.trim().toLowerCase(), newResellerUserForm.role, selectedReseller.id);
      setNewResellerUserForm(createEmptyResellerUserForm());
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateResellerUserMutation = useMutation({
    mutationFn: async ({ id, status }) => appClient.entities.ResellerUser.update(id, { status }),
    onSuccess: async () => {
      toast({ title: '✅ Statut utilisateur mis a jour' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const detachTenantMutation = useMutation({
    mutationFn: async (assignmentId) => appClient.entities.ResellerTenant.delete(assignmentId),
    onSuccess: async () => {
      toast({ title: '✅ Rattachement supprime' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const createResellerInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReseller?.id) throw new Error('Aucun revendeur selectionne.');
      if (!resellerInvoiceForm.type) throw new Error('Choisissez un type de facture.');
      if (!resellerInvoiceForm.montant || Number.isNaN(Number(resellerInvoiceForm.montant))) {
        throw new Error('Montant facture requis.');
      }

      return appClient.entities.TenantInvoice.create(
        buildPlatformToResellerInvoicePayload({
          form: resellerInvoiceForm,
          reseller: selectedReseller,
        }),
      );
    },
    onSuccess: async () => {
      toast({ title: '✅ Facture revendeur creee' });
      setResellerInvoiceForm(createInvoiceForm());
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const markResellerInvoicePaidMutation = useMutation({
    mutationFn: async (invoiceId) => appClient.entities.TenantInvoice.update(invoiceId, {
      statut: 'payee',
      date_paiement: new Date().toISOString().split('T')[0],
    }),
    onSuccess: async () => {
      toast({ title: '✅ Paiement valide' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const toggleResellerMonthlyPaymentMutation = useMutation({
    mutationFn: async ({ invoice, monthKey }) => {
      const updatedPayments = { ...(invoice.monthly_payments || {}) };
      const currentPayment = updatedPayments[monthKey] || {};
      updatedPayments[monthKey] = {
        ...currentPayment,
        paye: !currentPayment.paye,
        date_paiement: !currentPayment.paye ? new Date().toISOString().split('T')[0] : null,
      };
      const nextStatus = computeInvoiceStatusFromMonthlyPayments(updatedPayments);

      return appClient.entities.TenantInvoice.update(invoice.id, {
        monthly_payments: updatedPayments,
        statut: nextStatus,
        date_paiement: nextStatus === 'payee' ? new Date().toISOString().split('T')[0] : null,
      });
    },
    onSuccess: async () => {
      toast({ title: '✅ Paiement mensuel mis a jour' });
      await invalidateResellers();
    },
    onError: (error) => {
      toast({ title: '❌ Erreur', description: error.message, variant: 'destructive' });
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
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="identity">Identite</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="team">Equipe</TabsTrigger>
                  <TabsTrigger value="tenants">Commerces</TabsTrigger>
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
                      <Input value={brandingForm.primary_color} onChange={(event) => setBrandingForm((prev) => ({ ...prev, primary_color: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur secondaire</Label>
                      <Input value={brandingForm.secondary_color} onChange={(event) => setBrandingForm((prev) => ({ ...prev, secondary_color: event.target.value }))} />
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
                      <Input value={brandingForm.logo_url} onChange={(event) => setBrandingForm((prev) => ({ ...prev, logo_url: event.target.value }))} placeholder="https://..." />
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
                          <Select value={resellerInvoiceForm.type} onValueChange={(value) => setResellerInvoiceForm((prev) => ({ ...prev, type: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="abonnement">Abonnement</SelectItem>
                              <SelectItem value="achat_complet">Vente complete</SelectItem>
                              <SelectItem value="materiel">Materiel</SelectItem>
                              <SelectItem value="module_supplementaire">Module supplementaire</SelectItem>
                              <SelectItem value="frais_de_maintenance">Maintenance</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
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
                        <Button onClick={() => createResellerInvoiceMutation.mutate()} disabled={createResellerInvoiceMutation.isPending}>
                          Creer la facture
                        </Button>
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
                          selectedResellerInvoices.map((invoice) => {
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
                                {invoice.monthly_payments ? (
                                  <p className="text-xs text-blue-700">
                                    Abonnement: {amounts.monthlyAmountTTC.toFixed(2)} EUR / mois sur {Object.keys(invoice.monthly_payments).length} mois
                                  </p>
                                ) : null}
                                {invoice.description ? <p className="text-sm text-gray-600 mt-2">{invoice.description}</p> : null}
                                {invoice.monthly_payments ? (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                    {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                                      <div key={month} className={`rounded border p-2 text-xs ${payment.paye ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                        <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                                        <p>{Number(payment.montant || 0).toFixed(2)} EUR</p>
                                        <button
                                          onClick={() => toggleResellerMonthlyPaymentMutation.mutate({ invoice, monthKey: month })}
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
                              {!invoice.monthly_payments && invoice.statut !== 'payee' ? (
                                <Button
                                  size="sm"
                                  onClick={() => markResellerInvoicePaidMutation.mutate(invoice.id)}
                                  disabled={markResellerInvoicePaidMutation.isPending}
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
                </TabsContent>

                <TabsContent value="finance" className="space-y-4 mt-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Commissions pending</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {currency(selectedCommissions.filter((item) => item.status === 'pending').reduce((sum, item) => sum + Number(item.commission_amount || 0), 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Commissions payees</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {currency(selectedCommissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.commission_amount || 0), 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-gray-200 shadow-none">
                      <CardContent className="pt-6">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Payouts</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{selectedPayouts.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                    La v1 pose la structure finance. Les ecrans avances de commissions, facturation revendeur et remuneration seront branches sur ces tables sans refaire le socle.
                  </div>

                  {selectedCommissions.length > 0 && (
                    <div className="space-y-3">
                      {selectedCommissions.slice(0, 8).map((item) => (
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
