import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function DiagnosticTenant() {
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    const result = {
      user: null,
      allTenants: [],
      ownedTenant: null,
      userAccess: [],
      myUserAccess: null,
      products: [],
      categories: [],
      profiles: [],
      issues: [],
      status: 'checking'
    };

    try {
      // 1. Récupérer l'utilisateur
      result.user = await appClient.auth.me();
      
      // 2. Récupérer TOUS les tenants visibles
      result.allTenants = await appClient.entities.Tenant.list();
      
      // 3. Chercher si propriétaire
      result.ownedTenant = result.allTenants.find(t => t.owner_email === result.user.email);
      
      // 4. Récupérer TOUS les UserAccess
      result.userAccess = await appClient.entities.UserAccess.list();
      
      // 5. Chercher mon UserAccess
      result.myUserAccess = result.userAccess.find(a => a.user_email === result.user.email && a.is_active);
      
      // 6. Récupérer les données
      result.products = await appClient.entities.Product.list();
      result.categories = await appClient.entities.Category.list();
      result.profiles = await appClient.entities.RestaurantProfile.list();

      // ANALYSE DES PROBLÈMES
      
      // Problème 1: User sans tenant_id
      if (!result.user.tenant_id) {
        result.issues.push({
          type: 'error',
          message: '❌ L\'utilisateur n\'a PAS de tenant_id assigné',
          fix: 'Créer un commerce via AdminTenants ou TenantSetup'
        });
      }

      // Problème 2: tenant_id ne correspond à aucun tenant visible
      if (result.user.tenant_id && !result.allTenants.find(t => t.id === result.user.tenant_id)) {
        result.issues.push({
          type: 'error',
          message: '❌ Le tenant_id ne correspond à AUCUN tenant visible',
          fix: 'Le tenant_id est invalide ou l\'utilisateur n\'a pas accès'
        });
      }

      // Problème 3: Voir plusieurs tenants
      if (result.allTenants.length > 1) {
        result.issues.push({
          type: 'warning',
          message: `⚠️ L'utilisateur voit ${result.allTenants.length} tenants au lieu d'un seul`,
          fix: 'Vérifier les RLS et le tenant_id'
        });
      }

      // Problème 4: Produits de plusieurs tenants
      const uniqueTenantIds = [...new Set(result.products.map(p => p.tenant_id))];
      if (uniqueTenantIds.length > 1) {
        result.issues.push({
          type: 'error',
          message: `❌ Produits de ${uniqueTenantIds.length} tenants différents visibles !`,
          fix: 'RLS mal configuré sur Product'
        });
      }

      // Problème 5: Produits d'un mauvais tenant
      if (result.user.tenant_id && result.products.length > 0) {
        const wrongProducts = result.products.filter(p => p.tenant_id !== result.user.tenant_id);
        if (wrongProducts.length > 0) {
          result.issues.push({
            type: 'error',
            message: `❌ ${wrongProducts.length} produits ne correspondent PAS au tenant_id de l'utilisateur`,
            fix: 'RLS ne filtre pas correctement'
          });
        }
      }

      // Problème 6: Catégories d'un mauvais tenant
      if (result.user.tenant_id && result.categories.length > 0) {
        const wrongCategories = result.categories.filter(c => c.tenant_id !== result.user.tenant_id);
        if (wrongCategories.length > 0) {
          result.issues.push({
            type: 'error',
            message: `❌ ${wrongCategories.length} catégories ne correspondent PAS au tenant_id de l'utilisateur`,
            fix: 'RLS ne filtre pas correctement'
          });
        }
      }

      // Problème 7: Profil restaurant manquant
      if (result.user.tenant_id && result.profiles.length === 0) {
        result.issues.push({
          type: 'warning',
          message: '⚠️ Aucun profil restaurant trouvé',
          fix: 'Créer un RestaurantProfile pour ce tenant'
        });
      }

      // Problème 8: Profil d'un autre tenant
      if (result.user.tenant_id && result.profiles.length > 0) {
        const wrongProfile = result.profiles.find(p => p.tenant_id !== result.user.tenant_id);
        if (wrongProfile) {
          result.issues.push({
            type: 'error',
            message: '❌ Le profil restaurant ne correspond PAS au tenant_id',
            fix: 'Supprimer ou corriger le profil'
          });
        }
      }

      // Statut final
      if (result.issues.filter(i => i.type === 'error').length > 0) {
        result.status = 'error';
      } else if (result.issues.filter(i => i.type === 'warning').length > 0) {
        result.status = 'warning';
      } else {
        result.status = 'ok';
        result.issues.push({
          type: 'success',
          message: '✅ Aucun problème détecté',
          fix: ''
        });
      }

      setDiagnostic(result);
    } catch (error) {
      console.error('Erreur diagnostic:', error);
      setDiagnostic({
        ...result,
        status: 'error',
        issues: [{
          type: 'error',
          message: `❌ Erreur: ${error.message}`,
          fix: 'Vérifier les logs'
        }]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  if (!diagnostic) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const StatusIcon = diagnostic.status === 'ok' ? CheckCircle : diagnostic.status === 'warning' ? AlertTriangle : XCircle;
  const statusColor = diagnostic.status === 'ok' ? 'text-green-600' : diagnostic.status === 'warning' ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-8 h-8 ${statusColor}`} />
          <h1 className="text-3xl font-bold">🔍 Diagnostic Tenant Avancé</h1>
        </div>
        <Button onClick={runDiagnostic} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Relancer
        </Button>
      </div>

      {/* PROBLÈMES DÉTECTÉS */}
      <Card className="border-2 border-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Problèmes détectés ({diagnostic.issues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {diagnostic.issues.map((issue, idx) => (
              <div key={idx} className={`p-4 border-l-4 rounded ${
                issue.type === 'error' ? 'border-red-500 bg-red-50' :
                issue.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                'border-green-500 bg-green-50'
              }`}>
                <div className="font-semibold">{issue.message}</div>
                {issue.fix && <div className="text-sm mt-1 text-gray-600">💡 {issue.fix}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* UTILISATEUR */}
      <Card>
        <CardHeader>
          <CardTitle>👤 Utilisateur connecté</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div><strong>Email:</strong> {diagnostic.user?.email}</div>
            <div><strong>Nom:</strong> {diagnostic.user?.full_name}</div>
            <div><strong>Rôle:</strong> {diagnostic.user?.role}</div>
            <div className="flex items-center gap-2">
              <strong>tenant_id:</strong>
              {diagnostic.user?.tenant_id ? (
                <Badge variant="default">{diagnostic.user.tenant_id}</Badge>
              ) : (
                <Badge variant="destructive">NULL</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TENANTS VISIBLES */}
      <Card>
        <CardHeader>
          <CardTitle>
            🏪 Tenants visibles ({diagnostic.allTenants.length})
            {diagnostic.allTenants.length > 1 && (
              <Badge variant="destructive" className="ml-2">PROBLÈME</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {diagnostic.allTenants.map(t => (
              <div
                key={t.id}
                className={`p-3 border rounded ${
                  t.id === diagnostic.user?.tenant_id ? 'border-green-500 bg-green-50' : 'border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t.nom_commercial}</div>
                    <div className="text-xs text-gray-600">ID: {t.id}</div>
                    <div className="text-xs text-gray-600">Owner: {t.owner_email}</div>
                  </div>
                  {t.id === diagnostic.user?.tenant_id && (
                    <Badge variant="success">MON TENANT</Badge>
                  )}
                  {t.owner_email === diagnostic.user?.email && (
                    <Badge>PROPRIÉTAIRE</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PRODUITS */}
      <Card>
        <CardHeader>
          <CardTitle>
            📦 Produits visibles ({diagnostic.products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostic.products.length === 0 ? (
            <p className="text-gray-500">Aucun produit visible (NORMAL si nouveau tenant)</p>
          ) : (
            <div className="space-y-2">
              {diagnostic.products.map(p => (
                <div
                  key={p.id}
                  className={`p-2 border rounded text-sm ${
                    p.tenant_id !== diagnostic.user?.tenant_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>{p.nom}</strong>
                      <div className="text-xs text-gray-600">tenant_id: {p.tenant_id}</div>
                    </div>
                    {p.tenant_id !== diagnostic.user?.tenant_id && (
                      <Badge variant="destructive">MAUVAIS TENANT</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CATÉGORIES */}
      <Card>
        <CardHeader>
          <CardTitle>
            📁 Catégories visibles ({diagnostic.categories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostic.categories.length === 0 ? (
            <p className="text-gray-500">Aucune catégorie visible (NORMAL si nouveau tenant)</p>
          ) : (
            <div className="space-y-2">
              {diagnostic.categories.map(c => (
                <div
                  key={c.id}
                  className={`p-2 border rounded text-sm ${
                    c.tenant_id !== diagnostic.user?.tenant_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>{c.nom}</strong>
                      <div className="text-xs text-gray-600">tenant_id: {c.tenant_id}</div>
                    </div>
                    {c.tenant_id !== diagnostic.user?.tenant_id && (
                      <Badge variant="destructive">MAUVAIS TENANT</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* USER ACCESS */}
      <Card>
        <CardHeader>
          <CardTitle>🔑 UserAccess ({diagnostic.userAccess.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostic.userAccess.length === 0 ? (
            <p className="text-gray-500">Aucun UserAccess (NORMAL si propriétaire)</p>
          ) : (
            <div className="space-y-2">
              {diagnostic.userAccess.map(ua => (
                <div key={ua.id} className="p-2 border rounded text-sm">
                  <div>{ua.user_email}</div>
                  <div className="text-xs text-gray-600">tenant_id: {ua.tenant_id}</div>
                  <div className="text-xs text-gray-600">
                    Rôle: {ua.role} - Actif: {ua.is_active ? '✅' : '❌'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
