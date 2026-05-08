import React, { useState, useEffect, useMemo } from "react";
import { appClient } from "@/api/appClient";
import { CheckCircle, AlertCircle, Printer, CreditCard, Wallet, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import KioskProductGrid from "../components/borne/KioskProductGrid";
import KioskCart from "../components/borne/KioskCart";
import ProductCustomizationModal from "../components/caisse/ProductCustomizationModal";
import MenuCustomizationModal from "../components/caisse/MenuCustomizationModal";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateKioskClientReceiptHtml, generateTicketHtml, triggerPrint } from "../components/caisse/ticketUtils";
import { calculateOfferDiscounts } from "@/utils/offerUtils";
import { computeTaxSummaryFromArticles } from "../components/utils/taxUtils";
import {
  createKioskCachePayload,
  fetchKioskCatalog,
  fetchTenantSyncSnapshot,
  readKioskCatalogCache,
  shouldRefreshKioskCatalog,
  writeKioskCatalogCache,
} from "@/lib/kioskCatalogCache";

const normalizeKioskWelcomeImages = (images = []) => (
  Array.isArray(images)
    ? images.map((item) => {
        if (typeof item === 'string') {
          return { image_url: item, title: '' };
        }

        return {
          image_url: item?.image_url || item?.url || '',
          title: item?.title || '',
        };
      }).filter((item) => item.image_url)
    : []
);

const getWelcomeImageLabel = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return '';

  if (imageUrl.startsWith('data:')) {
    return 'Visuel d accueil';
  }

  try {
    const url = new URL(imageUrl, window.location.origin);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop() || '';
    const decoded = decodeURIComponent(lastSegment);
    const withoutExtension = decoded.replace(/\.[a-z0-9]+$/i, '');
    const cleaned = withoutExtension
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : 'Visuel d accueil';
  } catch (error) {
    return 'Visuel d accueil';
  }
};

const getWelcomeTitleSizeClass = (size) => {
  switch (size) {
    case 'medium':
      return 'text-[clamp(1.2rem,1.8vw,2.2rem)]';
    case 'xlarge':
      return 'text-[clamp(1.9rem,2.9vw,3.8rem)]';
    case 'hero':
      return 'text-[clamp(2.2rem,3.4vw,4.6rem)]';
    case 'large':
    default:
      return 'text-[clamp(1.6rem,2.4vw,3.1rem)]';
  }
};

const getWelcomeTitleStyleClass = (style) => {
  switch (style) {
    case 'italic':
      return 'italic font-semibold tracking-[0.01em]';
    case 'serif':
      return 'font-serif font-bold tracking-[0.01em]';
    case 'caps':
      return 'font-black uppercase tracking-[0.22em]';
    case 'bold':
    default:
      return 'font-black tracking-tight';
  }
};

const DEFAULT_KIOSK_EXIT_CODE = '2580';

const getFullscreenElement = () => (
  document.fullscreenElement
  || document.webkitFullscreenElement
  || document.mozFullScreenElement
  || document.msFullscreenElement
);

const requestAppFullscreen = async () => {
  const element = document.documentElement;
  if (!element) return false;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return true;
    }
    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
      return true;
    }
    if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
      return true;
    }
    if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
      return true;
    }
  } catch (error) {
    console.warn('[Kiosk] Impossible d activer le plein ecran:', error);
  }

  return false;
};

const exitAppFullscreen = async () => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return;
    }
    if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
      return;
    }
    if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (error) {
    console.warn('[Kiosk] Impossible de quitter le plein ecran:', error);
  }
};

export default function Kiosk() {
  const [cart, setCart] = useState([]);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [customizingMenu, setCustomizingMenu] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [orderType, setOrderType] = useState(null); // 'sur_place' ou 'emporter'
  const [showOrderTypeSelection, setShowOrderTypeSelection] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [exitCodeInput, setExitCodeInput] = useState("");
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false);
  const [catalogData, setCatalogData] = useState({
    profile: null,
    products: [],
    categories: [],
    menus: [],
    optionGroups: [],
    optionItems: [],
    ingredients: [],
    productIngredients: [],
    menuItems: [],
    offersRaw: [],
  });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogSyncMeta, setCatalogSyncMeta] = useState(null);
  const { toast } = useToast();

  // Récupérer le tenant_id depuis l'URL (format: /kiosk?tenant=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdFromUrl = urlParams.get('tenant');
  const forceMobileMode = urlParams.get('display') === 'mobile';
  const terminalRouteRequested = window.location.pathname === '/KioskTerminal' || urlParams.get('display') === 'terminal';
  const isTerminalMode = !forceMobileMode && terminalRouteRequested;

  useEffect(() => {
    if (!isTerminalMode) {
      return undefined;
    }

    const codeFromUrl = urlParams.get('exitCode');
    if (codeFromUrl) {
      window.localStorage.setItem('kiosk_exit_code', codeFromUrl);
    }

    const syncFullscreenState = () => {
      setIsFullscreenActive(Boolean(getFullscreenElement()));
    };

    const attemptFullscreen = async () => {
      const activated = await requestAppFullscreen();
      syncFullscreenState();
      if (!activated && !getFullscreenElement()) {
        setFullscreenBlocked(true);
      } else {
        setFullscreenBlocked(false);
      }
    };

    const handleFirstInteraction = () => {
      if (!getFullscreenElement()) {
        attemptFullscreen();
      }
    };

    syncFullscreenState();
    attemptFullscreen();

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    document.addEventListener('mozfullscreenchange', syncFullscreenState);
    document.addEventListener('MSFullscreenChange', syncFullscreenState);
    window.addEventListener('pointerdown', handleFirstInteraction, true);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      document.removeEventListener('mozfullscreenchange', syncFullscreenState);
      document.removeEventListener('MSFullscreenChange', syncFullscreenState);
      window.removeEventListener('pointerdown', handleFirstInteraction, true);
    };
  }, [isTerminalMode, urlParams]);

  const handleFullscreenRetry = async () => {
    const activated = await requestAppFullscreen();
    setIsFullscreenActive(Boolean(getFullscreenElement()));
    setFullscreenBlocked(!activated && !getFullscreenElement());
  };

  const restoreTerminalFullscreen = () => {
    if (!isTerminalMode || isExitDialogOpen) {
      return;
    }

    const retryFullscreen = () => {
      if (!getFullscreenElement()) {
        handleFullscreenRetry();
      }
    };

    setTimeout(retryFullscreen, 250);
    setTimeout(retryFullscreen, 900);
  };

  const handleExitCodeDigit = (digit) => {
    setExitCodeInput((current) => (current.length >= 8 ? current : `${current}${digit}`));
  };

  const handleExitCodeBackspace = () => {
    setExitCodeInput((current) => current.slice(0, -1));
  };

  const handleExitDialogChange = (open) => {
    setIsExitDialogOpen(open);
    if (!open) {
      setExitCodeInput("");
    }
  };

  const handleProtectedExit = async () => {
    if (exitCodeInput !== kioskExitCode) {
      toast({
        title: "Code incorrect",
        description: "Le code de sortie est invalide.",
        variant: "destructive"
      });
      setExitCodeInput("");
      return;
    }

    await exitAppFullscreen();
    handleExitDialogChange(false);
    window.location.href = '/';
  };

  const renderKioskShell = (content) => (
    <>
      {isTerminalMode && (
        <>
          <div className="fixed right-5 top-5 z-[120] flex items-center gap-3">
            {!isFullscreenActive && (
              <button
                type="button"
                onClick={handleFullscreenRetry}
                className="rounded-full bg-black/75 px-5 py-3 text-sm font-bold text-white shadow-xl backdrop-blur"
              >
                Plein ecran
              </button>
            )}
            <button
              type="button"
              onClick={() => handleExitDialogChange(true)}
              className="rounded-full border border-white/20 bg-white/85 px-5 py-3 text-sm font-bold text-slate-900 shadow-xl backdrop-blur"
            >
              Sortie
            </button>
          </div>

          {fullscreenBlocked && !isFullscreenActive && (
            <div className="fixed left-1/2 top-5 z-[110] -translate-x-1/2 rounded-full bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-900 shadow-lg">
              Appuyez sur "Plein ecran" si le navigateur a bloque l activation automatique.
            </div>
          )}

          <Dialog open={isExitDialogOpen} onOpenChange={handleExitDialogChange}>
            <DialogContent className="max-w-md rounded-[2rem] border-0 bg-white p-6">
              <DialogHeader>
                <DialogTitle>Sortir du mode borne</DialogTitle>
                <DialogDescription>Entrez le code de sortie pour quitter la borne.</DialogDescription>
              </DialogHeader>

              <Input
                type="password"
                inputMode="numeric"
                value={exitCodeInput}
                onChange={(e) => setExitCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Code de sortie"
                className="h-14 text-center text-2xl tracking-[0.4em]"
              />

              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleExitCodeDigit(digit)}
                    className={`rounded-2xl bg-slate-100 py-5 text-2xl font-black text-slate-900 transition hover:bg-slate-200 ${digit === '0' ? 'col-span-3' : ''}`}
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleExitCodeBackspace}
                  className="rounded-2xl bg-slate-200 px-4 py-4 font-bold text-slate-900 transition hover:bg-slate-300"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={handleProtectedExit}
                  className="rounded-2xl bg-red-600 px-4 py-4 font-bold text-white transition hover:bg-red-700"
                >
                  Quitter
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {content}
    </>
  );

  // Charger les données du tenant
  useEffect(() => {
    const loadTenantData = async () => {
      if (!tenantIdFromUrl) {
        toast({
          title: "Erreur",
          description: "Aucun commerce spécifié",
          variant: "destructive"
        });
        return;
      }

      try {
        const tenants = await appClient.entities.Tenant.filter(
          { id: tenantIdFromUrl },
          undefined,
          1,
          { fields: ['id', 'nom_commercial', 'active', 'owner_email'] }
        );
        if (tenants.length > 0) {
          setTenantData(tenants[0]);
        }
      } catch (error) {
        console.error("Erreur chargement tenant:", error);
      }
    };

    loadTenantData();
  }, [tenantIdFromUrl]);

  useEffect(() => {
    if (!tenantIdFromUrl) {
      return undefined;
    }

    let isActive = true;
    let cachedPayload = readKioskCatalogCache(tenantIdFromUrl);

    if (cachedPayload?.data) {
      setCatalogData(cachedPayload.data);
      setCatalogSyncMeta(cachedPayload.syncSnapshot || null);
      setCatalogLoading(false);
    }

    const syncCatalog = async () => {
      try {
        const remoteSnapshot = await fetchTenantSyncSnapshot(tenantIdFromUrl);
        const shouldRefresh = !cachedPayload?.data || shouldRefreshKioskCatalog(cachedPayload?.syncSnapshot, remoteSnapshot);

        if (shouldRefresh) {
          const freshCatalog = await fetchKioskCatalog(tenantIdFromUrl);
          const nextSnapshot = remoteSnapshot || freshCatalog.syncSnapshot || null;
          if (!isActive) return;

          const nextData = {
            profile: freshCatalog.profile,
            products: freshCatalog.products,
            categories: freshCatalog.categories,
            menus: freshCatalog.menus,
            optionGroups: freshCatalog.optionGroups,
            optionItems: freshCatalog.optionItems,
            ingredients: freshCatalog.ingredients,
            productIngredients: freshCatalog.productIngredients,
            menuItems: freshCatalog.menuItems,
            offersRaw: freshCatalog.offersRaw,
          };

          setCatalogData(nextData);
          setCatalogSyncMeta(nextSnapshot);
          cachedPayload = createKioskCachePayload(tenantIdFromUrl, nextData, nextSnapshot);
          writeKioskCatalogCache(
            tenantIdFromUrl,
            cachedPayload
          );
        } else if (remoteSnapshot && isActive) {
          setCatalogSyncMeta(remoteSnapshot);
          cachedPayload = cachedPayload
            ? { ...cachedPayload, syncSnapshot: remoteSnapshot }
            : cachedPayload;
        }

        if (isActive) {
          setCatalogError(null);
          setCatalogLoading(false);
        }
      } catch (error) {
        console.error('[Kiosk] Erreur sync catalogue:', error);
        if (!isActive) return;
        if (!cachedPayload?.data) {
          setCatalogError(error);
        }
        setCatalogLoading(false);
      }
    };

    let lastSyncAt = 0;
    const syncCatalogIfStale = () => {
      const now = Date.now();
      if (now - lastSyncAt < 30000) return;
      lastSyncAt = now;
      syncCatalog();
    };

    syncCatalogIfStale();

    const handleFocus = () => {
      syncCatalogIfStale();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCatalogIfStale();
      }
    };
    const handleActivity = () => {
      syncCatalogIfStale();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);

    return () => {
      isActive = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [tenantIdFromUrl]);

  const {
    profile,
    products,
    categories,
    menus,
    optionGroups,
    optionItems,
    ingredients,
    productIngredients,
    menuItems,
    offersRaw,
  } = catalogData;

  const kioskExitCode = useMemo(() => {
    const codeFromUrl = urlParams.get('exitCode');
    const codeFromProfile = profile?.page_pins?.KioskTerminalExit;
    const codeFromStorage = window.localStorage.getItem('kiosk_exit_code');
    return codeFromUrl || codeFromProfile || codeFromStorage || DEFAULT_KIOSK_EXIT_CODE;
  }, [profile?.page_pins, urlParams]);

  const borneOffers = useMemo(
    () => offersRaw.filter(o => (o.canaux || ['caisse']).includes('borne')),
    [offersRaw]
  );

  // Carrousel d'images - DOIT être avant les retours conditionnels
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const welcomeImages = isTerminalMode
    ? normalizeKioskWelcomeImages(profile?.kiosk_terminal_welcome_images || profile?.kiosk_welcome_images)
    : [];
  
  useEffect(() => {
    if (welcomeImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % welcomeImages.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [welcomeImages.length]);

  const currentWelcomeImage = welcomeImages[currentImageIndex];
  const currentWelcomeImageLabel = currentWelcomeImage?.title || getWelcomeImageLabel(currentWelcomeImage?.image_url);
  const welcomeTitleSizeClass = getWelcomeTitleSizeClass(profile?.kiosk_welcome_title_size);
  const welcomeTitleStyleClass = getWelcomeTitleStyleClass(profile?.kiosk_welcome_title_style);

  const onOrderCreated = (newOrder) => {
    setIsCreatingOrder(false);
    setShowPaymentOptions(false);
    setCompletedOrder(newOrder);
    setOrderSuccess(true);
    setOrderNumber(newOrder.numero_caisse);
    setTimeout(() => {
      setOrderSuccess(false);
      setOrderNumber(null);
      setOrderType(null);
      setShowWelcome(true);
      setCart([]);
      setCompletedOrder(null);
      setCustomerName("");
      setTableNumber("");
    }, 8000);
  };

  const createKioskOrder = async (orderData) => {
    const toParisDate = (date) => new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const today = toParisDate(new Date());
    const dateStr = format(today, 'yyyy-MM-dd');
    const formattedDate = format(today, 'ddMMyy');

    setIsCreatingOrder(true);
    try {
      try {
        const response = await appClient.functions.invoke('createKioskOrder', {
          tenantId: tenantIdFromUrl,
          dateStr,
          formattedDate,
          orderData,
        });
        const createdOrder = response?.data?.order || response?.order;
        if (!createdOrder) {
          throw new Error("Aucune commande retournée par la fonction createKioskOrder");
        }
        onOrderCreated(createdOrder);
        return;
      } catch (functionError) {
        console.warn('⚠️ Fallback création commande borne via entities.Order:', functionError);
      }

      const allOrders = await appClient.entities.Order.filter(
        { tenant_id: tenantIdFromUrl },
        undefined,
        undefined,
        { fields: ['id', 'numero_caisse', 'created_date'] }
      );
      const todayOrders = allOrders.filter(order => {
        if (!order?.created_date) return false;
        const normalized = String(order.created_date).replace(' ', 'T');
        const withTimezone = normalized.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(normalized)
          ? normalized
          : `${normalized}Z`;
        const orderDate = new Date(withTimezone);
        if (Number.isNaN(orderDate.getTime())) return false;
        return format(toParisDate(orderDate), 'yyyy-MM-dd') === dateStr;
      });

      const nextNumero = todayOrders.reduce((max, order) => Math.max(max, Number(order.numero_caisse) || 0), 0) + 1;
      const taxSummary = computeTaxSummaryFromArticles(orderData.articles || [], orderData.total_ttc || 0);

      const createdOrder = await appClient.entities.Order.create({
        tenant_id: tenantIdFromUrl,
        numero_caisse: nextNumero,
        numero_commande: `${nextNumero}-${formattedDate}`,
        from_kiosk: true,
        ...orderData,
        total_ht: orderData.total_ht ?? taxSummary.totalHt,
        total_tva: orderData.total_tva ?? taxSummary.totalTva,
        created_date: new Date().toISOString(),
      });

      onOrderCreated(createdOrder);
    } catch (error) {
      console.error('❌ Erreur création commande borne:', error);
      setIsCreatingOrder(false);
      toast({ title: "Erreur", description: "Impossible de créer la commande", variant: "destructive" });
    }
  };

  const handleAddToCart = (item) => {
    if (item.isMenu) {
      setCustomizingMenu(item);
    } else {
      const category = categories.find(c => c.id === item.category_id);
      if (category?.manages_sizes || 
          optionGroups.some(og => og.product_id === item.id) ||
          productIngredients.some(pi => pi.product_id === item.id && pi.retirable)) {
        setCustomizingProduct(item);
      } else {
        // Calculer le prix en tenant compte des prix différenciés
        let finalPrice = 0;
        const prixDifferencies = profile?.prix_differencies_par_mode === true;
        
        if (prixDifferencies && item.prix_par_mode) {
          const modePrice = item.prix_par_mode[orderType || 'emporter'];
          finalPrice = modePrice > 0 ? modePrice : (item.base_price || 0);
        } else {
          finalPrice = item.base_price || 0;
        }
        
        const cartItem = {
          product_id: item.id,
          isMenu: false,
          nom_produit: item.nom,
          quantite: 1,
          prix_unitaire: finalPrice,
          total_ligne: finalPrice,
          tva: item.tva || 5.5,
          options: [],
          exclusions: [],
          notes: ""
        };
        setCart(prev => [...prev, cartItem]);
      }
    }
  };

  const handleProductCustomized = (customizedData) => {
    const cartItem = {
      product_id: customizedData.product.id,
      isMenu: false,
      nom_produit: customizedData.selectedSize ? `${customizedData.product.nom} (${customizedData.selectedSize})` : customizedData.product.nom,
      quantite: customizedData.quantity,
      prix_unitaire: customizedData.finalPrice || 0,
      total_ligne: (customizedData.finalPrice || 0) * customizedData.quantity,
      tva: customizedData.product.tva || 5.5,
      selectedSize: customizedData.selectedSize,
      options: customizedData.selectedOptions || [],
      exclusions: customizedData.excludedIngredients || [],
      notes: customizedData.notes || ""
    };
    setCart(prev => [...prev, cartItem]);
    setCustomizingProduct(null);
  };

  const handleMenuCustomized = (customizedData) => {
    const cartItem = {
      menu_id: customizedData.menu?.id,
      isMenu: true,
      nom_produit: customizedData.menu?.nom || "Menu",
      quantite: 1,
      prix_unitaire: customizedData.totalPrice || 0,
      total_ligne: customizedData.totalPrice || 0,
      tva: 5.5,
      menuDetails: customizedData.menuArticles || [],
      notes: ""
    };
    setCart(prev => [...prev, cartItem]);
    setCustomizingMenu(null);
  };

  const handleUpdateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    const newCart = [...cart];
    newCart[index].quantite = newQuantity;
    newCart[index].total_ligne = newCart[index].prix_unitaire * newQuantity;
    setCart(newCart);
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleValidateOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant de valider",
        variant: "destructive"
      });
      return;
    }

    // Calculer et préparer le numéro de commande temporaire
    const toParisDate = (date) => new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const today = toParisDate(new Date());
    setOrderNumber(0); // Numéro temporaire, sera calculé à la création

    // Afficher les options de paiement AVANT de créer la commande
    setShowPaymentOptions(true);
  };

  // Ces états sont déplacés vers le haut pour respecter les règles des Hooks

  if (!tenantIdFromUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Erreur de configuration</h1>
          <p className="text-gray-600">Aucun commerce spécifié dans l'URL</p>
        </div>
      </div>
    );
  }

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Erreur de chargement</h1>
          <p className="text-gray-600">{catalogError.message}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-amber-50 p-4">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-xl">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acces public non configure</h1>
          <p className="text-gray-600 mb-4">
            La borne ne peut pas charger les donnees publiques de ce commerce pour le moment.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            Executez le script <strong>docs/SUPABASE_KIOSK_PUBLIC_RLS.sql</strong> dans Supabase pour autoriser la lecture publique minimale de la borne.
          </div>
        </div>
      </div>
    );
  }

  if (!profile?.manages_kiosk) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="text-center p-8 bg-white rounded-xl shadow-2xl max-w-lg">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-800 mb-3">🚫 Borne Inactive</h1>
          <p className="text-xl text-gray-700 mb-6">
            Cette borne de commande a été désactivée suite à un défaut de paiement.
          </p>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-lg font-semibold text-blue-900 mb-2">
              📞 Pour réactiver votre borne
            </p>
            <p className="text-blue-700">
              Contactez le support au <strong>01 XX XX XX XX</strong>
            </p>
            <p className="text-sm text-blue-600 mt-2">
              ou par email : <strong>contact@strasyk.com</strong>
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Régularisez votre situation pour retrouver l'accès à la borne.
          </p>
        </div>
      </div>
    );
  }

  // Écran de sélection du type de commande
  if (showOrderTypeSelection && !orderType) {
    const primaryColor = profile?.kiosk_primary_color || '#f97316';
    const secondaryColor = profile?.kiosk_secondary_color || '#ef4444';
    
    return renderKioskShell(
      <div 
        className={`flex min-h-screen p-4 md:p-8 ${isTerminalMode ? 'items-start justify-center pt-10 pb-10' : 'items-center justify-center'}`}
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className={`text-center w-full ${isTerminalMode ? 'max-w-[min(96vw,112rem)]' : 'max-w-5xl'}`}>
          <h1 className={isTerminalMode ? 'mb-3 text-[clamp(2rem,3vw,4rem)] font-bold text-gray-800' : 'text-2xl md:text-5xl font-bold text-gray-800 mb-3 md:mb-4'}>
            Comment souhaitez-vous consommer ?
          </h1>
          <p className={isTerminalMode ? 'mb-8 text-[clamp(1rem,1.5vw,1.75rem)] text-gray-600' : 'text-base md:text-2xl text-gray-600 mb-6 md:mb-12'}>Choisissez votre mode de commande</p>
          
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 mx-auto ${isTerminalMode ? 'max-w-[min(92vw,96rem)]' : 'max-w-4xl'}`}>
            {/* Sur place */}
            <button
              onClick={() => {
                setOrderType('sur_place');
                setShowOrderTypeSelection(false);
              }}
              className={`group relative bg-white rounded-3xl shadow-2xl transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] ${isTerminalMode ? 'min-h-[clamp(22rem,42vh,32rem)] p-[clamp(1.75rem,3vw,3.5rem)]' : 'p-6 md:p-12'}`}
            >
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              ></div>
              
              <div className="relative">
                <div className={`mx-auto rounded-full flex items-center justify-center text-white ${isTerminalMode ? 'mb-[clamp(1.25rem,2vw,2rem)] h-[clamp(5.5rem,9vw,9rem)] w-[clamp(5.5rem,9vw,9rem)]' : 'w-20 h-20 md:w-32 md:h-32 mb-4 md:mb-6'}`}
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  <svg className={isTerminalMode ? 'h-[clamp(2.75rem,4.5vw,4.75rem)] w-[clamp(2.75rem,4.5vw,4.75rem)]' : 'w-12 h-12 md:w-20 md:h-20'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                
                <h2 className={isTerminalMode ? 'mb-2 text-[clamp(1.75rem,2.5vw,3rem)] font-bold text-gray-800' : 'text-2xl md:text-4xl font-bold text-gray-800 mb-2'}>Sur place</h2>
                <p className={isTerminalMode ? 'text-[clamp(1rem,1.4vw,1.5rem)] text-gray-600' : 'text-base md:text-xl text-gray-600'}>Je consomme ici</p>
              </div>
            </button>

            {/* À emporter */}
            <button
              onClick={() => {
                setOrderType('emporter');
                setShowOrderTypeSelection(false);
              }}
              className={`group relative bg-white rounded-3xl shadow-2xl transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] ${isTerminalMode ? 'min-h-[clamp(22rem,42vh,32rem)] p-[clamp(1.75rem,3vw,3.5rem)]' : 'p-6 md:p-12'}`}
            >
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              ></div>
              
              <div className="relative">
                <div className={`mx-auto rounded-full flex items-center justify-center text-white ${isTerminalMode ? 'mb-[clamp(1.25rem,2vw,2rem)] h-[clamp(5.5rem,9vw,9rem)] w-[clamp(5.5rem,9vw,9rem)]' : 'w-20 h-20 md:w-32 md:h-32 mb-4 md:mb-6'}`}
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  <svg className={isTerminalMode ? 'h-[clamp(2.75rem,4.5vw,4.75rem)] w-[clamp(2.75rem,4.5vw,4.75rem)]' : 'w-12 h-12 md:w-20 md:h-20'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                
                <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-2">À emporter</h2>
                <p className="text-base md:text-xl text-gray-600">Je repars avec</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran d'accueil de la borne
  if (showWelcome && !orderSuccess && cart.length === 0) {
    const primaryColor = profile?.kiosk_primary_color || '#f97316';
    const secondaryColor = profile?.kiosk_secondary_color || '#ef4444';

    if (isTerminalMode) {
      return renderKioskShell(
        <div
          className="min-h-screen px-[clamp(1rem,2vw,2rem)] py-[clamp(1rem,2vh,2rem)]"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}18 0%, ${secondaryColor}18 100%)`
          }}
        >
          <div className="mx-auto flex min-h-[calc(100vh-clamp(2rem,4vh,4rem))] w-full max-w-[min(96vw,112rem)] flex-col overflow-hidden rounded-[clamp(1.5rem,2vw,2rem)] bg-white shadow-2xl">
            <div className="flex items-center justify-center gap-[clamp(1rem,2vw,1.5rem)] border-b px-[clamp(1rem,3vw,2.5rem)] py-[clamp(1rem,2.5vh,2rem)]">
              <div className="flex items-center gap-[clamp(1rem,2vw,1.5rem)] min-w-0">
                {profile?.logo_url && (
                  <img
                    src={profile.logo_url}
                    alt="Logo"
                    className="h-[clamp(5rem,8vw,8rem)] w-[clamp(5rem,8vw,8rem)] shrink-0 rounded-[clamp(1rem,1.6vw,1.5rem)] object-contain bg-white"
                  />
                )}
                <div className="min-w-0 text-center">
                  <h1 className="truncate text-[clamp(2rem,4.2vw,4.75rem)] font-black tracking-tight text-gray-900">
                    {tenantData?.nom_commercial || profile?.nom_etablissement || "Bienvenue"}
                  </h1>
                  <p className="mt-3 text-[clamp(1rem,1.5vw,1.8rem)] text-gray-500">
                    {profile?.telephone || ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col bg-slate-50">
              <div className="flex flex-1 items-center justify-center p-[clamp(1rem,2vw,2rem)]">
                {welcomeImages.length > 0 ? (
                  <div className="w-full max-w-[min(88vw,84rem)]">
                    <div className="mb-[clamp(0.75rem,1.5vh,1.25rem)] text-center">
                      <p className={`${welcomeTitleSizeClass} ${welcomeTitleStyleClass} text-gray-900`}>
                        {currentWelcomeImageLabel}
                      </p>
                    </div>
                    <div className="relative h-[clamp(20rem,48vh,44rem)] min-h-[20rem] w-full overflow-hidden rounded-[clamp(1.25rem,2vw,2rem)] shadow-xl">
                    {welcomeImages.map((imageItem, idx) => (
                      <img
                        key={idx}
                        src={imageItem.image_url}
                        alt={`Image ${idx + 1}`}
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                          idx === currentImageIndex ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      ))}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-[clamp(1rem,2vw,2rem)] pb-[clamp(1rem,2vh,2rem)] pt-[clamp(3rem,9vh,6rem)]">
                        <p className="text-[clamp(1.15rem,1.9vw,2.2rem)] font-bold text-white">
                          {profile?.kiosk_welcome_message || "Commandez en toute simplicite"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex h-full min-h-[20rem] w-full max-w-[min(88vw,84rem)] items-center justify-center rounded-[clamp(1.25rem,2vw,2rem)] p-[clamp(1.5rem,3vw,2.5rem)] text-center text-white shadow-xl"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                    }}
                  >
                    <div>
                      <p className="text-[clamp(2rem,4vw,4rem)] font-black">{tenantData?.nom_commercial || "Bienvenue"}</p>
                      <p className="mt-5 text-[clamp(1rem,1.6vw,1.8rem)] opacity-95">
                        {profile?.kiosk_welcome_message || "Commandez en toute simplicite"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t bg-white px-[clamp(1rem,3vw,2.5rem)] py-[clamp(1rem,2.5vh,2rem)] text-center">
                <p className="mx-auto max-w-[min(88vw,72rem)] text-[clamp(1rem,1.4vw,1.65rem)] leading-relaxed text-gray-600">
                  {profile?.kiosk_welcome_message || "Commandez en toute simplicite"}
                </p>
                <button
                  onClick={() => {
                    setShowWelcome(false);
                    setShowOrderTypeSelection(true);
                  }}
                  className="mt-[clamp(1rem,2vh,2rem)] rounded-[clamp(1rem,1.6vw,1.5rem)] px-[clamp(2rem,4vw,4rem)] py-[clamp(1rem,2vh,1.75rem)] text-[clamp(1.2rem,2vw,2.25rem)] font-black text-white shadow-xl transition-all hover:scale-[1.03]"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                  }}
                >
                  Commencer ma commande
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50 px-[clamp(1rem,3vw,2.5rem)] py-[clamp(0.9rem,1.8vh,1.4rem)] text-[clamp(0.9rem,1.15vw,1.15rem)] text-gray-600">
              <div>{profile?.adresse || "Merci de votre visite"}</div>
              <div>{profile?.telephone || ""}</div>
            </div>
          </div>
        </div>
      );
    }
    
    return renderKioskShell(
      <div 
        className={`flex min-h-screen p-4 ${isTerminalMode ? 'items-start justify-center pt-10 pb-10' : 'items-center justify-center'}`}
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className={`text-center bg-white rounded-3xl shadow-2xl w-full ${isTerminalMode ? 'max-w-[1500px] p-8 md:p-14' : 'max-w-2xl p-6 md:p-12'}`}>
          {profile?.logo_url && (
            <img 
              src={profile.logo_url} 
              alt="Logo" 
              className="w-20 h-20 md:w-32 md:h-32 object-contain mx-auto mb-4 md:mb-6"
            />
          )}
          
          <h1 className="text-2xl md:text-5xl font-bold text-gray-800 mb-3 md:mb-4">
            {tenantData?.nom_commercial || "Bienvenue"}
          </h1>
          
          <p className="text-base md:text-2xl text-gray-600 mb-6 md:mb-8">
            {profile?.kiosk_welcome_message || "Commandez en toute simplicité"}
          </p>
          
          <button
            onClick={() => {
              setShowWelcome(false);
              setShowOrderTypeSelection(true);
            }}
            className="px-8 py-4 md:px-12 md:py-6 rounded-2xl text-white text-lg md:text-2xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            Commencer ma commande
          </button>
        </div>
      </div>
    );
  }

  // Écran des options de paiement
  if (showPaymentOptions && cart.length > 0) {
    const primaryColor = profile?.kiosk_primary_color || '#f97316';
    const secondaryColor = profile?.kiosk_secondary_color || '#ef4444';
    const cardPaymentEnabled = profile?.kiosk_card_payment_enabled || false;
    
    // Afficher un message temporaire en attendant la création
    const displayNumber = "...";

    // Calculer les réductions d'offres borne
    const kioskOrderType = orderType || "emporter";
    const offerDiscounts = calculateOfferDiscounts(cart, borneOffers, kioskOrderType, products);
    const offerDiscountTotal = offerDiscounts.reduce((sum, d) => sum + d.amount, 0);

    const baseTotal = cart.reduce((sum, item) => sum + item.prix_unitaire * item.quantite, 0);
    const subTotalWithOffers = baseTotal + offerDiscountTotal;
    const promoDiscount = promoApplied
      ? (promoApplied.type === 'percentage'
          ? Math.round(subTotalWithOffers * promoApplied.value) / 100
          : Math.min(promoApplied.value, subTotalWithOffers))
      : 0;
    const totalTTC = Math.max(0, subTotalWithOffers - promoDiscount);

    const handleCheckPromo = async () => {
      if (!promoInput.trim()) return;
      setPromoLoading(true);
      setPromoError("");
      const codes = await appClient.entities.PromoCode.filter(
        { tenant_id: tenantIdFromUrl, code: promoInput.trim().toUpperCase(), active: true },
        undefined,
        1,
        { fields: ['id', 'tenant_id', 'code', 'active', 'type', 'value', 'expires_at', 'usage_limit', 'usage_count', 'canaux'] }
      );
      setPromoLoading(false);
      if (codes.length === 0) { setPromoError("Code invalide ou expiré"); return; }
      const code = codes[0];
      const notExpired = !code.expires_at || new Date(code.expires_at) > new Date();
      const notOverLimit = !code.usage_limit || code.usage_count < code.usage_limit;
      const validCanaux = (code.canaux || ['caisse']).includes('borne');
      if (!notExpired || !notOverLimit || !validCanaux) { setPromoError("Code non valide pour la borne"); return; }
      setPromoApplied(code);
    };

    // Articles avec lignes de réduction d'offres + promo
    const articlesWithOffers = [...cart];
    offerDiscounts.forEach(d => {
      articlesWithOffers.push({
        product_id: `offer-${d.id}`,
        nom_produit: `🎁 Offre: ${d.name}`,
        quantite: 1,
        prix_unitaire: d.amount,
        total_ligne: d.amount,
        tva: 0,
        options: [],
        exclusions: [],
      });
    });

    const buildFinalArticles = () => {
      const arts = [...articlesWithOffers];
      if (promoDiscount > 0 && promoApplied) {
        arts.push({
          product_id: `promo-${promoApplied.code}`,
          nom_produit: `🏷️ Code promo: ${promoApplied.code}`,
          quantite: 1,
          prix_unitaire: -promoDiscount,
          total_ligne: -promoDiscount,
          tva: 0,
          options: [],
          exclusions: [],
        });
      }
      return arts;
    };

    const handlePayAtCounter = () => {
      const finalArticles = buildFinalArticles();
      const taxSummary = computeTaxSummaryFromArticles(finalArticles, totalTTC);
      createKioskOrder({
        type_commande: kioskOrderType,
        articles: finalArticles,
        total_ht: taxSummary.totalHt,
        total_tva: taxSummary.totalTva,
        total_ttc: totalTTC,
        statut: "en_attente_paiement",
        payee: false,
        customer_name: customerName.trim() || null,
        numero_table: kioskOrderType === 'sur_place' ? (tableNumber.trim() || null) : null,
        notes: "Commande depuis la borne - Paiement à la caisse",
        from_kiosk: true,
        print_at_counter: true,
      });
    };

    const handleCardPayment = () => {
      toast({ title: "Paiement par carte", description: "Veuillez insérer votre carte dans le terminal" });
      setTimeout(() => {
        const finalArticles = buildFinalArticles();
        const taxSummary = computeTaxSummaryFromArticles(finalArticles, totalTTC);
        createKioskOrder({
          type_commande: kioskOrderType,
          articles: finalArticles,
          total_ht: taxSummary.totalHt,
          total_tva: taxSummary.totalTva,
          total_ttc: totalTTC,
          statut: "payé",
          payee: true,
          customer_name: customerName.trim() || null,
          numero_table: kioskOrderType === 'sur_place' ? (tableNumber.trim() || null) : null,
          mode_paiement: [{ methode: 'carte_bancaire', montant: totalTTC }],
          notes: "Commande depuis la borne - Payée par carte",
          from_kiosk: true,
          print_at_counter: true,
        });
      }, 1500);
    };
    
    return renderKioskShell(
      <div 
        className={`flex min-h-screen p-4 md:p-8 ${isTerminalMode ? 'items-start justify-center pt-10 pb-10' : 'items-center justify-center'}`}
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className={`text-center w-full bg-white rounded-3xl shadow-2xl ${isTerminalMode ? 'max-w-[min(94vw,96rem)] p-[clamp(1.5rem,3vw,3.5rem)]' : 'max-w-3xl p-6 md:p-12'}`}>
          <div className={`${isTerminalMode ? 'mb-[clamp(1rem,2vh,1.75rem)] h-[clamp(4.5rem,7vw,7rem)] w-[clamp(4.5rem,7vw,7rem)]' : 'w-16 h-16 md:w-24 md:h-24 mb-4 md:mb-6'} rounded-full flex items-center justify-center mx-auto`}
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
          >
            <ShoppingBag className={isTerminalMode ? 'h-[clamp(2rem,3vw,3.5rem)] w-[clamp(2rem,3vw,3.5rem)] text-white' : 'w-8 h-8 md:w-12 md:h-12 text-white'} />
          </div>
          <h1 className={isTerminalMode ? 'mb-3 text-[clamp(2rem,3vw,3.75rem)] font-bold text-gray-800' : 'text-2xl md:text-5xl font-bold text-gray-800 mb-3 md:mb-4'}>Récapitulatif</h1>
          {offerDiscounts.length > 0 && (
            <div className="mb-3 space-y-1">
              {offerDiscounts.map(d => (
                <div key={d.id} className="flex items-center justify-center gap-2 text-purple-600 font-semibold text-lg">
                  <span>🎁 {d.name}</span><span>{d.amount.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-lg mb-1">
              <span>🏷️ Code promo ({promoApplied.code})</span><span>-{promoDiscount.toFixed(2)}€</span>
            </div>
          )}
          <p className={isTerminalMode ? 'mb-2 text-[clamp(1.1rem,1.6vw,1.8rem)] text-gray-600' : 'text-lg md:text-2xl text-gray-600 mb-2'}>Total à payer :</p>
          <p className={isTerminalMode ? 'mb-6 text-[clamp(2.5rem,5vw,5rem)] font-bold' : 'text-4xl md:text-6xl font-bold mb-5 md:mb-8'} style={{ color: primaryColor }}>{totalTTC.toFixed(2)} €</p>

          {/* Code promo */}
          <div className="mb-5">
            <label className="block text-lg font-semibold text-gray-700 mb-2">Code promo (optionnel)</label>
            {promoApplied ? (
              <div className="flex items-center justify-between bg-green-50 border-2 border-green-300 rounded-xl px-4 py-3">
                <span className="font-bold text-green-700 text-lg">✅ {promoApplied.code} appliqué</span>
                <button onClick={() => { setPromoApplied(null); setPromoInput(""); }} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                  placeholder="Votre code promo"
                  className="flex-1 text-xl border-2 border-gray-300 focus:border-orange-400 rounded-xl px-5 py-4 outline-none font-medium uppercase"
                />
                <button
                  onClick={handleCheckPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="px-6 py-4 text-white rounded-xl text-xl font-bold disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {promoLoading ? '...' : 'OK'}
                </button>
              </div>
            )}
            {promoError && <p className="text-red-500 text-base mt-2">{promoError}</p>}
          </div>

          {/* Champ prénom */}
          <div className={`mb-6 grid gap-4 ${kioskOrderType === 'sur_place' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Votre prénom (optionnel)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Marie"
                maxLength={30}
                className="w-full text-xl border-2 border-gray-300 focus:border-orange-400 rounded-xl px-5 py-4 outline-none text-center font-medium"
              />
            </div>
            {kioskOrderType === 'sur_place' && (
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Numéro de table</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ex: 12"
                  maxLength={12}
                  className="w-full text-xl border-2 border-gray-300 focus:border-orange-400 rounded-xl px-5 py-4 outline-none text-center font-medium"
                />
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className={isTerminalMode ? 'mb-4 text-[clamp(1.1rem,1.6vw,1.6rem)] font-semibold text-gray-700' : 'text-xl font-semibold text-gray-700 mb-4'}>Comment souhaitez-vous payer ?</p>
            <div className={`grid ${cardPaymentEnabled ? 'grid-cols-2' : 'grid-cols-1'} ${isTerminalMode ? 'gap-6 max-w-[1200px] mx-auto' : 'gap-4'}`}>
              {cardPaymentEnabled && (
                <button
                  onClick={handleCardPayment}
                  disabled={isCreatingOrder}
                  className={`flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-2xl transition-all transform hover:scale-[1.03] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isTerminalMode ? 'min-h-[clamp(10rem,24vh,15rem)] py-[clamp(1.25rem,2.5vh,2rem)] text-[clamp(1rem,1.5vw,1.5rem)]' : 'text-base md:text-xl py-5 md:py-8'}`}
                >
                  <CreditCard className={isTerminalMode ? 'h-[clamp(2rem,3vw,3.5rem)] w-[clamp(2rem,3vw,3.5rem)]' : 'w-8 h-8 md:w-12 md:h-12'} />
                  Payer par carte
                </button>
              )}
              
              <button
                onClick={handlePayAtCounter}
                disabled={isCreatingOrder}
                className={`flex flex-col items-center justify-center gap-3 text-white font-bold rounded-2xl transition-all transform hover:scale-[1.03] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isTerminalMode ? 'min-h-[clamp(10rem,24vh,15rem)] py-[clamp(1.25rem,2.5vh,2rem)] text-[clamp(1rem,1.5vw,1.5rem)]' : 'text-base md:text-xl py-5 md:py-8'}`}
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                }}
              >
                <Wallet className={isTerminalMode ? 'h-[clamp(2rem,3vw,3.5rem)] w-[clamp(2rem,3vw,3.5rem)]' : 'w-8 h-8 md:w-12 md:h-12'} />
                Payer à la caisse
              </button>
            </div>
          </div>

          {!isCreatingOrder && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => setShowPaymentOptions(false)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-lg font-semibold py-4 rounded-xl transition-all"
              >
                ← Modifier
              </button>
              <button
                onClick={() => {
                  setShowPaymentOptions(false);
                  setCart([]);
                  setOrderType(null);
                  setCustomerName("");
                  setShowWelcome(true);
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-lg font-semibold py-4 rounded-xl transition-all"
              >
                ✕ Annuler
              </button>
            </div>
          )}
          {isCreatingOrder && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-orange-500"></div>
              <p className="text-gray-600 font-medium">Envoi de la commande...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    const primaryColor = profile?.kiosk_primary_color || '#f97316';
    const isPaidOrder = completedOrder?.payee === true;

    const handlePrintTicket = async () => {
      if (!completedOrder) {
        return;
      }

      if (isTerminalMode) {
        const ticketHtml = generateKioskClientReceiptHtml(completedOrder, profile);
        if (!ticketHtml) {
          return;
        }

        triggerPrint(ticketHtml, () => {
          toast({
            title: "Ticket imprime",
            description: "Recuperez votre ticket a l'imprimante"
          });
          restoreTerminalFullscreen();
        }, { strategy: 'current-window', immediate: true });
        return;
      }

      const ticketHtml = await generateTicketHtml(completedOrder, null, profile);
      if (ticketHtml) {
        triggerPrint(ticketHtml, () => {
          toast({
            title: "Ticket imprime",
            description: "Recuperez votre ticket a l'imprimante"
          });
        });
      }
    };

    if (isTerminalMode) {
      return renderKioskShell(
        <div
          className="flex min-h-screen items-center justify-center p-4 md:p-8"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}22 0%, #ecfeff 100%)`
          }}
        >
          <div className="w-full max-w-[min(92vw,70rem)] rounded-[2rem] bg-white p-[clamp(1.75rem,3vw,3.5rem)] text-center shadow-2xl">
            <CheckCircle className="mx-auto mb-6 h-[clamp(4.5rem,8vw,7rem)] w-[clamp(4.5rem,8vw,7rem)] text-green-500" />
            <h1 className="mb-3 text-[clamp(2rem,4vw,4rem)] font-black text-gray-900">Merci !</h1>
            <p className="text-[clamp(1.1rem,1.8vw,1.8rem)] text-gray-600">Votre commande</p>
            <p
              className="mb-5 text-[clamp(3rem,7vw,6rem)] font-black"
              style={{ color: primaryColor }}
            >
              B{orderNumber}
            </p>

            <div className="mx-auto mb-6 max-w-3xl rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-5">
              <p className="text-[clamp(1.05rem,1.6vw,1.5rem)] font-bold text-gray-800">
                {isPaidOrder ? 'Commande payee' : 'Commande a regler a la caisse'}
              </p>
              <p className="mt-2 text-[clamp(1rem,1.45vw,1.35rem)] text-gray-600">
                La commande B{orderNumber} est en preparation.
              </p>
            </div>

            <div className="mx-auto max-w-3xl rounded-[1.5rem] border-2 border-dashed border-orange-300 bg-orange-50 px-6 py-5">
              <p className="text-[clamp(1rem,1.45vw,1.3rem)] font-semibold text-orange-900">
                Si vous souhaitez un vrai ticket detaille, demandez-le a la caisse.
              </p>
            </div>

            {completedOrder && (
              <button
                onClick={handlePrintTicket}
                className="mt-6 inline-flex items-center justify-center gap-3 rounded-[1.25rem] bg-blue-600 px-[clamp(1.75rem,3vw,3rem)] py-[clamp(1rem,1.8vh,1.35rem)] text-[clamp(1rem,1.4vw,1.3rem)] font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-blue-700"
              >
                <Printer className="h-6 w-6" />
                Imprimer mon ticket
              </button>
            )}
          </div>
        </div>
      );
    }
    
    return renderKioskShell(
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center p-6 md:p-12 bg-white rounded-2xl shadow-2xl max-w-md w-11/12 mx-auto md:mx-0 md:w-auto">
          <CheckCircle className="w-16 h-16 md:w-24 md:h-24 text-green-500 mx-auto mb-4 md:mb-6 animate-bounce" />
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-3 md:mb-4">Merci !</h1>
          <p className="text-lg md:text-2xl text-gray-600 mb-2">Votre commande :</p>
          <p className="text-4xl md:text-6xl font-bold mb-4 md:mb-6" style={{ color: primaryColor }}>B{orderNumber}</p>
          <p className="text-base md:text-lg text-gray-600 mb-4">La commande B{orderNumber} est en préparation</p>
          <p className="text-sm md:text-base font-semibold text-gray-700 mb-2">
            {isPaidOrder ? 'Commande payee' : 'Commande a regler a la caisse'}
          </p>
          
          {completedOrder && (
            <button
              onClick={handlePrintTicket}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              <Printer className="w-6 h-6" />
              Imprimer mon ticket
            </button>
          )}
        </div>
      </div>
    );
  }

  const primaryColor = profile?.kiosk_primary_color || '#f97316';
  const secondaryColor = profile?.kiosk_secondary_color || '#ef4444';
  const cartTotal = cart.reduce((sum, item) => sum + item.prix_unitaire * item.quantite, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantite, 0);

  return renderKioskShell(
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div 
        className="text-white p-3 md:p-6 shadow-lg flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
        }}
      >
        <div className="flex items-center justify-between mb-1 md:mb-2">
          <div className="flex-1"></div>
          <h1 className="text-base md:text-3xl font-bold flex-1 text-center">
            {tenantData?.nom_commercial || "Borne de Commande"}
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => {
                setOrderType(null);
                setShowOrderTypeSelection(true);
              }}
              className="flex items-center gap-1 md:gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2 py-1.5 md:px-6 md:py-3 rounded-xl transition-all"
            >
              <div className="flex items-center gap-1 md:gap-2">
                {orderType === 'sur_place' ? (
                  <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                )}
                <span className="text-xs md:text-xl font-bold hidden sm:inline">
                  {orderType === 'sur_place' ? 'Sur place' : 'À emporter'}
                </span>
              </div>
              <svg className="w-3 h-3 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-center text-xs opacity-90 hidden sm:block">
          {profile?.kiosk_welcome_message || "Commandez en toute simplicité"}
        </p>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Grille de produits */}
        <div className="flex-1 overflow-hidden">
            <KioskProductGrid
              products={products}
              categories={categories}
              menus={menus}
              onAddToCart={handleAddToCart}
              cart={cart}
              hasMobileCartBar={cart.length > 0}
              terminalMode={isTerminalMode}
            />
          </div>

          {/* Panier - desktop uniquement */}
        <div className={`hidden md:flex flex-col border-l bg-white ${isTerminalMode ? 'w-[clamp(22rem,28vw,30rem)]' : 'w-96'}`}>
          <KioskCart
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onValidate={handleValidateOrder}
            offers={borneOffers}
            orderType={orderType || 'emporter'}
            products={products}
            terminalMode={isTerminalMode}
          />
        </div>
      </div>

      {/* Mobile: barre panier sticky */}
      {cart.length > 0 && (
        <div className="md:hidden flex-shrink-0">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full text-white flex items-center justify-between px-5 py-4 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
          >
            <span className="bg-white/20 rounded-full px-3 py-1 text-sm font-bold">
              {cartCount} article{cartCount > 1 ? 's' : ''}
            </span>
            <span className="font-bold text-base">Voir mon panier</span>
            <span className="font-bold text-lg">{cartTotal.toFixed(2)} €</span>
          </button>
        </div>
      )}

      {/* Mobile: overlay panier */}
      {showMobileCart && (
        <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col">
          <div
            className="flex items-center gap-3 p-4 flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
          >
            <button
              onClick={() => setShowMobileCart(false)}
              className="text-white bg-white/20 rounded-xl p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white text-xl font-bold">Mon panier</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <KioskCart
              cart={cart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onValidate={() => { setShowMobileCart(false); handleValidateOrder(); }}
              offers={borneOffers}
              orderType={orderType || 'emporter'}
              products={products}
              terminalMode={isTerminalMode}
            />
          </div>
        </div>
      )}

      {/* Modals de personnalisation */}
      {customizingProduct && (
        <ProductCustomizationModal
          product={customizingProduct}
          category={categories.find(c => c.id === customizingProduct.category_id)}
          onConfirm={handleProductCustomized}
          onCancel={() => setCustomizingProduct(null)}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allIngredients={ingredients}
          allProductIngredients={productIngredients}
          orderType={orderType || "emporter"}
          profile={profile}
        />
      )}

      {customizingMenu && (
        <MenuCustomizationModal
          menu={customizingMenu}
          products={products}
          categories={categories}
          menuItems={menuItems}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allIngredients={ingredients}
          allProductIngredients={productIngredients}
          onConfirm={handleMenuCustomized}
          onCancel={() => setCustomizingMenu(null)}
          orderType={orderType || "emporter"}
          profile={profile}
        />
      )}
    </div>
  );
}


