import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function CleanupTenant() {
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState(null);
  const { toast } = useToast();

  const cleanup = async () => {
    setCleaning(true);
    const cleanupReport = {
      user: null,
      productsDeleted: 0,
      categoriesDeleted: 0,
      ordersDeleted: 0,
      customersDeleted: 0,
      errors: []
    };

    try {
      // Récupérer l'utilisateur
      cleanupReport.user = await appClient.auth.me();
      const myTenantId = cleanupReport.user.tenant_id;

      if (!myTenantId) {
        throw new Error('Pas de tenant_id assigné');
      }

      // Supprimer les produits qui ne correspondent pas
      const products = await appClient.entities.Product.list();
      for (const product of products) {
        if (product.tenant_id !== myTenantId) {
          try {
            await appClient.entities.Product.delete(product.id);
            cleanupReport.productsDeleted++;
          } catch (e) {
            cleanupReport.errors.push(`Produit ${product.nom}: ${e.message}`);
          }
        }
      }

      // Supprimer les catégories qui ne correspondent pas
      const categories = await appClient.entities.Category.list();
      for (const category of categories) {
        if (category.tenant_id !== myTenantId) {
          try {
            await appClient.entities.Category.delete(category.id);
            cleanupReport.categoriesDeleted++;
          } catch (e) {
            cleanupReport.errors.push(`Catégorie ${category.nom}: ${e.message}`);
          }
        }
      }

      // Supprimer les commandes qui ne correspondent pas
      const orders = await appClient.entities.Order.list();
      for (const order of orders) {
        if (order.tenant_id !== myTenantId) {
          try {
            await appClient.entities.Order.delete(order.id);
            cleanupReport.ordersDeleted++;
          } catch (e) {
            cleanupReport.errors.push(`Commande ${order.numero_commande}: ${e.message}`);
          }
        }
      }

      // Supprimer les clients qui ne correspondent pas
      const customers = await appClient.entities.Customer.list();
      for (const customer of customers) {
        if (customer.tenant_id !== myTenantId) {
          try {
            await appClient.entities.Customer.delete(customer.id);
            cleanupReport.customersDeleted++;
          } catch (e) {
            cleanupReport.errors.push(`Client ${customer.nom}: ${e.message}`);
          }
        }
      }

      setReport(cleanupReport);
      
      toast({
        title: '✅ Nettoyage terminé',
        description: `${cleanupReport.productsDeleted + cleanupReport.categoriesDeleted + cleanupReport.ordersDeleted + cleanupReport.customersDeleted} éléments supprimés`,
      });

    } catch (error) {
      console.error('Erreur nettoyage:', error);
      toast({
        title: '❌ Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="border-2 border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            🧹 Nettoyage des Données Incorrectes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-semibold mb-2">
              ⚠️ ATTENTION - Action Irréversible
            </p>
            <p className="text-sm text-red-700 mb-3">
              Cet outil va supprimer TOUTES les données (produits, catégories, commandes, clients) 
              qui ne correspondent PAS à votre tenant_id actuel.
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              <li>Produits avec un mauvais tenant_id</li>
              <li>Catégories avec un mauvais tenant_id</li>
              <li>Commandes avec un mauvais tenant_id</li>
              <li>Clients avec un mauvais tenant_id</li>
            </ul>
          </div>

          <Button
            onClick={cleanup}
            disabled={cleaning}
            className="w-full bg-red-600 hover:bg-red-700"
            size="lg"
          >
            {cleaning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Nettoyage en cours...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Nettoyer les données incorrectes
              </>
            )}
          </Button>

          {report && (
            <div className="mt-6 space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold text-green-800 mb-2">✅ Nettoyage terminé</p>
                <div className="space-y-1 text-sm text-green-700">
                  <div>• Produits supprimés: <Badge>{report.productsDeleted}</Badge></div>
                  <div>• Catégories supprimées: <Badge>{report.categoriesDeleted}</Badge></div>
                  <div>• Commandes supprimées: <Badge>{report.ordersDeleted}</Badge></div>
                  <div>• Clients supprimés: <Badge>{report.customersDeleted}</Badge></div>
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-semibold text-yellow-800 mb-2">⚠️ Erreurs rencontrées</p>
                  <div className="space-y-1 text-xs text-yellow-700">
                    {report.errors.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => window.location.href = '/DiagnosticTenant'}
                className="w-full"
              >
                🔍 Relancer le diagnostic
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
