/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminTenants from './pages/AdminTenants';
import AnalyseCategories from './pages/AnalyseCategories';
import AnalyseCouts from './pages/AnalyseCouts';
import AnalyseProduits from './pages/AnalyseProduits';
import AuditTenant from './pages/AuditTenant';
import Certification from './pages/Certification';
import CleanupTenant from './pages/CleanupTenant';
import Clients from './pages/Clients';
import Comptabilite from './pages/Comptabilite';
import ComptageCaisse from './pages/ComptageCaisse';
import CustomerCagnotte from './pages/CustomerCagnotte';
import CustomerDisplay from './pages/CustomerDisplay';
import Dashboard from './pages/Dashboard';
import DebugTenant from './pages/DebugTenant';
import DeliveryApp from './pages/DeliveryApp';
import DeliveryAppPublic from './pages/DeliveryAppPublic';
import DiagnosticClients from './pages/DiagnosticClients';
import DiagnosticTenant from './pages/DiagnosticTenant';
import DrawerLog from './pages/DrawerLog';
import Encaissements from './pages/Encaissements';
import HistoriqueJournalier from './pages/HistoriqueJournalier';
import InviteSignup from './pages/InviteSignup';
import Kiosk from './pages/Kiosk';
import LandingPage from './pages/LandingPage';
import Livraisons from './pages/Livraisons';
import ManuelUtilisateur from './pages/ManuelUtilisateur';
import MesFactures from './pages/MesFactures';
import NoAccess from './pages/NoAccess';
import OrderOnline from './pages/OrderOnline';
import Parametres from './pages/Parametres';
import PlanDeTables from './pages/PlanDeTables';
import Pos from './pages/Pos';
import RequestAccess from './pages/RequestAccess';
import ResellersPlatform from './pages/ResellersPlatform';
import ResellerPortal from './pages/ResellerPortal';
import RestaurantSite from './pages/RestaurantSite';
import SiteAdmin from './pages/SiteAdmin';
import Statistiques from './pages/Statistiques';
import StrasykPos from './pages/StrasykPos';
import TenantDebug from './pages/TenantDebug';
import TenantFix from './pages/TenantFix';
import TenantSetup from './pages/TenantSetup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminTenants": AdminTenants,
    "AnalyseCategories": AnalyseCategories,
    "AnalyseCouts": AnalyseCouts,
    "AnalyseProduits": AnalyseProduits,
    "AuditTenant": AuditTenant,
    "Certification": Certification,
    "CleanupTenant": CleanupTenant,
    "Clients": Clients,
    "Comptabilite": Comptabilite,
    "ComptageCaisse": ComptageCaisse,
    "CustomerCagnotte": CustomerCagnotte,
    "CustomerDisplay": CustomerDisplay,
    "Dashboard": Dashboard,
    "DebugTenant": DebugTenant,
    "DeliveryApp": DeliveryApp,
    "DeliveryAppPublic": DeliveryAppPublic,
    "DiagnosticClients": DiagnosticClients,
    "DiagnosticTenant": DiagnosticTenant,
    "DrawerLog": DrawerLog,
    "Encaissements": Encaissements,
    "HistoriqueJournalier": HistoriqueJournalier,
    "InviteSignup": InviteSignup,
    "Kiosk": Kiosk,
    "LandingPage": LandingPage,
    "Livraisons": Livraisons,
    "ManuelUtilisateur": ManuelUtilisateur,
    "MesFactures": MesFactures,
    "NoAccess": NoAccess,
    "OrderOnline": OrderOnline,
    "Parametres": Parametres,
    "PlanDeTables": PlanDeTables,
    "Pos": Pos,
    "RequestAccess": RequestAccess,
    "ResellerPortal": ResellerPortal,
    "ResellersPlatform": ResellersPlatform,
    "RestaurantSite": RestaurantSite,
    "SiteAdmin": SiteAdmin,
    "Statistiques": Statistiques,
    "StrasykPos": StrasykPos,
    "TenantDebug": TenantDebug,
    "TenantFix": TenantFix,
    "TenantSetup": TenantSetup,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
