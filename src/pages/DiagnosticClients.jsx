import React, { useState, useEffect } from "react";
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

export default function DiagnosticClients() {
  const { currentTenant, currentUser, filterByTenant } = useTenant();
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      // 1. Charger TOUS les clients sans filtre
      const allClientsNoFilter = await appClient.entities.Customer.list();
      
      // 2. Charger les clients avec filtre tenant
      const clientsWithFilter = await appClient.entities.Customer.filter(filterByTenant());
      
      // 3. Charger toutes les commandes
      const allOrders = await appClient.entities.Order.filter(filterByTenant());

      const result = {
        currentTenantId: currentTenant?.id,
        currentUserEmail: currentUser?.email,
        totalClientsNoFilter: allClientsNoFilter.length,
        totalClientsWithFilter: clientsWithFilter.length,
        totalOrders: allOrders.length,
        clientsDetails: allClientsNoFilter.map(c => ({
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          telephone: c.telephone,
          tenant_id: c.tenant_id,
          matchesTenant: c.tenant_id === currentTenant?.id
        })),
        ordersWithCustomers: allOrders.filter(o => o.customer_id).map(o => ({
          orderId: o.id,
          numero: o.numero_caisse,
          customerId: o.customer_id,
          customerFound: clientsWithFilter.find(c => c.id === o.customer_id) ? 'OUI' : 'NON',
          customerTenantId: allClientsNoFilter.find(c => c.id === o.customer_id)?.tenant_id
        }))
      };

      setDiagnostic(result);
    } catch (error) {
      console.error("Erreur diagnostic:", error);
      setDiagnostic({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTenant) {
      runDiagnostic();
    }
  }, [currentTenant]);

  if (!diagnostic) {
    return (
      <div className="p-8">
        <Button onClick={runDiagnostic} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Lancer le diagnostic
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Diagnostic Clients & Commandes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded">
              <div className="font-bold">Votre Tenant ID</div>
              <div className="font-mono text-sm">{diagnostic.currentTenantId}</div>
            </div>
            <div className="p-4 bg-green-50 rounded">
              <div className="font-bold">Votre Email</div>
              <div className="font-mono text-sm">{diagnostic.currentUserEmail}</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded">
              <div className="font-bold">Clients SANS filtre</div>
              <div className="text-2xl">{diagnostic.totalClientsNoFilter}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded">
              <div className="font-bold">Clients AVEC filtre</div>
              <div className="text-2xl">{diagnostic.totalClientsWithFilter}</div>
            </div>
          </div>

          <Button onClick={runDiagnostic} disabled={loading} className="mt-4">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📋 Détails de tous les clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {diagnostic.clientsDetails.map(client => (
              <div 
                key={client.id} 
                className={`p-3 border rounded ${client.matchesTenant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{client.prenom} {client.nom}</div>
                    <div className="text-sm text-gray-600">{client.telephone}</div>
                    <div className="text-xs font-mono">ID: {client.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">Tenant ID du client:</div>
                    <div className="font-mono text-sm">{client.tenant_id || 'NULL'}</div>
                    {client.matchesTenant ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-1" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🛒 Commandes avec clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {diagnostic.ordersWithCustomers.map(order => (
              <div 
                key={order.orderId}
                className={`p-3 border rounded ${order.customerFound === 'OUI' ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold">Commande #{order.numero}</div>
                    <div className="text-xs font-mono">Customer ID: {order.customerId}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${order.customerFound === 'OUI' ? 'text-green-600' : 'text-red-600'}`}>
                      Client trouvé: {order.customerFound}
                    </div>
                    <div className="text-xs">Tenant ID: {order.customerTenantId || 'NULL'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
