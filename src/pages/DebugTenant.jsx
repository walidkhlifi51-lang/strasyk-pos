import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenant } from '../components/contexts/TenantContext';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

export default function DebugTenant() {
  const { currentTenant, currentUser, isOwner, userRole } = useTenant();
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadDebugData = async () => {
    setLoading(true);
    try {
      const [tenants, products, categories, profiles] = await Promise.all([
        appClient.entities.Tenant.list(),
        appClient.entities.Product.list(),
        appClient.entities.Category.list(),
        appClient.entities.RestaurantProfile.list(),
      ]);

      setDebugData({
        tenants,
        products,
        categories,
        profiles,
      });
    } catch (error) {
      console.error('Erreur debug:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebugData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🔍 Debug Tenant</h1>
        <Button onClick={loadDebugData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recharger
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>👤 Utilisateur Actuel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div><strong>Email:</strong> {currentUser?.email || 'N/A'}</div>
            <div><strong>tenant_id:</strong> <Badge variant="destructive">{currentUser?.tenant_id || 'NULL'}</Badge></div>
            <div><strong>Rôle:</strong> {isOwner ? '👑 Propriétaire' : `👤 ${userRole}`}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🏪 Tenant Actuel (depuis Context)</CardTitle>
        </CardHeader>
        <CardContent>
          {currentTenant ? (
            <div className="space-y-2 font-mono text-sm">
              <div><strong>ID:</strong> <Badge>{currentTenant.id}</Badge></div>
              <div><strong>Nom:</strong> {currentTenant.nom_commercial}</div>
              <div><strong>Propriétaire:</strong> {currentTenant.owner_email}</div>
              <div><strong>Slug:</strong> {currentTenant.slug}</div>
            </div>
          ) : (
            <p className="text-red-500">❌ Aucun tenant assigné</p>
          )}
        </CardContent>
      </Card>

      {debugData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>🏪 Tous les Tenants (ce que je vois)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {debugData.tenants.map(t => (
                  <div key={t.id} className="p-3 border rounded bg-gray-50">
                    <div className="font-semibold">{t.nom_commercial}</div>
                    <div className="text-sm text-gray-600">ID: {t.id}</div>
                    <div className="text-sm text-gray-600">Owner: {t.owner_email}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📦 Produits visibles ({debugData.products.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {debugData.products.length === 0 ? (
                <p className="text-gray-500">Aucun produit visible</p>
              ) : (
                <div className="space-y-2">
                  {debugData.products.map(p => (
                    <div key={p.id} className="p-2 border rounded text-sm">
                      <div><strong>{p.nom}</strong></div>
                      <div className="text-xs text-gray-600">tenant_id: {p.tenant_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📁 Catégories visibles ({debugData.categories.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {debugData.categories.length === 0 ? (
                <p className="text-gray-500">Aucune catégorie visible</p>
              ) : (
                <div className="space-y-2">
                  {debugData.categories.map(c => (
                    <div key={c.id} className="p-2 border rounded text-sm">
                      <div><strong>{c.nom}</strong></div>
                      <div className="text-xs text-gray-600">tenant_id: {c.tenant_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🍴 Profils Restaurant visibles ({debugData.profiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {debugData.profiles.length === 0 ? (
                <p className="text-gray-500">Aucun profil visible</p>
              ) : (
                <div className="space-y-2">
                  {debugData.profiles.map(p => (
                    <div key={p.id} className="p-2 border rounded text-sm">
                      <div><strong>{p.nom_etablissement}</strong></div>
                      <div className="text-xs text-gray-600">tenant_id: {p.tenant_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
