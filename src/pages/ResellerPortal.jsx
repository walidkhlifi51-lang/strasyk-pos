import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from 'lucide-react';
import {
  buildTenantOwnerInviteMessage,
  createTenantAndResolve,
  normalizeEmail,
  resolveTenantByOwnerEmail,
} from '@/lib/tenantProvisioning';

const currency = (value) => `${Number(value || 0).toFixed(2)} EUR`;

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
  const { currentReseller, isReseller, resellerRole } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newClientForm, setNewClientForm] = React.useState(createClientForm());
  const [submitFeedback, setSubmitFeedback] = React.useState({ type: '', message: '' });

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
      ] = await Promise.all([
        appClient.entities.ResellerTenant.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.Tenant.list('-created_date'),
        appClient.entities.ResellerBranding.filter({ reseller_id: currentReseller.id }, '-created_date', 5),
        appClient.entities.ResellerCommission.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerPayout.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerUser.filter({ reseller_id: currentReseller.id }, '-created_date'),
      ]);

      return {
        resellerTenants,
        tenants,
        branding: brandingList[0] || null,
        commissions,
        payouts,
        resellerUsers,
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

  const linkedTenants = resellerTenants
    .map((assignment) => ({
      assignment,
      tenant: tenants.find((tenant) => tenant.id === assignment.tenant_id) || null,
    }))
    .filter((item) => item.tenant)
    .sort((a, b) => new Date(b.assignment.created_date || 0) - new Date(a.assignment.created_date || 0));

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

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
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

                  <div className="text-xs text-orange-700">
                    Debug portail revendeur actif
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
                      onClick={() => copyOwnerInvite({ tenantId: tenant.id, email: tenant.owner_email, label: tenant.nom_commercial })}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copier invitation client
                    </Button>
                  </div>
                ))
              )}
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
