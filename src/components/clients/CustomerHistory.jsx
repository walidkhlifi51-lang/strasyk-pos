import React, { useState, useEffect, useCallback } from "react";
import { appClient } from "@/api/appClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Receipt,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  X,
  Pencil,
  Save,
  PiggyBank,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClientForm from "./ClientForm";
import { useToast } from "@/components/ui/use-toast";
import TicketViewerModal from "../historique/TicketViewerModal";
import { parseSupabaseDate, toParisDate } from "@/lib/dateParsing";

const safeToFixed = (value, decimals = 2) => {
  const num = Number(value);
  if (Number.isNaN(num) || value === null || value === undefined) return "0.00";
  return num.toFixed(decimals);
};

const formatParisDateTime = (value) => {
  const parsed = toParisDate(value) || parseSupabaseDate(value);
  if (!parsed) return "Date invalide";
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: fr });
};

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card className="shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function CustomerHistory({ customerId, tenantId, onClose, onSettleOrder, onSelectAddress }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    totalSpent: 0,
    unpaidAmount: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cagnotteHistory, setCagnotteHistory] = useState([]);
  const [cagnotteRule, setCagnotteRule] = useState(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!customerId || !tenantId) {
      setCustomer(null);
      setOrders([]);
      setCagnotteHistory([]);
      setCagnotteRule(null);
      setStats({
        totalOrders: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        totalSpent: 0,
        unpaidAmount: 0,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [customerList, customerOrders, profileData, cagnotteHistoryData, cagnotteRuleData] = await Promise.all([
        appClient.entities.Customer.filter({ id: customerId, tenant_id: tenantId }, "-created_date", 1),
        appClient.entities.Order.filter({ customer_id: customerId, tenant_id: tenantId }, "-created_date", 100),
        appClient.entities.RestaurantProfile.filter({ tenant_id: tenantId }, "-created_date", 1),
        appClient.entities.CagnotteHistory.filter({ customer_id: customerId, tenant_id: tenantId }, "-created_date").catch(() => []),
        appClient.entities.CagnotteRule.filter({ tenant_id: tenantId }, "-created_date", 10).catch(() => []),
      ]);

      const customerData = customerList?.[0] || null;
      setCustomer(customerData);
      setProfile(profileData?.[0] || null);
      setCagnotteHistory(cagnotteHistoryData || []);
      setCagnotteRule((cagnotteRuleData || []).find((rule) => rule.active) || cagnotteRuleData?.[0] || null);

      const validOrders = (customerOrders || []).filter((order) => order.statut !== "annulee");
      setOrders(validOrders);

      const paidOrders = validOrders.filter((order) => order.payee);
      const unpaidOrders = validOrders.filter((order) => !order.payee);
      const totalSpent = paidOrders.reduce((sum, order) => sum + (Number(order.total_ttc) || 0), 0);
      const unpaidAmount = unpaidOrders.reduce((sum, order) => sum + (Number(order.total_ttc) || 0), 0);

      setStats({
        totalOrders: validOrders.length,
        paidOrders: paidOrders.length,
        unpaidOrders: unpaidOrders.length,
        totalSpent,
        unpaidAmount,
      });
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique client:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les donnees du client.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [customerId, tenantId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCustomer = async (formData) => {
    try {
      const updatedCustomer = await appClient.entities.Customer.update(customerId, formData);
      setCustomer(updatedCustomer);
      setIsEditing(false);
      toast({ title: "Succes", description: "Client mis a jour.", variant: "success" });
    } catch (error) {
      console.error("Erreur lors de la mise a jour du client:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le client.",
        variant: "destructive",
      });
    }
  };

  const getFidelityLevel = () => {
    if (stats.totalSpent >= 500) return { level: "VIP", color: "bg-purple-500", icon: "VIP" };
    if (stats.totalSpent >= 200) return { level: "Gold", color: "bg-yellow-500", icon: "Gold" };
    if (stats.totalSpent >= 100) return { level: "Silver", color: "bg-gray-400", icon: "Silver" };
    return { level: "Bronze", color: "bg-orange-400", icon: "Bronze" };
  };

  const fidelity = getFidelityLevel();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-white p-4">
        <CardTitle className="text-xl">
          Fiche Client: {customer ? `${customer.prenom || ""} ${customer.nom || ""}`.trim() : "Chargement..."}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Profil & Stats
                </div>
                <Badge className={`${fidelity.color} text-white`}>
                  {fidelity.icon} {fidelity.level}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Commandes" value={stats.totalOrders} icon={ShoppingBag} color="bg-blue-500" />
                <StatCard
                  title="Payees"
                  value={stats.paidOrders}
                  icon={Receipt}
                  color="bg-green-500"
                  subtitle={`${safeToFixed(stats.totalSpent)}EUR`}
                />
                <StatCard
                  title="Credits"
                  value={stats.unpaidOrders}
                  icon={AlertTriangle}
                  color="bg-yellow-500"
                  subtitle={`${safeToFixed(stats.unpaidAmount)}EUR`}
                />
                {cagnotteRule && (
                  <StatCard
                    title="Cagnotte"
                    value={`${safeToFixed(customer?.cagnotte_balance)}EUR`}
                    icon={PiggyBank}
                    color={cagnotteRule.active ? "bg-pink-500" : "bg-gray-400"}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Informations Personnelles
                <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} className="gap-1">
                  {isEditing ? <Save className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  {isEditing ? "Enregistrer" : "Modifier"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <ClientForm initialData={customer} onSubmit={handleSaveCustomer} onCancel={() => setIsEditing(false)} />
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Telephone:</strong> {customer?.telephone}
                  </p>
                  <p>
                    <strong>Email:</strong> {customer?.email || "N/A"}
                  </p>
                  <p>
                    <strong>Notes:</strong> {customer?.notes || "Aucune"}
                  </p>

                  {onSelectAddress &&
                    (() => {
                      const allAddrs = [
                        customer?.adresse
                          ? {
                              label: "Principale",
                              adresse: customer.adresse,
                              ville: customer.ville,
                              code_postal: customer.code_postal,
                              etage: customer.etage,
                              interphone: customer.interphone,
                            }
                          : null,
                        ...(customer?.adresses || []),
                      ].filter(Boolean);

                      return allAddrs.length > 0 ? (
                        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="mb-2 text-xs font-bold text-blue-800">Adresse de livraison :</p>
                          <div className="space-y-1">
                            {allAddrs.map((addr, idx) => {
                              const addrStr = `${addr.adresse || ""}, ${addr.code_postal || ""} ${addr.ville || ""}`
                                .trim()
                                .replace(/^,\s*/, "");
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    onSelectAddress(addrStr);
                                    onClose();
                                  }}
                                  className="w-full rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-blue-400 hover:bg-blue-50"
                                >
                                  <span className="font-semibold">
                                    {addr.label || (idx === 0 ? "Principale" : `Adresse ${idx + 1}`)}
                                  </span>
                                  <span className="ml-1 text-gray-500">- {addrStr}</span>
                                  {addr.etage && <span className="ml-1 text-gray-400">(etage: {addr.etage})</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}
                </div>
              )}
            </CardContent>
          </Card>

          {cagnotteHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-pink-500" />
                    Historique de la Cagnotte
                  </div>
                  {cagnotteRule ? (
                    <Badge className={cagnotteRule.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"}>
                      {cagnotteRule.active ? "Actif" : "Desactive"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Non configure</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cagnotteHistory.map((entry) => {
                  const orderForEntry = orders.find((o) => o.id === entry.order_id);
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-md p-2 text-sm even:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {entry.type === "earn" ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {entry.type === "earn" ? "Gain" : "Depense"}
                            {orderForEntry && ` (Cmd #${orderForEntry.numero_caisse || ""})`}
                          </p>
                          <p className="text-xs text-gray-500">{formatParisDateTime(entry.created_date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${entry.type === "earn" ? "text-green-600" : "text-red-600"}`}>
                          {entry.type === "earn" ? "+" : "-"} {safeToFixed(Math.abs(entry.amount))}EUR
                        </p>
                        <p className="text-xs text-gray-500">Solde: {safeToFixed(entry.balance_after)}EUR</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Historique des commandes ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p>Chargement...</p>
              ) : orders.length > 0 ? (
                orders.map((order) => {
                  const orderArticles = order.articles || [];
                  const discounts = orderArticles.filter((a) => a.product_id?.startsWith("discount-"));
                  const loyalty = orderArticles.find((a) => a.product_id?.startsWith("loyalty-"));
                  const promo = orderArticles.find((a) => a.product_id?.startsWith("promo-"));

                  return (
                    <div key={order.id} className="rounded-lg border bg-gray-50/50 p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">
                            Commande #{order.numero_commande || order.numero_caisse || order.id?.slice(-4)}
                          </div>
                          <p className="text-xs text-gray-500">{formatParisDateTime(order.created_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{safeToFixed(order.total_ttc)}EUR</p>
                          <Badge
                            variant={order.payee ? "default" : "destructive"}
                            className={`text-xs ${order.payee ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {order.payee ? "Payee" : "A regler"}
                          </Badge>
                        </div>
                      </div>

                      {(discounts.length > 0 || loyalty || promo) && (
                        <div className="mt-2 space-y-1 rounded-md border border-green-200 bg-green-50 p-2">
                          <p className="mb-1 text-xs font-semibold text-green-700">Avantages appliques :</p>

                          {discounts.map((discount, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-green-600">
                              <span>- {discount.nom_produit}</span>
                              <span className="font-medium">{safeToFixed(discount.prix_unitaire)}EUR</span>
                            </div>
                          ))}

                          {loyalty && (
                            <div className="flex justify-between text-xs font-medium text-yellow-600">
                              <span>{loyalty.nom_produit}</span>
                              <span>{safeToFixed(loyalty.prix_unitaire)}EUR</span>
                            </div>
                          )}

                          {promo && (
                            <div className="flex justify-between text-xs font-medium text-blue-600">
                              <span>{promo.nom_produit}</span>
                              <span>{safeToFixed(promo.prix_unitaire)}EUR</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewingOrder(order)}>
                          Voir ticket
                        </Button>
                        {!order.payee && onSettleOrder && (
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onSettleOrder(order)}>
                            Regler
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-4 text-center text-gray-500">Aucune commande.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {viewingOrder && (
        <TicketViewerModal
          order={viewingOrder}
          customer={customer}
          profile={profile}
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}
