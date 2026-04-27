import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home,
  Calculator,
  History,
  Settings,
  Menu,
  X,
  Users,
  Truck,
  BarChart3,
  CreditCard,
  BookCopy,
  ClipboardList,
  LayoutGrid,
  BookKey,
  LogOut,
  Store,
  User,
  AlertCircle,
  Clock,
  Building2,
  Handshake,
  BookOpen,
  Globe,
  Monitor,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityProvider, useSecurity } from "./components/contexts/SecurityContext";
import { OfflineProvider } from "./components/contexts/OfflineContext";
import { TenantProvider, useTenant } from "./components/contexts/TenantContext";
import OfflineIndicator from "./components/ui/OfflineIndicator";
import PinLockScreen from "./components/auth/PinLockScreen";
import GlobalPrintListener from "./components/caisse/GlobalPrintListener";
import { appClient } from "@/api/appClient";
import { Toaster } from "@/components/ui/toaster";

const navItems = [
  { name: "Accueil", icon: Home, page: "Dashboard", roles: ["owner", "manager", "employee"] },
  { name: "Caisse", icon: Calculator, page: "Pos", roles: ["owner", "manager", "employee"] },
  { name: "Plan de Tables", icon: LayoutGrid, page: "PlanDeTables", roles: ["owner", "manager", "employee"] },
  { name: "Livraisons", icon: Truck, page: "Livraisons", roles: ["owner", "manager", "employee"] },
  { name: "Encaissements", icon: CreditCard, page: "Encaissements", roles: ["owner", "manager", "employee"] },
  { name: "Comptage Caisse", icon: Calculator, page: "ComptageCaisse", roles: ["owner", "manager"] },
  { name: "Historique", icon: History, page: "HistoriqueJournalier", roles: ["owner", "manager"] },
  { name: "Statistiques", icon: BarChart3, page: "Statistiques", roles: ["owner", "manager"] },
  { name: "Analyse Produits", icon: ClipboardList, page: "AnalyseProduits", roles: ["owner", "manager"] },
  { name: "Analyse Categories", icon: LayoutGrid, page: "AnalyseCategories", roles: ["owner", "manager"] },
  { name: "Analyse Couts", icon: Calculator, page: "AnalyseCouts", roles: ["owner"] },
  { name: "Mes Factures", icon: FileCheck, page: "MesFactures", roles: ["owner"] },
  { name: "Comptabilite", icon: BookCopy, page: "Comptabilite", roles: ["owner"] },
  { name: "Journal Tiroir", icon: BookKey, page: "DrawerLog", roles: ["owner", "manager"] },
  { name: "Certification", icon: FileCheck, page: "Certification", roles: ["owner", "manager"] },
  { name: "Clients", icon: Users, page: "Clients", roles: ["owner", "manager", "employee"] },
  { name: "Site Commercial", icon: Globe, page: "LandingPage", roles: ["owner", "manager", "employee"], externalUrl: "https://strasyk.com/home" },
  { name: "Portefeuille Revendeur", icon: Handshake, page: "ResellerPortal", resellerRoles: ["reseller_owner", "reseller_manager", "reseller_sales", "reseller_support"] },
  { name: "Admin Commerces", icon: Building2, page: "AdminTenants", superAdminOnly: true },
  { name: "Revendeurs", icon: Handshake, page: "ResellersPlatform", superAdminOnly: true },
  { name: "Config Site", icon: Settings, page: "SiteAdmin", superAdminOnly: true },
  { name: "Parametres", icon: Settings, page: "Parametres", roles: ["owner", "manager"] },
  { name: "Manuel d'Utilisation", icon: BookOpen, page: "ManuelUtilisateur", roles: ["owner", "manager", "employee"] },
];

const pagePermissionMap = {
  Pos: "can_access_pos",
  Livraisons: "can_access_delivery_management",
  Encaissements: "can_access_delivery_management",
  Parametres: "can_access_settings",
  SiteAdmin: "can_access_site_admin",
  Kiosk: "can_access_kiosk",
};

const PLATFORM_ADMIN_ALLOWED_PAGES = new Set([
  "Dashboard",
  "Statistiques",
  "LandingPage",
  "AdminTenants",
  "ResellersPlatform",
  "SiteAdmin",
]);

const NavLink = ({ item, isSidebarCollapsed, location, currentTenant, onNavigate }) => {
  const isActive = location.pathname.includes(createPageUrl(item.page));

  const getPageUrl = () => {
    if (item.page === "Kiosk" && currentTenant) {
      return `${createPageUrl(item.page)}?tenant=${currentTenant.id}`;
    }
    return createPageUrl(item.page);
  };

  if (item.externalLinkWithTenant && currentTenant) {
    const url = `/DeliveryAppPublic?tenant=${currentTenant.id}`;
    return (
      <li key={item.name}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="my-1 flex items-center rounded-lg p-3 text-gray-600 transition-colors duration-200 hover:bg-gray-100"
        >
          <item.icon className="h-6 w-6" />
          {!isSidebarCollapsed && <span className="ml-4 font-medium">{item.name}</span>}
        </a>
      </li>
    );
  }

  if (item.externalUrl) {
    return (
      <li key={item.name}>
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="my-1 flex items-center rounded-lg p-3 text-gray-600 transition-colors duration-200 hover:bg-gray-100"
        >
          <item.icon className="h-6 w-6" />
          {!isSidebarCollapsed && <span className="ml-4 font-medium">{item.name}</span>}
        </a>
      </li>
    );
  }

  return (
    <li key={item.name}>
      <Link
        to={getPageUrl()}
        onClick={onNavigate}
        className={`my-1 flex items-center rounded-lg p-3 transition-colors duration-200 ${
          isActive
            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <item.icon className="h-6 w-6" />
        {!isSidebarCollapsed && <span className="ml-4 font-medium">{item.name}</span>}
      </Link>
    </li>
  );
};

const SidebarShell = ({
  isSidebarCollapsed,
  setSidebarCollapsed,
  navItemsToRender,
  location,
  currentTenant,
  currentReseller,
  currentUser,
  userRole,
  onLogout,
  isMobile = false,
  onCloseMobile = () => {},
}) => (
  <div className="flex h-full flex-col bg-white">
    <div
      className={`flex flex-shrink-0 items-center ${
        isSidebarCollapsed && !isMobile ? "justify-center" : "justify-between"
      } border-b bg-gradient-to-r from-orange-50 to-blue-50 p-4 ${isMobile ? "h-16" : "h-20"}`}
    >
      {(!isSidebarCollapsed || isMobile) && (
        <div className="flex flex-col">
          <h1 className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-xl font-bold text-transparent">
            Strasyk POS
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="h-0.5 w-8 bg-gradient-to-r from-orange-500 to-blue-500"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Expert Caisse
            </span>
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={isMobile ? onCloseMobile : () => setSidebarCollapsed(!isSidebarCollapsed)}
      >
        {isMobile ? <X className="h-6 w-6" /> : isSidebarCollapsed ? <Menu className="h-6 w-6" /> : <X className="h-6 w-6" />}
      </Button>
    </div>

    {(!isSidebarCollapsed || isMobile) && (currentTenant || currentReseller) && (
      <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          {currentReseller ? <Handshake className="h-4 w-4 text-blue-600" /> : <Store className="h-4 w-4 text-blue-600" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">{currentReseller ? "Revendeur" : "Commerce"}</p>
            <p className="truncate text-sm font-semibold text-gray-800">
              {currentReseller ? currentReseller.name : currentTenant.nom_commercial}
            </p>
          </div>
        </div>
        {currentUser && (
          <div className="mt-2 flex items-center gap-2 border-t border-blue-100 pt-2">
            <User className="h-4 w-4 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">
                {userRole === "owner" ? "Proprietaire" : userRole === "manager" ? "Manager" : "Employe"}
              </p>
              <p className="truncate text-xs font-medium text-gray-700">{currentUser.email}</p>
            </div>
          </div>
        )}
      </div>
    )}

    <div className="flex flex-1 flex-col overflow-y-auto">
      <nav className="p-4">
        <ul>
          {navItemsToRender.map((item) => (
            <NavLink
              key={item.page}
              item={item}
              isSidebarCollapsed={isSidebarCollapsed && !isMobile}
              location={location}
              currentTenant={currentTenant}
              onNavigate={isMobile ? onCloseMobile : undefined}
            />
          ))}
        </ul>
      </nav>

      <div className="mt-auto p-4">
        <button
          onClick={onLogout}
          className="my-1 flex w-full items-center rounded-lg p-3 text-red-600 transition-colors duration-200 hover:bg-red-50"
        >
          <LogOut className="h-6 w-6" />
          {(!isSidebarCollapsed || isMobile) && <span className="ml-4 font-medium">Quitter</span>}
        </button>
      </div>
    </div>
  </div>
);

const WaitingForAccess = () => {
  const handleLogout = async () => {
    await appClient.auth.logout();
    window.location.href = "/Auth";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Clock className="h-8 w-8 animate-pulse text-blue-600" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-gray-900">Acces en attente</h2>
          <p className="mb-4 text-gray-600">Aucun commerce n'est associe a votre compte.</p>
          <p className="mb-6 font-medium text-gray-700">
            Contactez un administrateur ou un proprietaire de commerce pour qu'il vous invite.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-3 font-medium text-gray-700 hover:bg-gray-300"
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </button>
      </div>
    </div>
  );
};

const LoginRequired = () => {
  React.useEffect(() => {
    appClient.auth.redirectToLogin(window.location.href);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
          <AlertCircle className="h-8 w-8 animate-pulse text-orange-600" />
        </div>
        <h2 className="mb-3 text-2xl font-bold text-gray-900">Authentification requise</h2>
        <p className="text-gray-600">Redirection vers la connexion...</p>
      </div>
    </div>
  );
};

const AccessDenied = ({ title = "Acces refuse", description = "Vous n avez pas les droits necessaires pour ouvrir cette page." }) => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-2xl">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="mb-3 text-2xl font-bold text-gray-900">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  </div>
);

const AppLayout = ({ children, currentPageName }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  const { isPageProtected, profile } = useSecurity();
  const { currentTenant, currentReseller, currentUser, status, isPlatformAdmin, isReseller, userRole, isLoading, hasModuleAccess } = useTenant();

  const handleLogout = async () => {
    await appClient.auth.logout();
    window.location.href = "/Auth";
  };

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500"></div>
          <p className="font-medium text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  if (status === "not_authenticated") {
    return <LoginRequired />;
  }

  if (status === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-gray-900">Compte suspendu</h2>
          <p className="mb-6 text-gray-600">
            Votre abonnement est suspendu. Veuillez contacter le support pour regulariser votre situation.
          </p>
          <button
            onClick={async () => {
              await appClient.auth.logout();
              window.location.href = "/Auth";
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-3 font-medium text-gray-700 hover:bg-gray-300"
          >
            <LogOut className="h-4 w-4" />
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  if (status === "error" || status === "no_access" || status === "tenant_not_found") {
    if (currentPageName !== "RequestAccess") {
      window.location.href = createPageUrl("RequestAccess");
      return null;
    }
    return <WaitingForAccess />;
  }

  const isSuperAdmin = isPlatformAdmin;
  const hasCurrentPageAccess = isSuperAdmin
    ? PLATFORM_ADMIN_ALLOWED_PAGES.has(currentPageName)
    : !pagePermissionMap[currentPageName] || hasModuleAccess(pagePermissionMap[currentPageName]);

  const visibleNavItems = navItems.filter((item) => {
    if (isSuperAdmin) {
      return PLATFORM_ADMIN_ALLOWED_PAGES.has(item.page);
    }
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.resellerRoles && !isReseller) return false;

    if (!isSuperAdmin && isReseller) {
      if (item.resellerRoles) {
        return item.resellerRoles.includes(userRole);
      }
      return false;
    }

    if (item.roles && !isSuperAdmin && userRole) {
      if (!item.roles.includes(userRole)) return false;
    }

    if (item.page === "Livraisons" || item.page === "Encaissements") {
      return profile?.manages_deliveries !== false;
    }
    if (item.page === "PlanDeTables") {
      return profile?.table_plan_allowed === true && profile?.manages_table_plan === true;
    }
    if (item.deliveryAppOnly) {
      return profile?.manages_delivery_app === true;
    }
    if (item.page && pagePermissionMap[item.page] && !isSuperAdmin) {
      return hasModuleAccess(pagePermissionMap[item.page]);
    }
    return true;
  });

  const navItemsWithKiosk =
    profile?.manages_kiosk === true
      ? [...visibleNavItems.slice(0, 2), { name: "Borne Commande", icon: Monitor, page: "Kiosk", roles: ["owner", "manager"] }, ...visibleNavItems.slice(2)]
      : visibleNavItems;

  if (!hasCurrentPageAccess) {
    return <AccessDenied description="Ce compte ne peut pas ouvrir cette section. Modifiez les permissions dans Gestion des acces." />;
  }

  if (currentPageName === "Pos") {
    if (currentTenant?.pos_suspended) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
          <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">Caisse suspendue</h2>
            <p className="text-gray-600">
              L'acces a la caisse a ete temporairement suspendu. Veuillez contacter le support pour regulariser votre situation.
            </p>
          </div>
        </div>
      );
    }

    return <div className="h-screen w-full overflow-hidden">{children}</div>;
  }

  const pageIsProtected = isPageProtected(currentPageName);

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`hidden bg-white shadow-xl transition-all duration-300 lg:flex lg:flex-col ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        <SidebarShell
          isSidebarCollapsed={isSidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          navItemsToRender={navItemsWithKiosk}
          location={location}
          currentTenant={currentTenant}
          currentReseller={currentReseller}
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
        />
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setIsMobileNavOpen(false)}>
          <aside className="h-full w-[86vw] max-w-xs bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <SidebarShell
              isSidebarCollapsed={false}
              setSidebarCollapsed={setSidebarCollapsed}
              navItemsToRender={navItemsWithKiosk}
              location={location}
              currentTenant={currentTenant}
              currentReseller={currentReseller}
              currentUser={currentUser}
              userRole={userRole}
              onLogout={handleLogout}
              isMobile
              onCloseMobile={() => setIsMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">Strasyk POS</p>
            <h2 className="truncate text-base font-bold text-slate-900">
              {currentReseller ? currentReseller.name : currentTenant?.nom_commercial || "Application"}
            </h2>
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsMobileNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          {pageIsProtected ? <PinLockScreen pageName={currentPageName}>{children}</PinLockScreen> : children}
        </main>
      </div>
      <GlobalPrintListener />
    </div>
  );
};

export default function Layout({ children, currentPageName }) {
  const publicPages = ["Auth", "LandingPage", "BorneCommande", "Kiosk", "InviteSignup", "CustomerDisplay", "DeliveryAppPublic", "RequestAccess", "OrderOnline", "RestaurantSite", "TenantFix", "TenantDebug"];

  if (publicPages.includes(currentPageName)) {
    return (
      <div className="h-full w-full">
        {children}
        <Toaster />
      </div>
    );
  }

  return (
    <TenantProvider>
      <SecurityProvider>
        <OfflineProvider>
          <OfflineIndicator />
          <AppLayout currentPageName={currentPageName}>{children}</AppLayout>
          <Toaster />
        </OfflineProvider>
      </SecurityProvider>
    </TenantProvider>
  );
}
