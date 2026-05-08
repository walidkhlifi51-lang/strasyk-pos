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

const DASHBOARD_ORDER_FIELDS = [
  'id', 'tenant_id', 'created_date', 'statut', 'from_web', 'total_ttc'
];

const DASHBOARD_CUSTOMER_COUNT_FIELDS = ['id'];
const DASHBOARD_PRODUCT_COUNT_FIELDS = ['id'];

const DASHBOARD_RESELLER_TENANT_FIELDS = ['id', 'reseller_id', 'tenant_id', 'status', 'created_date'];
const DASHBOARD_RESELLER_COMMISSION_FIELDS = ['id', 'reseller_id', 'status', 'commission_amount', 'created_date'];
const DASHBOARD_RESELLER_USER_FIELDS = ['id', 'reseller_id', 'status', 'user_email', 'created_date'];

export default function Dashboard() {
  const { currentTenant, currentReseller, filterByTenant, userRole, isPlatformAdmin, isReseller } = useTenant();
  const { isPageProtected, isPageUnlocked } = useSecurity();

  // Même logique de timezone que HistoriqueJournalier
  const toParisDate = (date) => toParisDateValue(date);
  const parisNow = toParisDate(new Date());
  const parisTodayStr = `${parisNow.getFullYear()}-${String(parisNow.getMonth()+1).padStart(2,'0')}-${String(parisNow.getDate()).padStart(2,'0')}`;
  const parisDayStartIso = new Date(parisNow.getFullYear(), parisNow.getMonth(), parisNow.getDate(), 0, 0, 0, 0).toISOString();

  const { data: orders = [] } = useQuery({
    queryKey: ['ordersHome', currentTenant?.id, parisTodayStr],
    queryFn: () => appClient.entities.Order.filter({
      ...filterByTenant(),
      created_date: { $gte: parisDayStartIso },
    }, '-created_date', 250, { fields: DASHBOARD_ORDER_FIELDS }),
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
      const res = await appClient.entities.Customer.filter(filterByTenant(), null, null, { fields: DASHBOARD_CUSTOMER_COUNT_FIELDS });
      return res.length;
    },
    enabled: !!currentTenant,
    staleTime: 300000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['productsHome', currentTenant?.id],
    queryFn: () => appClient.entities.Product.filter({ ...filterByTenant(), disponible: true }, null, null, { fields: DASHBOARD_PRODUCT_COUNT_FIELDS }),
    enabled: !!currentTenant,
    staleTime: 300000,
  });

  const { data: resellerSummary } = useQuery({
    queryKey: ['resellerDashboardSummary', currentReseller?.id],
    queryFn: async () => {
      const [resellerTenants, commissions, resellerUsers] = await Promise.all([
        appClient.entities.ResellerTenant.filter({ reseller_id: currentReseller.id }, '-created_date', null, { fields: DASHBOARD_RESELLER_TENANT_FIELDS }),
        appClient.entities.ResellerCommission.filter({ reseller_id: currentReseller.id }, '-created_date', null, { fields: DASHBOARD_RESELLER_COMMISSION_FIELDS }),
        appClient.entities.ResellerUser.filter({ reseller_id: currentReseller.id }, '-created_date', null, { fields: DASHBOARD_RESELLER_USER_FIELDS }),
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
  const heroTitle = isReseller ? "Pilotage revendeur" : "Accueil";
  const heroDescription = isReseller
    ? `Suivez votre portefeuille, vos commissions et vos acces depuis ${currentReseller?.name || 'votre espace revendeur'}.`
    : "Retrouvez les chiffres du jour et les acces utiles depuis une interface adaptee a l ordinateur comme au telephone.";
  const heroBadge = isReseller
    ? `${resellerSummary?.tenantsCount ?? 0} commerces actifs`
    : `${todayOrders.length} commandes aujourd hui`;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-700 text-white shadow-xl">
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-end lg:p-8">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
                Tableau de bord
              </div>
              <h1 className="max-w-2xl text-2xl font-bold leading-tight sm:text-3xl lg:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
                {heroDescription}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-100">
                Vue rapide
              </p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">{heroBadge}</p>
              <p className="mt-2 text-sm text-slate-200">
                {isReseller
                  ? `${resellerSummary?.usersCount ?? 0} comptes revendeur actifs dans l espace.`
                  : `${products.length} produits disponibles et ${customerCount} clients en base.`}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-0 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-4 sm:p-5 lg:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 sm:text-xs">
                    {stat.title}
                  </span>
                  <div className={`${stat.bgColor} rounded-xl p-2.5 shadow-sm`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="min-h-[2.75rem] text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  {stat.restricted ? <span className="text-lg text-gray-400">Acces restreint</span> : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Navigation</p>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Acces Rapides
              </h2>
            </div>
            <p className="max-w-xl text-sm text-gray-600">
              Les raccourcis se reorganisent automatiquement selon la taille de l ecran pour rester pratiques sur mobile.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {quickActions.map((action, index) => (
              <Link to={createPageUrl(action.link)} key={index} className="h-full">
                <Card className={`${action.bgColor} h-full border-0 shadow-lg transition-all duration-300 hover:shadow-xl lg:hover:-translate-y-1`}>
                  <CardContent className="flex h-full flex-col justify-between p-5 text-white sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold sm:text-xl">{action.title}</h3>
                        <p className="mt-2 text-sm opacity-90">{action.description}</p>
                      </div>
                      <div className="rounded-2xl bg-white/15 p-3">
                        <action.icon className="h-6 w-6 opacity-90 sm:h-7 sm:w-7" />
                      </div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                      Ouvrir
                    </div>
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

        <Card className="overflow-hidden border-0 bg-blue-50 shadow-md">
          <CardContent className="p-0">
            <div className="grid gap-0 md:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-center bg-blue-500 px-5 py-6 md:px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-bold text-blue-900">Conformite Fiscale</h3>
                <p className="mt-2 text-sm leading-6 text-blue-800">
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
