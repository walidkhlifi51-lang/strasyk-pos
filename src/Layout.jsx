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
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityProvider, useSecurity } from './components/contexts/SecurityContext';
import { OfflineProvider } from './components/contexts/OfflineContext';
import { TenantProvider, useTenant } from './components/contexts/TenantContext';
import OfflineIndicator from './components/ui/OfflineIndicator';
import PinLockScreen from './components/auth/PinLockScreen';
import GlobalPrintListener from './components/caisse/GlobalPrintListener';
import { appClient } from "@/api/appClient";
import { Toaster } from "@/components/ui/toaster";

const navItems = [
  { name: "Accueil", icon: Home, page: "Dashboard", roles: ['owner', 'manager', 'employee'] },
  { name: "Caisse", icon: Calculator, page: "Pos", roles: ['owner', 'manager', 'employee'] },
  { name: "Plan de Tables", icon: LayoutGrid, page: "PlanDeTables", roles: ['owner', 'manager', 'employee'] },
  { name: "Livraisons", icon: Truck, page: "Livraisons", roles: ['owner', 'manager', 'employee'] },
  { name: "Encaissements", icon: CreditCard, page: "Encaissements", roles: ['owner', 'manager', 'employee'] },
  { name: "Comptage Caisse", icon: Calculator, page: "ComptageCaisse", roles: ['owner', 'manager'] },
  { name: "Historique", icon: History, page: "HistoriqueJournalier", roles: ['owner', 'manager'] },
  { name: "Statistiques", icon: BarChart3, page: "Statistiques", roles: ['owner', 'manager'] },
  { name: "Analyse Produits", icon: ClipboardList, page: "AnalyseProduits", roles: ['owner', 'manager'] },
  { name: "Analyse Catégories", icon: LayoutGrid, page: "AnalyseCategories", roles: ['owner', 'manager'] },
  { name: "Analyse Coûts", icon: Calculator, page: "AnalyseCouts", roles: ['owner'] },
  { name: "Mes Factures", icon: FileCheck, page: "MesFactures", roles: ['owner'] },
  { name: "Comptabilité", icon: BookCopy, page: "Comptabilite", roles: ['owner'] },
  { name: "Journal Tiroir", icon: BookKey, page: "DrawerLog", roles: ['owner', 'manager'] },
  { name: "Certification", icon: FileCheck, page: "Certification", roles: ['owner', 'manager'] },
  { name: "Clients", icon: Users, page: "Clients", roles: ['owner', 'manager', 'employee'] },
  { name: "Site Commercial", icon: Globe, page: "LandingPage", roles: ['owner', 'manager', 'employee'], externalUrl: "https://strasyk.com/home" },
  { name: "Portefeuille Revendeur", icon: Handshake, page: "ResellerPortal", resellerRoles: ['reseller_owner', 'reseller_manager', 'reseller_sales', 'reseller_support'] },
  { name: "Admin Commerces", icon: Building2, page: "AdminTenants", superAdminOnly: true },
  { name: "Revendeurs", icon: Handshake, page: "ResellersPlatform", superAdminOnly: true },
  { name: "Config Site", icon: Settings, page: "SiteAdmin", superAdminOnly: true },
  { name: "Paramètres", icon: Settings, page: "Parametres", roles: ['owner', 'manager'] },
  { name: "Manuel d'Utilisation", icon: BookOpen, page: "ManuelUtilisateur", roles: ['owner', 'manager', 'employee'] },
];

const pagePermissionMap = {
  Pos: 'can_access_pos',
  Livraisons: 'can_access_delivery_management',
  Encaissements: 'can_access_delivery_management',
  Parametres: 'can_access_settings',
  SiteAdmin: 'can_access_site_admin',
  Kiosk: 'can_access_kiosk',
};

const NavLink = ({ item, isSidebarCollapsed, location, currentTenant }) => {
  const isActive = location.pathname.includes(createPageUrl(item.page));
  
  // Gestion spéciale pour la borne qui nécessite le tenant_id
  const getPageUrl = () => {
    if (item.page === 'Kiosk' && currentTenant) {
      return `${createPageUrl(item.page)}?tenant=${currentTenant.id}`;
    }
    return createPageUrl(item.page);
  };
  
  // Si c'est un lien externe avec tenant
  if (item.externalLinkWithTenant && currentTenant) {
    const url = `/DeliveryAppPublic?tenant=${currentTenant.id}`;
    return (
      <li key={item.name}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-3 my-1 rounded-lg transition-colors duration-200 text-gray-600 hover:bg-gray-100"
        >
          <item.icon className="h-6 w-6" />
          {!isSidebarCollapsed && <span className="ml-4 font-medium">{item.name}</span>}
        </a>
      </li>
    );
  }

  // Si c'est un lien externe
  if (item.externalUrl) {
    return (
      <li key={item.name}>
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-3 my-1 rounded-lg transition-colors duration-200 text-gray-600 hover:bg-gray-100"
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
        className={`flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
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

const WaitingForAccess = () => {
  const handleLogout = async () => {
    await appClient.auth.logout();
    window.location.href = '/Auth';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Accès en attente</h2>
          <p className="text-gray-600 mb-4">
            Aucun commerce n'est associé à votre compte.
          </p>
          <p className="text-gray-700 font-medium mb-6">
            Contactez un administrateur ou un propriétaire de commerce pour qu'il vous invite.
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-orange-600 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Authentification requise</h2>
        <p className="text-gray-600 mb-6">
          Redirection vers la connexion...
        </p>
      </div>
    </div>
  );
};

const AccessDenied = ({ title = "Acces refuse", description = "Vous n avez pas les droits necessaires pour ouvrir cette page." }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
};

const AppLayout = ({ children, currentPageName }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  
  const { isPageProtected, profile } = useSecurity();
  const { currentTenant, currentReseller, currentUser, status, isOwner, isPlatformAdmin, isReseller, resellerRole, userRole, isLoading, hasModuleAccess } = useTenant();

  const handleLogout = async () => {
    await appClient.auth.logout();
    window.location.href = '/Auth';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-orange-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (status === 'not_authenticated') {
    return <LoginRequired />;
  }

  if (status === 'suspended') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Compte suspendu</h2>
          <p className="text-gray-600 mb-6">
            Votre abonnement est suspendu. Veuillez contacter le support pour régulariser votre situation.
          </p>
          <button
            onClick={async () => {
              await appClient.auth.logout();
              window.location.href = '/Auth';
            }}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error' || status === 'no_access' || status === 'tenant_not_found') {
    // Rediriger vers la page de demande d'accès
    if (currentPageName !== 'RequestAccess') {
      window.location.href = createPageUrl('RequestAccess');
      return null;
    }
  }

  // Super admin = utilisateur sans tenant_id OU avec role admin appClient
  const isSuperAdmin = isPlatformAdmin;

  const hasCurrentPageAccess = isSuperAdmin || !pagePermissionMap[currentPageName] || hasModuleAccess(pagePermissionMap[currentPageName]);

  const visibleNavItems = navItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.resellerRoles && !isReseller) return false;

    // Vérifier les rôles requis (sauf pour super admin)
    if (!isSuperAdmin && isReseller) {
      if (item.resellerRoles) {
        return item.resellerRoles.includes(userRole);
      }
      return false;
    }

    if (item.roles && !isSuperAdmin && userRole) {
      if (!item.roles.includes(userRole)) return false;
    }

    if (item.page === 'Livraisons' || item.page === 'Encaissements') {
      return profile?.manages_deliveries !== false;
    }
    if (item.page === 'PlanDeTables') {
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
  
  // Ajouter le lien de la borne conditionnellement si elle est activée
  const navItemsWithKiosk = profile?.manages_kiosk === true
    ? [...visibleNavItems.slice(0, 2), { name: "Borne Commande", icon: Monitor, page: "Kiosk", roles: ['owner', 'manager'] }, ...visibleNavItems.slice(2)]
    : visibleNavItems;

  if (!hasCurrentPageAccess) {
    return (
      <AccessDenied description="Ce compte ne peut pas ouvrir cette section. Modifiez les permissions dans Gestion des acces." />
    );
  }

  const isOnCaissePage = currentPageName === 'Pos';
  
  if (isOnCaissePage) {
    if (currentTenant?.pos_suspended) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Caisse suspendue</h2>
            <p className="text-gray-600 mb-6">
              L'accès à la caisse a été temporairement suspendu. Veuillez contacter le support pour régulariser votre situation.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-screen overflow-hidden">
        {children}
      </div>
    );
  }

  const pageIsProtected = isPageProtected(currentPageName);

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`bg-white shadow-xl transition-all duration-300 flex flex-col ${isSidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className={`flex-shrink-0 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-4 h-20 border-b bg-gradient-to-r from-orange-50 to-blue-50`}>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                Strasyk POS
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-0.5 w-8 bg-gradient-to-r from-orange-500 to-blue-500"></div>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Expert Caisse
                </span>
              </div>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <Menu className="h-6 w-6" /> : <X className="h-6 w-6" />}
          </Button>
        </div>

        {!isSidebarCollapsed && (currentTenant || currentReseller) && (
          <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2 mb-2">
              {currentReseller ? <Handshake className="w-4 h-4 text-blue-600" /> : <Store className="w-4 h-4 text-blue-600" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">{currentReseller ? 'Revendeur' : 'Commerce'}</p>
                <p className="font-semibold text-sm text-gray-800 truncate">
                  {currentReseller ? currentReseller.name : currentTenant.nom_commercial}
                </p>
              </div>
            </div>
            {currentUser && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-100">
                <User className="w-4 h-4 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    {userRole === 'owner' ? 'Propriétaire' : userRole === 'manager' ? 'Manager' : 'Employé'}
                  </p>
                  <p className="font-medium text-xs text-gray-700 truncate">{currentUser.email}</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="p-4">
            <ul>
              {navItemsWithKiosk.map(item => <NavLink key={item.page} item={item} isSidebarCollapsed={isSidebarCollapsed} location={location} currentTenant={currentTenant} />)}
            </ul>
          </nav>

          <div className="mt-auto p-4">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors duration-200 text-red-600 hover:bg-red-50`}
            >
              <LogOut className="h-6 w-6" />
              {!isSidebarCollapsed && <span className="ml-4 font-medium">Quitter</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          {pageIsProtected ? (
            <PinLockScreen pageName={currentPageName}>
              {children}
            </PinLockScreen>
          ) : (
            children
          )}
        </main>
      </div>
      <GlobalPrintListener />
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  // 🌍 Pages publiques = AUCUN provider, AUCUN layout, rendu direct
  const publicPages = ['Auth', 'LandingPage', 'BorneCommande', 'Kiosk', 'InviteSignup', 'CustomerDisplay', 'DeliveryAppPublic', 'RequestAccess', 'OrderOnline', 'RestaurantSite', 'TenantFix', 'TenantDebug'];
  
  if (publicPages.includes(currentPageName)) {
    return <div className="w-full h-full">{children}<Toaster /></div>;
  }

  // 🔒 Pages protégées = avec authentification et layout complet
  return (
    <TenantProvider>
      <SecurityProvider>
        <OfflineProvider>
          <OfflineIndicator />
          <AppLayout currentPageName={currentPageName}>
            {children}
          </AppLayout>
          <Toaster />
        </OfflineProvider>
      </SecurityProvider>
    </TenantProvider>
  );
}
