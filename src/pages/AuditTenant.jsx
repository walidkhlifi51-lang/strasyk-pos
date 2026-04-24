import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, RefreshCw, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditTenant() {
  const { currentTenant, filterByTenant } = useTenant();
  const [showAllData, setShowAllData] = useState(false);

  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['tenantAudit', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) {
        throw new Error('Tenant non chargé');
      }

      console.log('🔍 [AUDIT] Démarrage de l\'audit tenant...');
      console.log('🎯 [AUDIT] Tenant actuel:', currentTenant);

      const [
        allOrders,
        allCustomers,
        allProducts,
        allCategories,
        allTenants
      ] = await Promise.all([
        appClient.entities.Order.list('-created_date', 500),
        appClient.entities.Customer.list(),
        appClient.entities.Product.list(),
        appClient.entities.Category.list(),
        appClient.entities.Tenant.list()
      ]);

      console.log('📊 [AUDIT] Données chargées:');
      console.log('  Commandes totales:', allOrders.length);
      console.log('  Clients totaux:', allCustomers.length);
      console.log('  Produits totaux:', allProducts.length);
      console.log('  Catégories totales:', allCategories.length);
      console.log('  Tenants totaux:', allTenants.length);

      const ordersSansTenant = allOrders.filter(o => !o.tenant_id);
      const ordersAutreTenant = allOrders.filter(o => o.tenant_id && o.tenant_id !== currentTenant.id);
      const ordersMonTenant = allOrders.filter(o => o.tenant_id === currentTenant.id);

      console.log('📋 [AUDIT] Commandes:');
      console.log('  Sans tenant_id:', ordersSansTenant.length);
      console.log('  Autre tenant:', ordersAutreTenant.length);
      console.log('  Mon tenant:', ordersMonTenant.length);

      const customersSansTenant = allCustomers.filter(c => !c.tenant_id);
      const customersAutreTenant = allCustomers.filter(c => c.tenant_id && c.tenant_id !== currentTenant.id);
      const customersMonTenant = allCustomers.filter(c => c.tenant_id === currentTenant.id);

      console.log('👥 [AUDIT] Clients:');
      console.log('  Sans tenant_id:', customersSansTenant.length);
      console.log('  Autre tenant:', customersAutreTenant.length);
      console.log('  Mon tenant:', customersMonTenant.length);

      const productsSansTenant = allProducts.filter(p => !p.tenant_id);
      const productsAutreTenant = allProducts.filter(p => p.tenant_id && p.tenant_id !== currentTenant.id);
      const productsMonTenant = allProducts.filter(p => p.tenant_id === currentTenant.id);

      console.log('📦 [AUDIT] Produits:');
      console.log('  Sans tenant_id:', productsSansTenant.length);
      console.log('  Autre tenant:', productsAutreTenant.length);
      console.log('  Mon tenant:', productsMonTenant.length);

      const ordersCroisees = allOrders.filter(order => {
        if (!order.customer_id) return false;
        const customer = allCustomers.find(c => c.id === order.customer_id);
        if (!customer) return false;
        return order.tenant_id !== customer.tenant_id;
      });

      console.log('⚠️ [AUDIT] Commandes avec client d\'un autre tenant:', ordersCroisees.length);

      return {
        currentTenantId: currentTenant.id,
        currentTenantNom: currentTenant.nom_commercial || currentTenant.slug || 'N/A',
        allTenants,
        
        orders: {
          total: allOrders.length,
          sansTenant: ordersSansTenant,
          autreTenant: ordersAutreTenant,
          monTenant: ordersMonTenant
        },
        
        customers: {
          total: allCustomers.length,
          sansTenant: customersSansTenant,
          autreTenant: customersAutreTenant,
          monTenant: customersMonTenant
        },
        
        products: {
          total: allProducts.length,
          sansTenant: productsSansTenant,
          autreTenant: productsAutreTenant,
          monTenant: productsMonTenant
        },
        
        categories: {
          total: allCategories.length,
          sansTenant: allCategories.filter(c => !c.tenant_id),
          autreTenant: allCategories.filter(c => c.tenant_id && c.tenant_id !== currentTenant.id),
          monTenant: allCategories.filter(c => c.tenant_id === currentTenant.id)
        },
        
        crossTenantOrders: ordersCroisees
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 0,
    refetchOnWindowFocus: false
  });

  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Tenant non chargé</h2>
            <p className="text-gray-600">Impossible d'effectuer l'audit sans tenant actif.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Audit en cours...</p>
        </div>
      </div>
    );
  }

  const hasErrors = auditData && (
    auditData.orders.sansTenant.length > 0 ||
    auditData.orders.autreTenant.length > 0 ||
    auditData.customers.sansTenant.length > 0 ||
    auditData.customers.autreTenant.length > 0 ||
    auditData.products.sansTenant.length > 0 ||
    auditData.products.autreTenant.length > 0 ||
    auditData.crossTenantOrders.length > 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-600" />
              Audit d'Isolation des Données
            </h1>
            <p className="text-gray-600 mt-2">
              Commerce actuel: <strong>{auditData?.currentTenantNom}</strong>
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        <Card className={`border-4 ${hasErrors ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {hasErrors ? (
                <AlertTriangle className="w-16 h-16 text-red-600" />
              ) : (
                <CheckCircle className="w-16 h-16 text-green-600" />
              )}
              <div>
                <h2 className={`text-2xl font-bold ${hasErrors ? 'text-red-900' : 'text-green-900'}`}>
                  {hasErrors ? '🚨 FUITES DÉTECTÉES !' : '✅ Isolation correcte'}
                </h2>
                <p className={`${hasErrors ? 'text-red-700' : 'text-green-700'}`}>
                  {hasErrors 
                    ? 'Des données sont visibles ou accessibles entre plusieurs commerces.' 
                    : 'Aucune fuite détectée - Tous les enregistrements sont correctement isolés.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenants dans la base</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditData?.allTenants.map(tenant => (
                <div key={tenant.id} className={`p-3 rounded-lg border-2 ${tenant.id === currentTenant.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">{tenant.nom_commercial || tenant.slug}</p>
                      <p className="text-xs text-gray-600">ID: {tenant.id}</p>
                    </div>
                    {tenant.id === currentTenant.id && (
                      <Badge className="bg-blue-600">VOUS</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          
          <Card className={auditData?.orders.autreTenant.length > 0 || auditData?.orders.sansTenant.length > 0 ? 'border-red-300' : 'border-green-300'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Commandes</span>
                <Badge variant={auditData?.orders.autreTenant.length > 0 || auditData?.orders.sansTenant.length > 0 ? 'destructive' : 'success'}>
                  {auditData?.orders.monTenant.length} / {auditData?.orders.total}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>✅ Mon tenant</span>
                <span className="font-bold">{auditData?.orders.monTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.orders.autreTenant.length > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <span>⚠️ Autres tenants</span>
                <span className="font-bold">{auditData?.orders.autreTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.orders.sansTenant.length > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}>
                <span>❌ Sans tenant_id</span>
                <span className="font-bold">{auditData?.orders.sansTenant.length}</span>
              </div>
              
              {showAllData && auditData?.orders.autreTenant.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto">
                  <p className="font-semibold text-red-700 mb-2">Commandes d'autres tenants visibles:</p>
                  {auditData.orders.autreTenant.map(order => (
                    <div key={order.id} className="text-xs p-2 bg-white border border-red-200 rounded mb-1">
                      <div>#{order.numero_caisse} - Tenant: <strong>{order.tenant_id}</strong></div>
                      <div className="text-gray-600">Total: {order.total_ttc}€ - {order.type_commande}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={auditData?.customers.autreTenant.length > 0 || auditData?.customers.sansTenant.length > 0 ? 'border-red-300' : 'border-green-300'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Clients</span>
                <Badge variant={auditData?.customers.autreTenant.length > 0 || auditData?.customers.sansTenant.length > 0 ? 'destructive' : 'success'}>
                  {auditData?.customers.monTenant.length} / {auditData?.customers.total}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>✅ Mon tenant</span>
                <span className="font-bold">{auditData?.customers.monTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.customers.autreTenant.length > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <span>⚠️ Autres tenants</span>
                <span className="font-bold">{auditData?.customers.autreTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.customers.sansTenant.length > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}>
                <span>❌ Sans tenant_id</span>
                <span className="font-bold">{auditData?.customers.sansTenant.length}</span>
              </div>
              
              {showAllData && auditData?.customers.autreTenant.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto">
                  <p className="font-semibold text-red-700 mb-2">Clients d'autres tenants visibles:</p>
                  {auditData.customers.autreTenant.map(customer => (
                    <div key={customer.id} className="text-xs p-2 bg-white border border-red-200 rounded mb-1">
                      <div>{customer.prenom} {customer.nom} - Tenant: <strong>{customer.tenant_id}</strong></div>
                      <div className="text-gray-600">{customer.telephone}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={auditData?.products.autreTenant.length > 0 || auditData?.products.sansTenant.length > 0 ? 'border-red-300' : 'border-green-300'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Produits</span>
                <Badge variant={auditData?.products.autreTenant.length > 0 || auditData?.products.sansTenant.length > 0 ? 'destructive' : 'success'}>
                  {auditData?.products.monTenant.length} / {auditData?.products.total}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>✅ Mon tenant</span>
                <span className="font-bold">{auditData?.products.monTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.products.autreTenant.length > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <span>⚠️ Autres tenants</span>
                <span className="font-bold">{auditData?.products.autreTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.products.sansTenant.length > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}>
                <span>❌ Sans tenant_id</span>
                <span className="font-bold">{auditData?.products.sansTenant.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className={auditData?.categories.autreTenant.length > 0 || auditData?.categories.sansTenant.length > 0 ? 'border-red-300' : 'border-green-300'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Catégories</span>
                <Badge variant={auditData?.categories.autreTenant.length > 0 || auditData?.categories.sansTenant.length > 0 ? 'destructive' : 'success'}>
                  {auditData?.categories.monTenant.length} / {auditData?.categories.total}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between p-2 bg-green-50 rounded">
                <span>✅ Mon tenant</span>
                <span className="font-bold">{auditData?.categories.monTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.categories.autreTenant.length > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <span>⚠️ Autres tenants</span>
                <span className="font-bold">{auditData?.categories.autreTenant.length}</span>
              </div>
              <div className={`flex justify-between p-2 rounded ${auditData?.categories.sansTenant.length > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}>
                <span>❌ Sans tenant_id</span>
                <span className="font-bold">{auditData?.categories.sansTenant.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {auditData && auditData.crossTenantOrders.length > 0 && (
          <Card className="border-red-500 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">
                🚨 Commandes avec clients d'autres tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700 mb-4">
                {auditData.crossTenantOrders.length} commande(s) pointent vers des clients d'autres commerces !
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {auditData.crossTenantOrders.map(order => {
                  const customer = [...auditData.customers.monTenant, ...auditData.customers.autreTenant].find(c => c.id === order.customer_id);
                  return (
                    <div key={order.id} className="p-2 bg-white border border-red-300 rounded text-xs">
                      <div>Commande #{order.numero_caisse} (tenant: {order.tenant_id})</div>
                      <div>→ Client: {customer?.nom} (tenant: {customer?.tenant_id})</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>10 dernières commandes (toutes sources)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Commerce</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditData && [...auditData.orders.monTenant, ...auditData.orders.autreTenant]
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .slice(0, 10)
                  .map(order => {
                    const tenant = auditData.allTenants.find(t => t.id === order.tenant_id);
                    const isMyTenant = order.tenant_id === currentTenant.id;
                    return (
                      <TableRow key={order.id} className={isMyTenant ? 'bg-green-50' : 'bg-red-50'}>
                        <TableCell className="font-mono text-xs">#{order.numero_caisse}</TableCell>
                        <TableCell className="font-mono text-xs">{order.tenant_id?.slice(0, 8)}...</TableCell>
                        <TableCell className="font-bold">
                          {tenant?.nom_commercial || tenant?.slug || 'Inconnu'}
                          {isMyTenant && <Badge className="ml-2 bg-green-600">VOUS</Badge>}
                        </TableCell>
                        <TableCell>{order.total_ttc}€</TableCell>
                        <TableCell>
                          <Badge variant={isMyTenant ? 'outline' : 'destructive'}>
                            {order.statut}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button onClick={() => setShowAllData(!showAllData)} variant="outline">
            {showAllData ? 'Masquer les détails' : 'Afficher les détails des fuites'}
          </Button>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">🔧 Actions recommandées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>1. Si vous voyez des données d'<strong>autres tenants</strong>: Les RLS ne sont PAS appliquées côté serveur</p>
            <p>2. Si vous voyez des données <strong>sans tenant_id</strong>: Migration incomplète</p>
            <p>3. Si vous voyez des <strong>liens croisés</strong>: Intégrité référentielle cassée</p>
            <p className="pt-2 font-bold">➡️ Contactez le support appClient pour activer les RLS côté serveur</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
