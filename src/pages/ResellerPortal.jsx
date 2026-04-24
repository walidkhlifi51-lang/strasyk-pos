import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Handshake, Store, Euro, CreditCard, Palette, Users } from 'lucide-react';

const currency = (value) => `${Number(value || 0).toFixed(2)}€`;

export default function ResellerPortal() {
  const { currentReseller, isReseller } = useTenant();

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
    .filter((item) => item.tenant);

  const pendingCommissions = commissions
    .filter((item) => item.status === 'pending')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const paidCommissions = commissions
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const cards = [
    { title: 'Commerces actifs', value: linkedTenants.filter((item) => item.assignment.status === 'active').length, icon: Store, accent: 'bg-blue-600' },
    { title: 'Commissions pending', value: currency(pendingCommissions), icon: Euro, accent: 'bg-amber-500' },
    { title: 'Commissions payees', value: currency(paidCommissions), icon: CreditCard, accent: 'bg-emerald-600' },
    { title: 'Equipe revendeur', value: resellerUsers.length, icon: Users, accent: 'bg-violet-600' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Espace revendeur</h1>
        <p className="text-gray-600 mt-1">
          Suivi de votre portefeuille commerces, de vos commissions et de votre branding.
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
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{currentReseller.type === 'white_label' ? 'White label' : 'Standard'}</Badge>
            <Badge className={currentReseller.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
              {currentReseller.status === 'active' ? 'Actif' : 'Suspendu'}
            </Badge>
            {currentReseller.contact_email && <Badge variant="outline">{currentReseller.contact_email}</Badge>}
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

        <TabsContent value="clients" className="mt-4">
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
                  <div key={assignment.id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{tenant.nom_commercial}</p>
                      <p className="text-xs text-gray-500 mt-1">Plan: {assignment.subscription_plan || tenant.subscription_plan || 'Non defini'}</p>
                    </div>
                    <Badge variant="outline">{assignment.status}</Badge>
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
                    <Badge variant="outline">{item.status}</Badge>
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
