import React from "react";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";
import { useSecurity } from "@/components/contexts/SecurityContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toParisDate as toParisDateValue } from "@/lib/dateParsing";
import { 
  ShoppingCart, 
  Euro, 
  Users, 
  Package,
  Calculator,
  Truck,
  Handshake,
  BarChart3,
  ClipboardList,
  Settings
} from "lucide-react";

export default function Dashboard() {
  const { currentTenant, currentReseller, filterByTenant, userRole, isPlatformAdmin, isReseller } = useTenant();
  const { isPageProtected, isPageUnlocked } = useSecurity();

  // Même logique de timezone que HistoriqueJournalier
  const toParisDate = (date) => toParisDateValue(date);
  const parisNow = toParisDate(new Date());
  const parisTodayStr = `${parisNow.getFullYear()}-${String(parisNow.getMonth()+1).padStart(2,'0')}-${String(parisNow.getDate()).padStart(2,'0')}`;

  const { data: orders = [] } = useQuery({
    queryKey: ['ordersHome', currentTenant?.id, parisTodayStr],
    queryFn: () => appClient.entities.Order.filter(filterByTenant(), '-created_date', 500),
    enabled: !!currentTenant,
    staleTime: 30000,
  });

  // Filtrage côté client identique à HistoriqueJournalier
  const todayOrders = orders.filter(o => {
    if (o.statut === 'annulee') return false;
    if (o.statut === 'en_attente' && !o.from_web) return false;
    if (!o.created_date) return false;
    const orderDate = toParisDate(o.created_date);
    if (!orderDate) return false;
    const dayStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth()+1).padStart(2,'0')}-${String(orderDate.getDate()).padStart(2,'0')}`;
    return dayStr === parisTodayStr;
  });
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_ttc || 0), 0);

  const { data: customerCount = 0 } = useQuery({
    queryKey: ['customerCountHome', currentTenant?.id],
    queryFn: async () => {
      const res = await appClient.entities.Customer.filter(filterByTenant(), '-created_date', 5000);
      return res.length;
    },
    enabled: !!currentTenant,
    staleTime: 300000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['productsHome', currentTenant?.id],
    queryFn: () => appClient.entities.Product.filter({ ...filterByTenant(), disponible: true }, 'nom', 500),
    enabled: !!currentTenant,
    staleTime: 300000,
  });

  const { data: resellerSummary } = useQuery({
    queryKey: ['resellerDashboardSummary', currentReseller?.id],
    queryFn: async () => {
      const [resellerTenants, commissions, resellerUsers] = await Promise.all([
        appClient.entities.ResellerTenant.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerCommission.filter({ reseller_id: currentReseller.id }, '-created_date'),
        appClient.entities.ResellerUser.filter({ reseller_id: currentReseller.id }, '-created_date'),
      ]);

      return {
        tenantsCount: resellerTenants.filter((item) => item.status === 'active').length,
        pendingCommissions: commissions
          .filter((item) => item.status === 'pending')
          .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0),
        paidCommissions: commissions
          .filter((item) => item.status === 'paid')
          .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0),
        usersCount: resellerUsers.length,
      };
    },
    enabled: !!currentReseller?.id && isReseller,
    staleTime: 30000,
  });

  const statsPageProtected = isPageProtected("Statistiques");
  const statsPageUnlocked = isPageUnlocked("Statistiques");
  const canViewStats = (userRole === 'owner' || userRole === 'manager') && (!statsPageProtected || statsPageUnlocked);

  const tenantStatsCards = [
    {
      title: "COMMANDES AUJOURD'HUI",
      value: canViewStats ? todayOrders.length : "---",
      icon: ShoppingCart,
      bgColor: "bg-blue-500",
      restricted: !canViewStats
    },
    {
      title: "CA JOURNALIER",
      value: canViewStats ? `${todayRevenue.toFixed(2)}\u20ac` : "---",
      icon: Euro,
      bgColor: "bg-green-500",
      restricted: !canViewStats
    },
    {
      title: "CLIENTS",
      value: customerCount,
      icon: Users,
      bgColor: "bg-purple-500",
      restricted: false
    },
    {
      title: "PRODUITS",
      value: products.length,
      icon: Package,
      bgColor: "bg-orange-500",
      restricted: false
    }
  ];

  const resellerStatsCards = [
    {
      title: "COMMERCES ACTIFS",
      value: resellerSummary?.tenantsCount ?? 0,
      icon: Users,
      bgColor: "bg-blue-500",
      restricted: false,
    },
    {
      title: "COMMISSIONS PENDING",
      value: `${Number(resellerSummary?.pendingCommissions || 0).toFixed(2)}€`,
      icon: Euro,
      bgColor: "bg-orange-500",
      restricted: false,
    },
    {
      title: "COMMISSIONS PAYEES",
      value: `${Number(resellerSummary?.paidCommissions || 0).toFixed(2)}€`,
      icon: ShoppingCart,
      bgColor: "bg-green-500",
      restricted: false,
    },
    {
      title: "EQUIPE REVENDEUR",
      value: resellerSummary?.usersCount ?? 0,
      icon: Package,
      bgColor: "bg-purple-500",
      restricted: false,
    },
  ];

  const adminQuickActions = [
    {
      title: "Admin Commerces",
      description: "Gerer les commerces, les demandes et les admins plateforme",
      icon: Users,
      link: "AdminTenants",
      bgColor: "bg-gradient-to-br from-blue-600 to-indigo-700",
    },
    {
      title: "Revendeurs",
      description: "Piloter les partenaires, leurs commerces et le socle commissions",
      icon: Handshake,
      link: "ResellersPlatform",
      bgColor: "bg-gradient-to-br from-emerald-600 to-teal-700",
    },
    {
      title: "Config Site",
      description: "Gerer les reglages globaux de la plateforme",
      icon: Settings,
      link: "SiteAdmin",
      bgColor: "bg-gradient-to-br from-gray-700 to-gray-900",
    },
  ];

  const tenantQuickActions = [
    {
      title: "Caisse",
      description: "Prendre une commande et encaisser",
      icon: Calculator,
      link: "Pos",
      bgColor: "bg-gradient-to-br from-orange-500 to-red-500",
      roles: ['owner', 'manager', 'employee']
    },
    {
      title: "Livraisons",
      description: "Gerer les livraisons et les commandes",
      icon: Truck,
      link: "Livraisons",
      bgColor: "bg-gradient-to-br from-blue-500 to-indigo-600",
      roles: ['owner', 'manager', 'employee']
    },
    {
      title: "Statistiques",
      description: "Rapports et analyses NF525",
      icon: BarChart3,
      link: "Statistiques",
      bgColor: "bg-gradient-to-br from-green-500 to-teal-600",
      roles: ['owner', 'manager']
    },
    {
      title: "Comptage Caisse",
      description: "Verifier et cloturer la caisse",
      icon: ClipboardList,
      link: "ComptageCaisse",
      bgColor: "bg-gradient-to-br from-pink-500 to-purple-600",
      roles: ['owner', 'manager']
    },
    {
      title: "Encaissements",
      description: "Suivi des paiements livreurs",
      icon: Euro,
      link: "Encaissements",
      bgColor: "bg-gradient-to-br from-yellow-500 to-orange-500",
      roles: ['owner', 'manager', 'employee']
    },
    {
      title: "Parametres",
      description: "Articles, profils et configuration",
      icon: Settings,
      link: "Parametres",
      bgColor: "bg-gradient-to-br from-gray-600 to-gray-700",
      roles: ['owner', 'manager']
    }
  ].filter(action => action.roles.includes(userRole));

  const resellerQuickActions = [
    {
      title: "Portefeuille Revendeur",
      description: "Suivre vos commerces, commissions et branding",
      icon: Handshake,
      link: "ResellerPortal",
      bgColor: "bg-gradient-to-br from-emerald-600 to-teal-700",
    },
  ];

  const quickActions = isPlatformAdmin && !currentTenant
    ? adminQuickActions
    : isReseller
      ? resellerQuickActions
      : tenantQuickActions;

  const statsCards = isReseller ? resellerStatsCards : tenantStatsCards;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Tableau de bord
          </h1>
          <p className="text-gray-600">
            {isReseller
              ? `Vue synthese du portefeuille revendeur ${currentReseller?.name || ''}.`
              : "Une solution de caisse complete et securisee pour votre point de vente."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {stat.title}
                  </span>
                  <div className={`${stat.bgColor} p-2 rounded-lg`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {stat.restricted ? <span className="text-xl text-gray-400">Acces restreint</span> : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
            Acces Rapides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => (
              <Link to={createPageUrl(action.link)} key={index}>
                <Card className={`${action.bgColor} border-0 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer h-full`}>
                  <CardContent className="p-6 text-white">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold">{action.title}</h3>
                      <action.icon className="w-8 h-8 opacity-80" />
                    </div>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {quickActions.length === 0 && (
              <Card className="border border-dashed shadow-none">
                <CardContent className="p-6 text-center text-gray-500">
                  Aucun acces rapide disponible pour ce profil.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card className="border-0 shadow-md bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg text-blue-900 mb-1">Conformite Fiscale</h3>
                <p className="text-blue-800 text-sm">
                  Systeme concu pour respecter les obligations d'inalienabilite et de securisation des donnees.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
