import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreditCard, Download, AlertCircle, Calendar, Euro, FileText, Eye } from "lucide-react";
import { useTenant } from "@/components/contexts/TenantContext";
import { useToast } from "@/components/ui/use-toast";
import { generateInvoicePDF } from "@/components/admin/InvoicePDFGenerator";

export default function MesFactures() {
  const { currentTenant, isOwner, userRole } = useTenant();
  const { toast } = useToast();
  const [selectedPaymentDay, setSelectedPaymentDay] = useState(null);
  const [invoiceForPaymentDay, setInvoiceForPaymentDay] = useState(null);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['my-invoices', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      return await appClient.entities.TenantInvoice.filter({ tenant_id: currentTenant.id }, '-date_facturation');
    },
    enabled: !!currentTenant && isOwner
  });

  // Rafraîchir après un paiement réussi
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success' || params.get('subscription') === 'success') {
      setTimeout(() => refetch(), 1000); // Attendre 1s que le webhook s'exécute
    }
  }, [refetch]);

  const createPaymentLinkMutation = useMutation({
    mutationFn: async (invoice) => {
      const response = await appClient.functions.invoke('createInvoiceCheckout', {
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
      toast({ title: "✅ Lien de paiement créé", description: "Vous allez être redirigé vers la page de paiement" });
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async ({ invoice_id, billing_cycle }) => {
      const response = await appClient.functions.invoke('createSubscription', {
        tenant_id: currentTenant.id,
        invoice_id: invoice_id,
        billing_cycle: billing_cycle
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
      toast({ title: "✅ Abonnement en cours", description: "Redirection vers le paiement sécurisé" });
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  const updatePaymentDayMutation = useMutation({
    mutationFn: async ({ invoiceId, day }) => {
      await appClient.entities.TenantInvoice.update(invoiceId, { preferred_payment_day: day });
    },
    onSuccess: () => {
      toast({ title: "✅ Jour de paiement défini" });
      setInvoiceForPaymentDay(null);
      setSelectedPaymentDay(null);
      refetch();
    },
    onError: (error) => {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  });

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Accès restreint
            </CardTitle>
            <CardDescription>
              Cette section est réservée aux propriétaires uniquement pour des raisons de confidentialité.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const paidInvoices = invoices.filter(inv => inv.statut === 'payee');
  const unpaidInvoices = invoices.filter(inv => inv.statut === 'en_attente');
  const subscriptions = invoices.filter(inv => inv.type === 'abonnement' || inv.type === 'frais_de_maintenance');

  const handleDownloadPDF = async (invoice) => {
    try {
      // Récupérer le profile du tenant pour avoir l'adresse et le téléphone
      const profiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: currentTenant.id });
      const tenantWithProfile = {
        ...currentTenant,
        profile: profiles[0] || null
      };
      
      generateInvoicePDF(invoice, tenantWithProfile);
      toast({ title: "📄 Facture téléchargée" });
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mes Factures</h1>
            <p className="text-gray-600 mt-1">Gérez vos factures et abonnements Strasyk</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Euro className="w-4 h-4 mr-2" />
            {invoices.reduce((sum, inv) => inv.statut === 'payee' ? sum + inv.montant : sum, 0).toFixed(2)}€ payés
          </Badge>
        </div>



        {unpaidInvoices.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Factures en attente de paiement ({unpaidInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unpaidInvoices.map(invoice => (
                <div key={invoice.id} className="bg-white rounded-lg p-4 border border-orange-200 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-orange-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{invoice.numero_facture}</p>
                        <p className="text-sm text-gray-600">{invoice.description || invoice.type}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Émise le {new Date(invoice.date_facturation).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-2xl font-bold text-orange-600">{invoice.montant.toFixed(2)}€</p>
                    <p className="text-xs text-gray-500">TTC</p>
                  </div>
                  <Button
                    onClick={() => createPaymentLinkMutation.mutate(invoice)}
                    disabled={createPaymentLinkMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Payer maintenant
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {subscriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Abonnements & Frais récurrents
              </CardTitle>
              <CardDescription>
                Configurez votre jour de paiement préféré (entre le 1 et 10 du mois)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptions.map(invoice => (
                <div key={invoice.id} className="bg-gray-50 rounded-lg p-4 border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{invoice.description || invoice.type}</p>
                      <p className="text-sm text-gray-600">
                        {invoice.monthly_payments ? Object.keys(invoice.monthly_payments).length : 0} mois restants
                      </p>
                      {invoice.preferred_payment_day && (
                        <Badge variant="outline" className="mt-2">
                          Paiement le {invoice.preferred_payment_day} de chaque mois
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-600">
                        {invoice.monthly_payments ? Object.values(invoice.monthly_payments)[0]?.montant.toFixed(2) : invoice.montant.toFixed(2)}€
                      </p>
                      <p className="text-xs text-gray-500">/mois</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button 
                      size="sm"
                      onClick={() => createSubscriptionMutation.mutate({ invoice_id: invoice.id, billing_cycle: 'monthly' })}
                      disabled={createSubscriptionMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Paiement mensuel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => createSubscriptionMutation.mutate({ invoice_id: invoice.id, billing_cycle: 'yearly' })}
                      disabled={createSubscriptionMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Paiement annuel (-10%)
                    </Button>
                  </div>

                  {invoice.monthly_payments && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Paiements:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(invoice.monthly_payments).map(([month, payment]) => (
                          <div key={month} className={`p-2 rounded text-xs ${payment.paye ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                            <p className="font-medium">{new Date(month).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</p>
                            <p>{payment.montant.toFixed(2)}€ {payment.paye ? '✓' : '⏳'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Factures payées ({paidInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {paidInvoices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune facture payée</p>
            ) : (
              <div className="space-y-3">
                {paidInvoices.map(invoice => (
                  <div key={invoice.id} className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-gray-900">{invoice.numero_facture}</p>
                          <p className="text-sm text-gray-600">{invoice.description || invoice.type}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Payée le {invoice.date_paiement ? new Date(invoice.date_paiement).toLocaleDateString('fr-FR') : new Date(invoice.date_facturation).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{invoice.montant.toFixed(2)}€</p>
                        <Badge className="bg-green-600 mt-1 text-xs">Payée</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-green-200">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadPDF(invoice)}
                        className="flex-1 hover:bg-green-100"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
