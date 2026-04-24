import React, { useState, useEffect, useMemo } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, Printer, CreditCard, Wallet, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import KioskProductGrid from "../components/borne/KioskProductGrid";
import KioskCart from "../components/borne/KioskCart";
import ProductCustomizationModal from "../components/caisse/ProductCustomizationModal";
import MenuCustomizationModal from "../components/caisse/MenuCustomizationModal";
import { useToast } from "@/components/ui/use-toast";
import { generateTicketHtml, triggerPrint } from "../components/caisse/ticketUtils";
import { calculateOfferDiscounts } from "@/utils/offerUtils";
import { computeTaxSummaryFromArticles } from "../components/utils/taxUtils";

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
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [orderType, setOrderType] = useState(null); // 'sur_place' ou 'emporter'
  const [showOrderTypeSelection, setShowOrderTypeSelection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer le tenant_id depuis l'URL (format: /kiosk?tenant=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdFromUrl = urlParams.get('tenant');

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
        const tenants = await appClient.entities.Tenant.filter({ id: tenantIdFromUrl });
        if (tenants.length > 0) {
          setTenantData(tenants[0]);
        }
      } catch (error) {
        console.error("Erreur chargement tenant:", error);
      }
    };

    loadTenantData();
  }, [tenantIdFromUrl]);

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['restaurantProfile', tenantIdFromUrl],
    queryFn: async () => {
      if (!tenantIdFromUrl) return null;
      const profiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: tenantIdFromUrl });
      return profiles[0] || null;
    },
    enabled: !!tenantIdFromUrl,
    refetchInterval: 5000  // Recharger toutes les 5 secondes pour détecter les changements
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', tenantIdFromUrl],
    queryFn: () => appClient.entities.Product.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', tenantIdFromUrl],
    queryFn: () => appClient.entities.Category.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: menus = [] } = useQuery({
    queryKey: ['menus', tenantIdFromUrl],
    queryFn: () => appClient.entities.MenuFormula.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: optionGroups = [] } = useQuery({
    queryKey: ['optionGroups', tenantIdFromUrl],
    queryFn: () => appClient.entities.OptionGroup.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: optionItems = [] } = useQuery({
    queryKey: ['optionItems', tenantIdFromUrl],
    queryFn: () => appClient.entities.OptionItem.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients', tenantIdFromUrl],
    queryFn: () => appClient.entities.Ingredient.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: productIngredients = [] } = useQuery({
    queryKey: ['productIngredients', tenantIdFromUrl],
    queryFn: () => appClient.entities.ProductIngredient.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems', tenantIdFromUrl],
    queryFn: () => appClient.entities.MenuFormulaItem.filter({ tenant_id: tenantIdFromUrl }),
    enabled: !!tenantIdFromUrl
  });

  const { data: offersRaw = [] } = useQuery({
    queryKey: ['kiosk-offers', tenantIdFromUrl],
    queryFn: () => appClient.entities.Offer.filter({ tenant_id: tenantIdFromUrl, active: true }),
    enabled: !!tenantIdFromUrl
  });
  const borneOffers = useMemo(
    () => offersRaw.filter(o => (o.canaux || ['caisse']).includes('borne')),
    [offersRaw]
  );

  // Carrousel d'images - DOIT être avant les retours conditionnels
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const welcomeImages = profile?.kiosk_welcome_images || [];
  
  useEffect(() => {
    if (welcomeImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % welcomeImages.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [welcomeImages.length]);

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

      const allOrders = await appClient.entities.Order.filter({ tenant_id: tenantIdFromUrl });
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

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Erreur de chargement</h1>
          <p className="text-gray-600">{profileError.message}</p>
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
    
    return (
      <div 
        className="flex items-center justify-center min-h-screen p-4 md:p-8"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className="text-center max-w-5xl w-full">
          <h1 className="text-2xl md:text-5xl font-bold text-gray-800 mb-3 md:mb-4">
            Comment souhaitez-vous consommer ?
          </h1>
          <p className="text-base md:text-2xl text-gray-600 mb-6 md:mb-12">Choisissez votre mode de commande</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 max-w-4xl mx-auto">
            {/* Sur place */}
            <button
              onClick={() => {
                setOrderType('sur_place');
                setShowOrderTypeSelection(false);
              }}
              className="group relative bg-white rounded-3xl shadow-2xl p-6 md:p-12 transition-all duration-300 hover:shadow-3xl hover:scale-105"
            >
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              ></div>
              
              <div className="relative">
                <div className="w-20 h-20 md:w-32 md:h-32 mx-auto mb-4 md:mb-6 rounded-full flex items-center justify-center text-white"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  <svg className="w-12 h-12 md:w-20 md:h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                
                <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-2">Sur place</h2>
                <p className="text-base md:text-xl text-gray-600">Je consomme ici</p>
              </div>
            </button>

            {/* À emporter */}
            <button
              onClick={() => {
                setOrderType('emporter');
                setShowOrderTypeSelection(false);
              }}
              className="group relative bg-white rounded-3xl shadow-2xl p-6 md:p-12 transition-all duration-300 hover:shadow-3xl hover:scale-105"
            >
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
              ></div>
              
              <div className="relative">
                <div className="w-20 h-20 md:w-32 md:h-32 mx-auto mb-4 md:mb-6 rounded-full flex items-center justify-center text-white"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  <svg className="w-12 h-12 md:w-20 md:h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    
    return (
      <div 
        className="flex items-center justify-center min-h-screen p-4"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className="text-center p-6 md:p-12 bg-white rounded-3xl shadow-2xl max-w-2xl w-full">
          {profile?.logo_url && (
            <img 
              src={profile.logo_url} 
              alt="Logo" 
              className="w-20 h-20 md:w-32 md:h-32 object-contain mx-auto mb-4 md:mb-6"
            />
          )}
          
          {welcomeImages.length > 0 && (
            <div className="relative w-full max-h-64 mb-6 overflow-hidden rounded-xl">
              {welcomeImages.map((imgUrl, idx) => (
                <img 
                  key={idx}
                  src={imgUrl} 
                  alt={`Image ${idx + 1}`}
                  className={`w-full h-64 object-cover transition-opacity duration-1000 ${
                    idx === currentImageIndex ? 'opacity-100' : 'opacity-0 absolute top-0 left-0'
                  }`}
                />
              ))}
              {welcomeImages.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  {welcomeImages.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentImageIndex ? 'bg-white w-6' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
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
      const codes = await appClient.entities.PromoCode.filter({ tenant_id: tenantIdFromUrl, code: promoInput.trim().toUpperCase(), active: true });
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
          mode_paiement: [{ methode: 'carte_bancaire', montant: totalTTC }],
          notes: "Commande depuis la borne - Payée par carte",
          from_kiosk: true,
          print_at_counter: true,
        });
      }, 1500);
    };
    
    return (
      <div 
        className="flex items-center justify-center min-h-screen p-4 md:p-8"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%)`
        }}
      >
        <div className="text-center max-w-3xl w-full bg-white rounded-3xl shadow-2xl p-6 md:p-12">
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6"
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
          >
            <ShoppingBag className="w-8 h-8 md:w-12 md:h-12 text-white" />
          </div>
          <h1 className="text-2xl md:text-5xl font-bold text-gray-800 mb-3 md:mb-4">Récapitulatif</h1>
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
          <p className="text-lg md:text-2xl text-gray-600 mb-2">Total à payer :</p>
          <p className="text-4xl md:text-6xl font-bold mb-5 md:mb-8" style={{ color: primaryColor }}>{totalTTC.toFixed(2)} €</p>

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
          <div className="mb-6">
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

          <div className="mb-6">
            <p className="text-xl font-semibold text-gray-700 mb-4">Comment souhaitez-vous payer ?</p>
            <div className={`grid ${cardPaymentEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {cardPaymentEnabled && (
                <button
                  onClick={handleCardPayment}
                  disabled={isCreatingOrder}
                  className="flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base md:text-xl font-bold py-5 md:py-8 rounded-2xl transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-8 h-8 md:w-12 md:h-12" />
                  Payer par carte
                </button>
              )}
              
              <button
                onClick={handlePayAtCounter}
                disabled={isCreatingOrder}
                className="flex flex-col items-center justify-center gap-3 text-white text-base md:text-xl font-bold py-5 md:py-8 rounded-2xl transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                }}
              >
                <Wallet className="w-8 h-8 md:w-12 md:h-12" />
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
    
    const handlePrintTicket = () => {
      if (completedOrder) {
        const ticketHtml = generateTicketHtml(completedOrder, null, profile);
        if (ticketHtml) {
          triggerPrint(ticketHtml, () => {
            toast({
              title: "Ticket imprimé",
              description: "Récupérez votre ticket à l'imprimante"
            });
          });
        }
      }
    };
    
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center p-6 md:p-12 bg-white rounded-2xl shadow-2xl max-w-md w-11/12 mx-auto md:mx-0 md:w-auto">
          <CheckCircle className="w-16 h-16 md:w-24 md:h-24 text-green-500 mx-auto mb-4 md:mb-6 animate-bounce" />
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-3 md:mb-4">Merci !</h1>
          <p className="text-lg md:text-2xl text-gray-600 mb-2">Votre commande :</p>
          <p className="text-4xl md:text-6xl font-bold mb-4 md:mb-6" style={{ color: primaryColor }}>B{orderNumber}</p>
          <p className="text-base md:text-lg text-gray-600 mb-4">La commande B{orderNumber} est en préparation</p>
          
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

  return (
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
          />
        </div>

        {/* Panier - desktop uniquement */}
        <div className="hidden md:flex flex-col w-96 border-l bg-white">
          <KioskCart
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onValidate={handleValidateOrder}
            offers={borneOffers}
            orderType={orderType || 'emporter'}
            products={products}
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


