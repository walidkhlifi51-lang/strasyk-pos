import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { Menu, X, ShoppingCart, Lock, CheckCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appClient } from '@/api/appClient';
import { useTenant } from "@/components/contexts/TenantContext";
import { useOffline } from "@/components/contexts/OfflineContext";

import ProductGrid from "../components/caisse/ProductGrid";
import OrderPanel from "../components/caisse/OrderPanel";
import OrdersList from "../components/caisse/OrdersList";
import PaymentModal from "../components/caisse/PaymentModal";
import ProductCustomizationModal from "../components/caisse/ProductCustomizationModal";
import MenuCustomizationModal from "../components/caisse/MenuCustomizationModal";
import CustomerHistory from "../components/clients/CustomerHistory";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { fr } from "date-fns/locale";
import TicketPrint from "../components/caisse/TicketPrint";
import { useSecurity } from "../components/contexts/SecurityContext";
import TableSelectionModal from "../components/caisse/TableSelectionModal";
import { useQueryClient } from '@tanstack/react-query';
import OpenDrawerButton from '../components/caisse/OpenDrawerButton';
import { calculateOrderTotal } from '../components/caisse/calculateOrderTotal';
import { useOrderPayment } from '../components/caisse/useOrderPayment';
import { computeTaxSummaryFromArticles } from '../components/utils/taxUtils';
import { getDateKey, parseSupabaseDate, toParisDate as toParisDateValue } from '@/lib/dateParsing';


export default function StrasykPos() {
  const { withTenant, filterByTenant, currentTenant, currentUser } = useTenant();
  const { isOnline, addPendingOperation, cacheData, getCachedData } = useOffline();
  
  const [currentOrder, setCurrentOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isTableModalOpen, setTableModalOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [workingDate, setWorkingDate] = useState(new Date());
  const [isOrdersListVisible, setIsOrdersListVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  const [showMenuCustomization, setShowMenuCustomization] = useState(false);
  const [customizingMenu, setCustomizingMenu] = useState(null);
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [isDesktopOrdersVisible, setIsDesktopOrdersVisible] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [webOrderToSettle, setWebOrderToSettle] = useState(null);
  const [webOrderCustomer, setWebOrderCustomer] = useState(null);
  const [lastOrderCustomer, setLastOrderCustomer] = useState(null);

  const { toast } = useToast();
  const { profile } = useSecurity();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!profile?.customer_display_enabled || !currentTenant?.id) return;
    const syncToDb = async () => {
      try {
        const existing = await appClient.entities.CustomerDisplayCart.filter({ tenant_id: currentTenant.id });
        const cartData = currentOrder?.articles?.length > 0 ? currentOrder : null;
        if (existing?.length > 0) {
          await appClient.entities.CustomerDisplayCart.update(existing[0].id, { cart_data: cartData, updated_at: new Date().toISOString() });
        } else {
          await appClient.entities.CustomerDisplayCart.create(withTenant({ cart_data: cartData, updated_at: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('❌ [Pos] Erreur sync DB:', error);
      }
    };
    syncToDb();
  }, [currentOrder, profile?.customer_display_enabled, currentTenant?.id, withTenant]);

  const getCurrentOrderType = useCallback(() => {
    return currentOrder?.orderType || 'sur_place';
  }, [currentOrder]);

  const { data: posData, isLoading: isLoadingPosData, isFetching: isFetchingPosData, error: loadingError, refetch: refreshData } = useQuery({
    queryKey: ['posData', currentTenant?.id, format(workingDate, 'yyyy-MM-dd', { locale: fr })],
    queryFn: async () => {
      try {
        const cachedOfflineOrders = getCachedData('offlineOrders') || [];
        const [productsData, categoriesData, allOrdersData, customersData] = await Promise.all([
          appClient.entities.Product.filter(filterByTenant()).catch(() => []),
          appClient.entities.Category.filter(filterByTenant()).catch(() => []),
          appClient.entities.Order.filter(filterByTenant(), '-created_date', 500).catch(() => []),
          appClient.entities.Customer.filter(filterByTenant(), '-created_date', 1000).catch(() => []),
        ]);
        const combinedOrders = [...allOrdersData, ...cachedOfflineOrders];
        await new Promise(resolve => setTimeout(resolve, 100));
        const [clotureData, optionGroupsData, optionItemsData, ingredientsData, productIngredientsData] = await Promise.all([
          appClient.entities.ClotureCaisse.filter(filterByTenant()).catch(() => []),
          appClient.entities.OptionGroup.filter(filterByTenant()).catch(() => []),
          appClient.entities.OptionItem.filter(filterByTenant()).catch(() => []),
          appClient.entities.Ingredient.filter(filterByTenant()).catch(() => []),
          appClient.entities.ProductIngredient.filter(filterByTenant()).catch(() => []),
        ]);
        await new Promise(resolve => setTimeout(resolve, 100));
        const [menuFormulasData, menuItemsData, offersData, loyaltyRulesData, cagnotteRuleData, tablesData] = await Promise.all([
          appClient.entities.MenuFormula.filter(filterByTenant()).catch(() => []),
          appClient.entities.MenuFormulaItem.filter(filterByTenant()).catch(() => []),
          appClient.entities.Offer.filter({ ...filterByTenant(), active: true }).catch(() => []),
          appClient.entities.LoyaltyRule.filter({ ...filterByTenant(), active: true }).catch(() => []),
          appClient.entities.CagnotteRule.filter({ ...filterByTenant(), active: true }).catch(() => []),
          appClient.entities.Table.filter(filterByTenant()).catch(() => [])
        ]);
        if (isOnline) {
          cacheData('products', productsData);
          cacheData('categories', categoriesData);
          cacheData('customers', customersData);
        }
        return {
          products: productsData || [],
          categories: categoriesData || [],
          allOrders: combinedOrders || [],
          customers: customersData || [],
          cloture: clotureData || [],
          optionGroups: optionGroupsData || [],
          optionItems: optionItemsData || [],
          ingredients: ingredientsData || [],
          productIngredients: productIngredientsData || [],
          menuFormulas: (menuFormulasData || []).filter(m => m && m.disponible !== false),
          menuItems: menuItemsData || [],
          offers: offersData || [],
          loyaltyRules: loyaltyRulesData || [],
          cagnotteRule: cagnotteRuleData?.[0] || null,
          tables: tablesData || []
        };
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        throw error;
      }
    },
    enabled: !!currentTenant,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
    retryDelay: 5000,
  });

  const {
    products = [], categories = [], allOrders = [], customers: customersList = [], cloture = [],
    optionGroups = [], optionItems = [], ingredients = [], productIngredients = [],
    menuFormulas = [], menuItems = [], offers = [], loyaltyRules = [], cagnotteRule = null,
    tables: allTables = []
  } = posData || {};

  const derivedData = useMemo(() => {
    const toParisDate = (date) => toParisDateValue(date);
    const workingDateInParis = toParisDate(workingDate);
    const dayStartInParis = startOfDay(workingDateInParis);
    const dayEndInParis = endOfDay(workingDateInParis);

    const allOrdersForDay = allOrders.filter(order => {
      if (!order?.created_date) return false;
      const orderDate = toParisDate(order.created_date);
      if (!orderDate) return false;
      return orderDate >= dayStartInParis && orderDate <= dayEndInParis;
    });

    const maxNumeroCaisse = allOrdersForDay.reduce((max, order) => Math.max(max, order.numero_caisse || 0), 0);
    const nextNumeroCaisse = maxNumeroCaisse + 1;
    const formattedDateForOrderNumber = format(workingDateInParis, 'ddMMyy');
    const nextNumeroCommande = `${nextNumeroCaisse}-${formattedDateForOrderNumber}`;
    const orders = allOrdersForDay.filter(order => order.statut !== 'annulee').sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const customers = (customersList || []).reduce((acc, customer) => {
      if (customer?.id) acc[customer.id] = customer;
      return acc;
    }, {});
    
    const today = profile?.simulation_date ? parseISO(profile.simulation_date) : new Date();
    const todayInParis = toParisDate(today);
    const todayStr = format(todayInParis, 'yyyy-MM-dd');

    const allUniqueOrderDates = [...new Set(
      (allOrders || []).filter(o => o && o.created_date).map(o => {
        const d = parseSupabaseDate(o.created_date);
        if (!d) return null;
        return format(toParisDate(d), 'yyyy-MM-dd');
      }).filter(Boolean)
    )];

    const latestClotureByDay = new Map();
    (cloture || [])
      .filter(c => c && c.date_cloture)
      .sort((a, b) => {
        const aTime = parseSupabaseDate(a?.updated_date || a?.created_date || a?.date_cloture)?.getTime() || 0;
        const bTime = parseSupabaseDate(b?.updated_date || b?.created_date || b?.date_cloture)?.getTime() || 0;
        return bTime - aTime;
      })
      .forEach((entry) => {
        const key = getDateKey(entry.date_cloture);
        if (key && !latestClotureByDay.has(key)) {
          latestClotureByDay.set(key, entry);
        }
      });

    const closedDates = new Set(
      [...latestClotureByDay.entries()]
        .filter(([, entry]) => entry?.statut === 'cloturee')
        .map(([key]) => key)
    );

    const unclosedDays = allUniqueOrderDates.filter(date => date < todayStr && !closedDates.has(date)).sort();
    const workingDateInParisStr = format(workingDateInParis, 'yyyy-MM-dd');
    const hasOrdersForWorkingDay = allUniqueOrderDates.includes(workingDateInParisStr);
    const isCurrentDayClosedForPOS = closedDates.has(workingDateInParisStr) && hasOrdersForWorkingDay;
    const isDateClosed = isCurrentDayClosedForPOS || unclosedDays.length > 0;

    return { orders, customers, nextNumeroCaisse, nextNumeroCommande, unclosedDays, isDateClosed };
  }, [posData, workingDate, profile]);
  
  const { orders, customers, nextNumeroCaisse, nextNumeroCommande, unclosedDays, isDateClosed } = derivedData;
  
  useEffect(() => {
    if (loadingError) {
      toast({ title: "Erreur de chargement", description: `Une erreur est survenue: ${loadingError.message}.`, variant: "destructive" });
    }
  }, [loadingError, toast]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    const unsubscribe = appClient.entities.Order.subscribe(async (event) => {
      if (event.data?.tenant_id !== currentTenant.id) return;
      if (event.type === 'create' && event.data) {
        const dk = format(new Date(), 'yyyy-MM-dd', { locale: fr });
        queryClient.setQueryData(['posData', currentTenant.id, dk], (old) => {
          if (!old) { queryClient.invalidateQueries({ queryKey: ['posData'] }); return old; }
          if ((old.allOrders||[]).some(o => o.id === event.data.id)) return old;
          return { ...old, allOrders: [...(old.allOrders||[]), event.data] };
        });
      }
    });
    return () => unsubscribe();
  }, [currentTenant?.id, queryClient]);

  const clearOrder = () => {
    setCurrentOrder(null);
    setSelectedCustomer(null);
    if (window.innerWidth < 1280) {
      setIsOrdersListVisible(false);
      setIsCartVisible(false);
    }
  };

  const handleSelectCustomer = useCallback((customer) => {
    const base = { articles: [], discounts: [], loyaltyDiscount: null, promoCode: null, notes: '', orderType: 'sur_place', table: null };
    if (customer) {
      setSelectedCustomer(customer);
      setCurrentOrder(prev => ({ ...(prev || base), customer }));
    } else {
      setSelectedCustomer(null);
      setCurrentOrder(prev => ({ ...(prev || base), customer: null }));
    }
  }, []);

  const handleEditOrder = useCallback((order) => {
    if (!order) { toast({ title: "Erreur", description: "Impossible de charger les détails de cette commande.", variant: "destructive" }); return; }
    try {
      const articles = Array.isArray(order.articles) ? order.articles : [];
      const cartItems = articles
        .filter(a => !a.product_id?.startsWith('discount-') && !a.product_id?.startsWith('loyalty-') && !a.product_id?.startsWith('promo-'))
        .map((article, index) => ({
          cart_id: `edit-${order.id}-${index}`,
          product_id: article.product_id,
          nom_produit: article.nom_produit,
          quantite: article.quantite,
          prix_unitaire: article.prix_unitaire,
          prix_final_unitaire: article.prix_unitaire,
          tva_rate: article.tva,
          selected_options: Array.isArray(article.options) ? article.options : [],
          excluded_ingredients: Array.isArray(article.exclusions) ? article.exclusions : [],
          notes: article.notes || null,
          isMenu: article.isMenu || false,
          menu_id: article.menu_id || null,
          menuDetails: article.menuDetails || null,
          size: article.size || null,
          is_original: order.payee === true,
          original_quantity: order.payee === true ? article.quantite : undefined,
        }));
      const discountsFromOrder = articles.filter(a => a.product_id?.startsWith('discount-')).map(a => ({
        id: a.product_id.replace('discount-', ''),
        name: a.nom_produit.replace('Remise: ', ''),
        amount: a.prix_unitaire || 0,
      }));
      let loyaltyDiscountFromOrder = null;
      const loyaltyArticle = articles.find(a => a.product_id?.startsWith('loyalty-'));
      if (loyaltyArticle) {
        const ruleId = loyaltyArticle.product_id.replace('loyalty-', '');
        const rule = (posData?.loyaltyRules || []).find(r => r.id === ruleId);
        if (rule) loyaltyDiscountFromOrder = { id: loyaltyArticle.product_id, name: loyaltyArticle.nom_produit, rule };
      }
      const baseCustomer = order.customer_id ? customers[order.customer_id] : null;
      const customerWithAddr = baseCustomer ? { ...baseCustomer, selectedAdresse: order.delivery_address || baseCustomer.adresse || '' } : null;
      setCurrentOrder({
        id: order.id, articles: cartItems, discounts: discountsFromOrder, loyaltyDiscount: loyaltyDiscountFromOrder,
        promoCode: null, orderType: order.type_commande || 'sur_place',
        table: (posData?.tables || []).find(t => t.id === order.table_id) || null,
        notes: order.notes || "", payee: order.payee, numero_caisse: order.numero_caisse,
        scratch_reduction: order.scratch_reduction || 0, editingInfo: order,
        original_total: order.payee ? (order.total_ttc || 0) : null, customer: customerWithAddr,
      });
      if (order.customer_id && customers[order.customer_id]) setSelectedCustomer(customerWithAddr);
      else setSelectedCustomer(null);
    } catch (error) {
      console.error("Erreur lors du chargement de la commande:", error);
      toast({ title: "Erreur", description: "Erreur lors du chargement de la commande.", variant: "destructive" });
    }
  }, [posData, customers, toast, handleSelectCustomer, setCurrentOrder]);

  const handleSettleOrder = useCallback(async (orderToSettle) => {
    if (!orderToSettle) { toast({ title: "Erreur", description: "Impossible de charger les détails.", variant: "destructive" }); return; }
    if (orderToSettle.from_web) {
      setWebOrderToSettle(orderToSettle);
      if (orderToSettle.customer_id) {
        try { const res = await appClient.entities.Customer.filter({ id: orderToSettle.customer_id }); setWebOrderCustomer(res?.[0] || null); }
        catch { setWebOrderCustomer(null); }
      } else setWebOrderCustomer(null);
      setViewingCustomerId(null);
      setShowPayment(true);
      return;
    }
    try {
      const articles = Array.isArray(orderToSettle.articles) ? orderToSettle.articles : [];
      const cartItems = articles
        .filter(a => !a.product_id?.startsWith('discount-') && !a.product_id?.startsWith('loyalty-') && !a.product_id?.startsWith('promo-'))
        .map((article, index) => ({
          cart_id: `settle-${orderToSettle.id}-${index}`,
          product_id: article.product_id, nom_produit: article.nom_produit, quantite: article.quantite,
          prix_unitaire: article.prix_unitaire, prix_final_unitaire: article.prix_unitaire, tva_rate: article.tva,
          selected_options: Array.isArray(article.options) ? article.options : [],
          excluded_ingredients: Array.isArray(article.exclusions) ? article.exclusions : [],
          notes: article.notes || null, isMenu: article.isMenu || false, menu_id: article.menu_id || null,
          menuDetails: article.menuDetails || null, size: article.size || null,
          is_original: orderToSettle.payee === true, original_quantity: orderToSettle.payee === true ? article.quantite : undefined,
        }));
      const discountsFromOrder = articles.filter(a => a.product_id?.startsWith('discount-')).map(a => ({
        id: a.product_id.replace('discount-', ''), name: a.nom_produit.replace('Remise: ', ''), amount: a.prix_unitaire || 0,
      }));
      let loyaltyDiscountFromOrder = null;
      const loyaltyArticle = articles.find(a => a.product_id?.startsWith('loyalty-'));
      if (loyaltyArticle) {
        const ruleId = loyaltyArticle.product_id.replace('loyalty-', '');
        const rule = (posData?.loyaltyRules || []).find(r => r.id === ruleId);
        if (rule) loyaltyDiscountFromOrder = { id: loyaltyArticle.product_id, name: loyaltyArticle.nom_produit, rule };
      }
      const baseCustomerSettle = orderToSettle.customer_id ? customers[orderToSettle.customer_id] : null;
      const customerWithAddrSettle = baseCustomerSettle ? { ...baseCustomerSettle, selectedAdresse: orderToSettle.delivery_address || baseCustomerSettle.adresse || '' } : null;
      setCurrentOrder({
        id: orderToSettle.id, articles: cartItems, discounts: discountsFromOrder, loyaltyDiscount: loyaltyDiscountFromOrder,
        promoCode: null, orderType: orderToSettle.type_commande || 'sur_place',
        table: (posData?.tables || []).find(t => t.id === orderToSettle.table_id) || null,
        notes: orderToSettle.notes || "", payee: orderToSettle.payee, numero_caisse: orderToSettle.numero_caisse,
        scratch_reduction: orderToSettle.scratch_reduction || 0, editingInfo: orderToSettle, customer: customerWithAddrSettle,
      });
      if (orderToSettle.customer_id && customers[orderToSettle.customer_id]) handleSelectCustomer(customerWithAddrSettle);
      else handleSelectCustomer(null);
      setViewingCustomerId(null);
      if (window.innerWidth < 1280) setIsCartVisible(true);
      setShowPayment(true);
    } catch (error) {
      console.error("Erreur lors du chargement de la commande pour règlement:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue lors de la préparation du règlement.", variant: "destructive" });
    }
  }, [posData, customers, toast, handleSelectCustomer, setCurrentOrder]);

  const handleCancelOrder = useCallback(async (orderToCancel, reason) => {
    if (!orderToCancel || !orderToCancel.id) { toast({ title: "Erreur", description: "Aucune commande à annuler spécifiée.", variant: "destructive" }); return; }
    if (orderToCancel.payee) { toast({ title: "Action impossible", description: "Une commande déjà payée ne peut pas être annulée.", variant: "destructive" }); return; }
    try {
      const user = await appClient.auth.me();
      const cancellationNote = `\n--- ANNULÉE le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} par ${user.email} ---\nMotif: ${reason}`;
      await appClient.entities.Order.update(orderToCancel.id, withTenant({ statut: 'annulee', motif_annulation: reason, notes: (orderToCancel.notes || '') + cancellationNote }));
      if (orderToCancel.table_id) {
        try { await appClient.entities.Table.update(orderToCancel.table_id, withTenant({ statut: 'disponible', order_id: null })); queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] }); }
        catch (tableError) { console.error("Erreur lors de la libération de la table:", tableError); }
      }
      toast({ title: "Commande annulée", description: `La commande #${orderToCancel.numero_caisse} a été annulée.`, variant: "success" });
      if (currentOrder?.id === orderToCancel.id) clearOrder();
      queryClient.invalidateQueries({ queryKey: ['posData'] });
    } catch (error) {
      console.error("Erreur lors de l'annulation de la commande:", error);
      toast({ title: "Erreur", description: `Une erreur est survenue lors de l'annulation: ${error.message}`, variant: "destructive" });
    }
  }, [queryClient, currentOrder, toast, clearOrder, withTenant]);

  useEffect(() => {
    const processUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.toString()) return;
      if (isLoadingPosData) return;
      const orderToSettleId = urlParams.get('order_to_settle');
      const orderToEditId = urlParams.get('order_to_edit');
      const tableToAssignId = urlParams.get('table_id');
      const orderId = orderToSettleId || orderToEditId;
      window.history.replaceState({}, document.title, window.location.pathname);
      if (orderId && orderId !== 'null') {
        try {
          const results = await appClient.entities.Order.filter({ id: orderId });
          const orderToLoad = results?.[0];
          if (orderToLoad) { clearOrder(); if (orderToSettleId) handleSettleOrder(orderToLoad); else handleEditOrder(orderToLoad); }
          else toast({ title: "Commande non trouvée", description: "Impossible de trouver la commande demandée.", variant: "destructive" });
        } catch (err) {
          console.error("Erreur lors de la récupération de la commande :", err);
          toast({ title: "Erreur réseau", description: "Impossible de charger la commande.", variant: "destructive" });
        }
      } else if (tableToAssignId) {
        const table = allTables.find(t => t.id === tableToAssignId);
        if (table) {
          if (table.statut !== 'disponible') toast({ title: "Table non disponible", description: `La table ${table.nom} est actuellement ${table.statut}.`, variant: "warning" });
          else {
            clearOrder();
            setCurrentOrder(prev => ({ ...(prev || { articles: [], discounts: [], loyaltyDiscount: null, promoCode: null, notes: '', customer: null, orderType: 'sur_place', table: null }), table, orderType: 'sur_place' }));
            toast({ title: `Table ${table.nom} sélectionnée`, description: "Commencez à ajouter des produits pour la nouvelle commande." });
          }
        } else toast({ title: "Table non trouvée", description: "La table demandée n'existe pas.", variant: "destructive" });
      }
    };
    processUrlParams();
  }, [isLoadingPosData, allTables, toast, clearOrder, handleEditOrder, handleSettleOrder, setCurrentOrder]);

  useEffect(() => {
    if (!currentOrder || currentOrder.editingInfo) {
      if (currentOrder && !currentOrder.editingInfo) setCurrentOrder(prev => ({ ...prev, discounts: [] }));
      return;
    }
    const cart = Array.isArray(currentOrder.articles) ? currentOrder.articles : [];
    if (cart.length === 0 || !offers || offers.length === 0 || !products || products.length === 0) { setCurrentOrder(prev => ({ ...prev, discounts: [] })); return; }
    const currentOrderType = currentOrder.orderType || 'sur_place';
    try {
      const newAppliedDiscounts = [];
      let availableItems = cart.flatMap((item, cartIndex) => {
        if (!item || !item.product_id || item.isMenu) return [];
        const product = products.find(p => p && p.id === item.product_id);
        const categoryId = product?.category_id || item.category_id || null;
        if (!categoryId && !product) return [];
        let size = item.size || null;
        if (!size && item.nom_produit) { const sizeMatch = item.nom_produit.match(/\(([^)]+)\)$/); if (sizeMatch) size = sizeMatch[1]; }
        return Array(item.quantite).fill(null).map((_, quantityIndex) => ({
          uid: `${item.cart_id}-${cartIndex}-${quantityIndex}`, productId: item.product_id, categoryId, size, price: Number(item.prix_final_unitaire) || 0, isMenu: false,
        }));
      });
      for (const offer of offers) {
        if (!offer || !offer.active) continue;
        const offerCanaux = offer.canaux || ['caisse'];
        if (!offerCanaux.includes('caisse')) continue;
        const offerModes = offer.modes_commande || ['sur_place', 'emporter', 'livraison'];
        if (!offerModes.includes(currentOrderType)) continue;
        while (true) {
          const conditionCandidates = availableItems.filter(item => {
            if (!item.productId) return false;
            let typeMatch = false;
            if (offer.type_condition === 'product') typeMatch = (offer.condition_ids || []).includes(item.productId);
            else if (offer.type_condition === 'category') typeMatch = item.categoryId && (offer.condition_ids || []).includes(item.categoryId);
            if (!typeMatch) return false;
            if (offer.condition_sizes && offer.condition_sizes.length > 0 && item.size && !(offer.condition_sizes || []).includes(item.size)) return false;
            if ((offer.condition_excluded_product_ids?.length > 0) && (offer.condition_excluded_product_ids || []).includes(item.productId)) return false;
            return true;
          });
          if (conditionCandidates.length < offer.quantite_requise) break;
          conditionCandidates.sort((a, b) => b.price - a.price);
          const consumedConditionItems = conditionCandidates.slice(0, offer.quantite_requise);
          const consumedConditionUIDs = consumedConditionItems.map(i => i.uid);
          let rewardCandidates = availableItems.filter(item => {
            if (consumedConditionUIDs.includes(item.uid)) return false;
            if (!item.productId) return false;
            let typeMatch = false;
            if (offer.type_recompense === 'product') typeMatch = (offer.recompense_ids || []).includes(item.productId);
            else if (offer.type_recompense === 'category') typeMatch = item.categoryId && (offer.recompense_ids || []).includes(item.categoryId);
            if (!typeMatch) return false;
            if (offer.recompense_sizes && offer.recompense_sizes.length > 0 && item.size && !(offer.recompense_sizes || []).includes(item.size)) return false;
            if ((offer.recompense_excluded_product_ids?.length > 0) && (offer.recompense_excluded_product_ids || []).includes(item.productId)) return false;
            return true;
          });
          if (rewardCandidates.length < offer.quantite_offerte) {
            const allMatchingReward = availableItems.filter(item => {
              if (!item.productId) return false;
              let typeMatch = false;
              if (offer.type_recompense === 'product') typeMatch = (offer.recompense_ids || []).includes(item.productId);
              else if (offer.type_recompense === 'category') typeMatch = item.categoryId && (offer.recompense_ids || []).includes(item.categoryId);
              if (!typeMatch) return false;
              if (offer.recompense_sizes?.length > 0 && item.size && !offer.recompense_sizes.includes(item.size)) return false;
              if ((offer.recompense_excluded_product_ids || []).includes(item.productId)) return false;
              return true;
            });
            const totalNeeded = offer.quantite_requise + offer.quantite_offerte;
            if (allMatchingReward.length >= totalNeeded) {
              const extendedRewardCandidates = allMatchingReward.filter(i => !consumedConditionUIDs.includes(i.uid));
              if (extendedRewardCandidates.length >= offer.quantite_offerte) {
                rewardCandidates.push(...extendedRewardCandidates.filter(i => !rewardCandidates.find(r => r.uid === i.uid)));
              }
            }
          }
          if (rewardCandidates.length < offer.quantite_offerte) break;
          rewardCandidates.sort((a, b) => a.price - b.price);
          const consumedRewardItems = rewardCandidates.slice(0, offer.quantite_offerte);
          const discountAmount = consumedRewardItems.reduce((sum, item) => sum + item.price, 0);
          const allConsumedUIDs = [...consumedConditionUIDs, ...consumedRewardItems.map(i => i.uid)];
          availableItems = availableItems.filter(item => !allConsumedUIDs.includes(item.uid));
          let existingDiscount = newAppliedDiscounts.find(d => d.id === offer.id);
          if (existingDiscount) existingDiscount.amount -= discountAmount;
          else newAppliedDiscounts.push({ id: offer.id, name: offer.nom, amount: -discountAmount });
        }
      }
      setCurrentOrder(prev => ({...prev, discounts: newAppliedDiscounts}));
    } catch (error) {
      console.error('[StrasykPos] Erreur lors du calcul des offres:', error);
      setCurrentOrder(prev => ({...prev, discounts: []}));
    }
  }, [currentOrder?.articles, currentOrder?.orderType, offers, products, currentOrder?.editingInfo, setCurrentOrder]);

  const checkLoyalty = useCallback(() => {
    if (currentOrder?.editingInfo) return;
    if (!currentOrder?.customer?.id || loyaltyRules.length === 0) { setCurrentOrder(prev => prev ? { ...prev, loyaltyDiscount: null } : null); return; }
    if (!currentOrder || !Array.isArray(currentOrder.articles) || currentOrder.articles.length === 0) { setCurrentOrder(prev => prev ? { ...prev, loyaltyDiscount: null } : null); return; }
    const currentOrderType = currentOrder.orderType || 'sur_place';
    const checkLoyaltyAsync = async () => {
      setIsCheckingLoyalty(true);
      try {
        const previousOrders = await appClient.entities.Order.filter({ ...filterByTenant(), customer_id: currentOrder.customer.id, payee: true });
        const paidOrdersCount = (previousOrders || []).filter(order => order.statut !== 'annulee').length;
        const currentOrderNumber = paidOrdersCount + 1;
        const applicableRule = loyaltyRules.find(rule => {
          if (!rule.active || Number(rule.numero_commande) !== currentOrderNumber) return false;
          const ruleCanaux = rule.canaux || ['caisse'];
          if (!ruleCanaux.includes('caisse')) return false;
          const ruleModes = rule.modes_commande || ['sur_place', 'emporter', 'livraison'];
          return ruleModes.includes(currentOrderType);
        });
        if (applicableRule) {
          setCurrentOrder(prevOrder => {
            if (!prevOrder) return null;
            if (!prevOrder.loyaltyDiscount || prevOrder.loyaltyDiscount.rule.id !== applicableRule.id) {
              toast({ title: "Avantage fidélité !", description: `${applicableRule.nom} - ${applicableRule.description || ''}`, className: "bg-yellow-100 text-yellow-800 border-yellow-300" });
              return { ...prevOrder, loyaltyDiscount: { id: `loyalty-${applicableRule.id}`, name: `Fidélité: ${applicableRule.nom}`, rule: applicableRule } };
            }
            return prevOrder;
          });
        } else setCurrentOrder(prev => prev ? { ...prev, loyaltyDiscount: null } : null);
      } catch (error) {
        console.error("Erreur lors de la vérification de la fidélité:", error);
        setCurrentOrder(prev => prev ? { ...prev, loyaltyDiscount: null } : null);
      } finally { setIsCheckingLoyalty(false); }
    };
    checkLoyaltyAsync();
  }, [currentOrder?.customer, loyaltyRules, currentOrder?.editingInfo, currentOrder?.articles, toast, setCurrentOrder]);

  useEffect(() => { checkLoyalty(); }, [checkLoyalty, currentOrder?.orderType]);
  
  useEffect(() => {
    if (!currentOrder) return;
    if (currentOrder.editingInfo?.payee && currentOrder.orderType === 'livraison' && currentOrder.editingInfo.type_commande !== 'livraison' && profile?.manages_deliveries !== false && profile?.frais_livraison > 0) {
      const feeAlreadyInCart = Array.isArray(currentOrder.articles) && currentOrder.articles.some(item => item.product_id === 'frais_livraison_conversion');
      if (!feeAlreadyInCart) {
        const deliveryFeeItem = { cart_id: 'fee-' + Date.now(), product_id: 'frais_livraison_conversion', nom_produit: 'Frais de Livraison (supplément)', quantite: 1, prix_unitaire: profile.frais_livraison, prix_final_unitaire: profile.frais_livraison, tva_rate: Number(profile?.tva_rates?.[0]?.rate) || 0, isMenu: false, selected_options: [], excluded_ingredients: [], notes: 'Conversion en livraison' };
        setCurrentOrder(prev => ({ ...prev, articles: [deliveryFeeItem] }));
        toast({ title: "Frais de livraison ajoutés", description: `Veuillez maintenant encaisser les ${profile.frais_livraison.toFixed(2)}€ supplémentaires.`, variant: "info" });
      }
    } else if (currentOrder.orderType !== 'livraison' && Array.isArray(currentOrder.articles) && currentOrder.articles.some(item => item.product_id === 'frais_livraison_conversion')) {
      setCurrentOrder(prev => ({ ...prev, articles: [] }));
    }
  }, [currentOrder, profile, toast, setCurrentOrder]);

  const getPriceForMode = useCallback((product, orderType, selectedSize = null) => {
    const prixDifferencies = profile?.prix_differencies_par_mode === true;
    if (selectedSize && product.size_prices?.length > 0) {
      if (prixDifferencies && product.size_prix_par_mode?.length > 0) {
        const sizeMode = product.size_prix_par_mode.find(s => s.size === selectedSize);
        if (sizeMode && sizeMode[orderType] > 0) return sizeMode[orderType];
      }
      const sizePrice = product.size_prices.find(s => s.size === selectedSize);
      return sizePrice?.price ?? 0;
    } else {
      if (prixDifferencies && product.prix_par_mode) {
        const modePrice = product.prix_par_mode[orderType];
        if (modePrice > 0) return modePrice;
      }
      return product.base_price ?? product.prix ?? 0;
    }
  }, [profile]);

  useEffect(() => {
    if (!currentOrder?.articles?.length || !profile?.prix_differencies_par_mode) return;
    const orderType = currentOrder.orderType || 'sur_place';
    const updatedArticles = currentOrder.articles.map(item => {
      if (item.isMenu || item.product_id?.startsWith('discount-') || item.product_id?.startsWith('loyalty-') || item.product_id?.startsWith('promo-') || item.product_id === 'frais_livraison_conversion') return item;
      const product = products.find(p => p.id === item.product_id);
      if (!product) return item;
      const sizeMatch = item.nom_produit?.match(/\(([^)]+)\)$/);
      const selectedSize = item.size || (sizeMatch ? sizeMatch[1] : null);
      const newPrice = getPriceForMode(product, orderType, selectedSize);
      const optionsSurcharge = (item.selected_options || []).reduce((sum, opt) => sum + (opt.price_surcharge || 0), 0);
      return { ...item, prix_unitaire: newPrice, prix_final_unitaire: newPrice + optionsSurcharge };
    });
    const hasChanges = updatedArticles.some((item, index) => item.prix_final_unitaire !== currentOrder.articles[index].prix_final_unitaire);
    if (hasChanges) setCurrentOrder(prev => ({ ...prev, articles: updatedArticles }));
  }, [currentOrder?.orderType, profile?.prix_differencies_par_mode, products, getPriceForMode]);

  const handleAddToCart = (product, quantity) => {
    if (isDateClosed) { toast({ title: "Journée clôturée", description: "Impossible d'ajouter des produits, la caisse est fermée.", variant: "destructive" }); return; }
    const productCategory = categories.find(c => c.id === product.category_id);
    const productOptionGroups = optionGroups.filter(g => g.product_id === product.id);
    const productRetirableIngredients = productIngredients.filter(pi => pi.product_id === product.id && pi.retirable);
    const categoryManagesSizes = productCategory?.manages_sizes === true
      && Array.isArray(productCategory?.size_template)
      && productCategory.size_template.length > 0;
    const productHasSizePrices = Array.isArray(product.size_prices) && product.size_prices.length > 0;
    const productHasSizeModePrices = Array.isArray(product.size_prix_par_mode) && product.size_prix_par_mode.length > 0;
    const hasSizes = categoryManagesSizes || productHasSizePrices || productHasSizeModePrices;
    if (hasSizes || productOptionGroups.length > 0 || productRetirableIngredients.length > 0) {
      setCustomizingProduct({ product, quantity, type: 'product', category: productCategory });
    } else {
      const orderType = currentOrder?.orderType || 'sur_place';
      const price = getPriceForMode(product, orderType);
      const newItem = { cart_id: Date.now().toString(), product_id: product.id, category_id: product.category_id || null, nom_produit: product.nom, quantite: quantity, prix_unitaire: price, prix_final_unitaire: price, tva_rate: product.tva, selected_options: [], excluded_ingredients: [], notes: null, isMenu: false, menu_id: null, menuDetails: null, size: null };
      setCurrentOrder(prevOrder => {
        const baseOrder = prevOrder || { articles: [], orderType: 'sur_place', notes: '', discounts: [], table: null, loyaltyDiscount: null, promoCode: null, customer: null };
        return { ...baseOrder, articles: [...(Array.isArray(baseOrder.articles) ? baseOrder.articles : []), newItem] };
      });
    }
    if (window.innerWidth < 1280) setIsCartVisible(true);
  };

  const handleAddMenuToCart = (menu, quantity) => {
    if (isDateClosed) { toast({ title: "Journée clôturée", description: "Impossible d'ajouter des menus, la caisse est fermée.", variant: "destructive" }); return; }
    setCustomizingMenu(menu);
    setShowMenuCustomization(true);
  };

  const handleMenuCustomizationConfirm = (menuData) => {
    const totalSurcharge = menuData.articles.reduce((total, article) => total + (article.selectedOptions || []).reduce((subTotal, option) => subTotal + (Number(option.price_surcharge) || 0), 0), 0);
    const finalMenuPrice = (customizingMenu.prix || 0) + totalSurcharge;
    const menuArticle = { cart_id: Date.now().toString(), product_id: null, nom_produit: customizingMenu.nom, quantite: 1, prix_unitaire: customizingMenu.prix, prix_final_unitaire: finalMenuPrice, tva_rate: Number(customizingMenu.tva) || 0, selected_options: [], excluded_ingredients: [], notes: menuData.notes || "", isMenu: true, menuDetails: menuData.articles, menu_id: customizingMenu.id, size: null };
    setCurrentOrder(prevOrder => {
      const baseOrder = prevOrder || { articles: [], orderType: 'sur_place', notes: '', discounts: [], table: null, loyaltyDiscount: null, promoCode: null, customer: null };
      return { ...baseOrder, articles: [...(Array.isArray(baseOrder.articles) ? baseOrder.articles : []), menuArticle] };
    });
    setShowMenuCustomization(false);
    setCustomizingMenu(null);
    toast({ title: "Menu ajouté !", description: `${customizingMenu.nom} a été ajouté au panier` });
    if (window.innerWidth < 1280) setIsCartVisible(true);
  };

  const handleEditItemConfirm = (customizedData) => {
    if (!editingCartItem) return;
    const { product, quantity, selectedSize, selectedOptions, excludedIngredients, notes, finalPrice } = customizedData;
    const updatedItem = {
      ...editingCartItem,
      nom_produit: selectedSize ? `${product.nom} (${selectedSize})` : product.nom,
      quantite: quantity, prix_unitaire: finalPrice, prix_final_unitaire: finalPrice,
      selected_options: selectedOptions || [], excluded_ingredients: excludedIngredients || [],
      notes: notes || null, size: selectedSize || null,
    };
    setCurrentOrder(prev => ({ ...prev, articles: prev.articles.map(a => a.cart_id === editingCartItem.cart_id ? updatedItem : a) }));
    setEditingCartItem(null);
  };

  const handleConfirmCustomization = (customizedProductData) => {
    const { product, quantity, selectedOptions, finalPrice, excludedIngredients, notes, selectedSize, type } = customizedProductData;
    if (!product || !product.id) { setCustomizingProduct(null); return; }
    let itemProductId = product.id;
    let itemNomProduit = selectedSize ? `${product.nom} (${selectedSize})` : product.nom;
    let itemIsMenu = false;
    let itemMenuId = null;
    if (type === 'menu') { itemProductId = `menu-${product.id}`; itemNomProduit = product.nom; itemIsMenu = true; itemMenuId = product.id; }
    const newItem = {
      cart_id: Date.now().toString(), product_id: itemProductId, category_id: product.category_id || null,
      nom_produit: itemNomProduit, quantite: quantity, prix_unitaire: product.prix || product.base_price || 0,
      prix_final_unitaire: finalPrice, tva_rate: product.tva || 5.5,
      selected_options: Array.isArray(selectedOptions) ? selectedOptions : [],
      excluded_ingredients: Array.isArray(excludedIngredients) ? excludedIngredients : [],
      notes: notes || null, isMenu: itemIsMenu, menu_id: itemMenuId, menuDetails: null, size: selectedSize,
    };
    setCurrentOrder(prevOrder => {
      const baseOrder = prevOrder || { articles: [], orderType: 'sur_place', notes: '', discounts: [], table: null, loyaltyDiscount: null, promoCode: null, customer: null };
      return { ...baseOrder, articles: [...(Array.isArray(baseOrder.articles) ? baseOrder.articles : []), newItem] };
    });
    setCustomizingProduct(null);
    if (window.innerWidth < 1280) setIsCartVisible(true);
  };

  const handleUpdateQuantity = (cartId, newQuantity) => {
    if (!currentOrder) return;
    if (newQuantity <= 0) {
      setCurrentOrder(prev => ({...prev, articles: (Array.isArray(prev.articles) ? prev.articles : []).filter(item => item.cart_id !== cartId)}));
    } else {
      setCurrentOrder(prev => ({...prev, articles: (Array.isArray(prev.articles) ? prev.articles : []).map(item => item.cart_id === cartId ? { ...item, quantite: newQuantity } : item)}));
    }
  };

  const { handleCreateOrUpdateOrder } = useOrderPayment({
    currentOrder, currentTenant, withTenant, filterByTenant, queryClient, toast,
    selectedCustomer, setSelectedCustomer, nextNumeroCaisse, workingDate,
    cagnotteRule, isOnline, addPendingOperation, cacheData, getCachedData, currentUser
  });

  const handlePaymentComplete = useCallback(async (orderResult) => {
    if (!orderResult) return;
    setLastOrderCustomer(currentOrder?.customer || null);
    setConfirmedOrder(orderResult);
    setShowConfirmation(true);
    if (orderResult.payee && orderResult.type_commande === 'sur_place' && orderResult.table_id && !orderResult.offline) {
      try { await appClient.entities.Table.update(orderResult.table_id, withTenant({ statut: 'a_nettoyer' })); queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] }); }
      catch (error) { console.error("Erreur lors de la mise à jour du statut de la table:", error); }
    }
    queryClient.invalidateQueries({ queryKey: ['posData'] });
    clearOrder();
    toast({ title: "Commande validée !", description: `La commande #${orderResult.numero_caisse} a été enregistrée avec succès.`, variant: "success" });
  }, [queryClient, clearOrder, toast, withTenant]);

  const handleHoldOrder = useCallback(async () => {
    if (isDateClosed) { toast({ title: "Journée clôturée", description: "Impossible de mettre en attente, la caisse est fermée.", variant: "destructive" }); return; }
    if (!currentOrder || !Array.isArray(currentOrder.articles) || currentOrder.articles.length === 0) { toast({ title: "Panier vide", description: "Ajoutez des produits avant de mettre en attente.", variant: "destructive" }); return; }
    try {
      const articles = Array.isArray(currentOrder.articles) ? currentOrder.articles : [];
      const discounts = Array.isArray(currentOrder.discounts) ? currentOrder.discounts : [];
      const { loyaltyDiscount, promoCode, orderType, table, notes, customer } = currentOrder;
      const subTotalTTC = articles.reduce((sum, item) => sum + (item.prix_final_unitaire * item.quantite), 0);
      const offerDiscountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
      const totalAfterOffers = subTotalTTC + offerDiscountTotal;
      let loyaltyDiscountAmount = 0;
      if (loyaltyDiscount && loyaltyDiscount.rule) {
        if (loyaltyDiscount.rule.type_recompense === 'percentage_discount') loyaltyDiscountAmount = Math.min(totalAfterOffers * (loyaltyDiscount.rule.valeur_recompense / 100), totalAfterOffers);
        else if (loyaltyDiscount.rule.type_recompense === 'fixed_discount') loyaltyDiscountAmount = Math.min(loyaltyDiscount.rule.valeur_recompense, totalAfterOffers);
      }
      const totalAfterLoyalty = totalAfterOffers - loyaltyDiscountAmount;
      let promoDiscountValue = 0;
      if (promoCode) {
        promoDiscountValue = promoCode.type === 'percentage' ? totalAfterLoyalty * (promoCode.value / 100) : promoCode.value;
        promoDiscountValue = Math.min(promoDiscountValue, totalAfterLoyalty);
      }
      const finalTotalTTC = totalAfterLoyalty - promoDiscountValue;
      const orderArticles = articles.map(item => ({
        product_id: item.isMenu ? null : item.product_id, menu_id: item.isMenu ? item.menu_id : null,
        nom_produit: item.nom_produit, quantite: item.quantite, prix_unitaire: item.prix_final_unitaire,
        total_ligne: item.prix_final_unitaire * item.quantite, tva: item.tva_rate,
        options: Array.isArray(item.selected_options) ? item.selected_options.map(opt => ({ id: opt.id, nom: opt.nom, price_surcharge: opt.price_surcharge })) : [],
        exclusions: Array.isArray(item.excluded_ingredients) ? item.excluded_ingredients.map(ing => ({ id: ing.id, nom: ing.nom })) : [],
        notes: item.notes || null, isMenu: item.isMenu, menuDetails: item.menuDetails || null, size: item.size || null,
      }));
      discounts.forEach(discount => orderArticles.push({ product_id: `discount-${discount.id}`, nom_produit: `Remise: ${discount.name}`, quantite: 1, prix_unitaire: discount.amount, total_ligne: discount.amount, tva: 0 }));
      if (loyaltyDiscount && loyaltyDiscountAmount > 0) orderArticles.push({ product_id: loyaltyDiscount.id, nom_produit: loyaltyDiscount.name, quantite: 1, prix_unitaire: -loyaltyDiscountAmount, total_ligne: -loyaltyDiscountAmount, tva: 0 });
      if (promoCode && promoDiscountValue > 0) orderArticles.push({ product_id: `promo-${promoCode.id}`, nom_produit: `Code Promo: ${promoCode.code}`, quantite: 1, prix_unitaire: -promoDiscountValue, total_ligne: -promoDiscountValue, tva: 0 });
      const taxSummary = computeTaxSummaryFromArticles(orderArticles, finalTotalTTC);
      const numeroCaisse = currentOrder.editingInfo ? currentOrder.editingInfo.numero_caisse : nextNumeroCaisse;
      const formattedDateForHold = format(workingDate, 'ddMMyy', { locale: fr });
      const numeroCommande = currentOrder.editingInfo ? currentOrder.editingInfo.numero_commande : `${nextNumeroCaisse}-${formattedDateForHold}`;
      const orderPayload = withTenant({ numero_commande: numeroCommande, type_commande: orderType || 'sur_place', customer_id: customer?.id || null, table_id: (orderType === 'sur_place' || !orderType) && table ? table.id : null, delivery_address: (orderType === 'livraison') ? (customer?.selectedAdresse || customer?.adresse || null) : null, articles: orderArticles, total_ht: taxSummary.totalHt, total_tva: taxSummary.totalTva, total_ttc: finalTotalTTC, statut: 'en_attente', payee: false, numero_caisse: numeroCaisse, notes: notes || '' });
      let savedOrder;
        if (currentOrder.editingInfo) {
          await appClient.entities.Order.update(currentOrder.editingInfo.id, orderPayload);
          savedOrder = { ...currentOrder.editingInfo, ...orderPayload, id: currentOrder.editingInfo.id };
        }
        else savedOrder = await appClient.entities.Order.create(orderPayload);
      if ((orderType === 'sur_place' || !orderType) && table && savedOrder) {
        if (!currentOrder.editingInfo || currentOrder.editingInfo.table_id !== table.id) {
          await appClient.entities.Table.update(table.id, withTenant({ statut: 'occupee', order_id: savedOrder.id }));
          queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });
          if (currentOrder.editingInfo?.table_id && currentOrder.editingInfo.table_id !== table.id) await appClient.entities.Table.update(currentOrder.editingInfo.table_id, withTenant({ order_id: null, statut: 'disponible' }));
        }
      }
      toast({ title: "Commande en attente", description: "La commande a été sauvegardée et peut être reprise plus tard.", variant: "success" });
      refreshData();
      clearOrder();
    } catch (error) {
      console.error("Erreur lors de la mise en attente/mise à jour:", error);
      toast({ title: "Erreur", description: `Impossible de sauvegarder la commande: ${error.message}`, variant: "destructive" });
    }
  }, [queryClient, currentOrder, toast, refreshData, clearOrder, nextNumeroCaisse, nextNumeroCommande, withTenant, isDateClosed]);

  const handleFinalize = async () => {
    if (isDateClosed) { toast({ title: "Journée clôturée", description: "Impossible d'encaisser, la caisse est fermée.", variant: "destructive" }); return; }
    if (!currentOrder || !Array.isArray(currentOrder.articles) || currentOrder.articles.length === 0) { toast({ title: "Panier vide", description: "Ajoutez des produits avant d'encaisser.", variant: "destructive" }); return; }
    if (currentOrder.customer?.id) {
      try {
        const freshCustomer = await appClient.entities.Customer.filter({ id: currentOrder.customer.id });
        if (freshCustomer?.[0]) setCurrentOrder(prev => prev ? { ...prev, customer: { ...freshCustomer[0], selectedAdresse: prev.customer?.selectedAdresse } } : null);
      } catch (error) { console.warn('⚠️ Impossible de rafraîchir le client:', error); }
    }
    setShowPayment(true);
  };

  const handleApplyPromoCode = useCallback(async (codeString) => {
    if (!codeString) { toast({ title: "Veuillez saisir un code", variant: "destructive" }); return; }
    const currentOrderType = currentOrder?.orderType || 'sur_place';
    try {
      const results = await appClient.entities.PromoCode.filter({ ...filterByTenant(), code: codeString.trim(), active: true });
      const code = results?.[0];
      if (!code) { toast({ title: "Code promo invalide ou inactif", variant: "destructive" }); return; }
      if (code.expires_at && new Date(code.expires_at) < new Date()) { toast({ title: "Ce code promo a expiré", variant: "destructive" }); return; }
      if (code.usage_limit && (code.usage_count || 0) >= code.usage_limit) { toast({ title: "Ce code promo a atteint sa limite d'utilisation", variant: "destructive" }); return; }
      const codeCanaux = code.canaux || ['caisse'];
      if (!codeCanaux.includes('caisse')) { toast({ title: "Code promo non valide", description: "Ce code n'est pas disponible à la caisse.", variant: "destructive" }); return; }
      const codeModes = code.modes_commande || ['sur_place', 'emporter', 'livraison'];
      if (codeModes.length > 0 && !codeModes.includes(currentOrderType)) {
        const modeLabels = { sur_place: 'sur place', emporter: 'à emporter', livraison: 'en livraison' };
        toast({ title: "Code promo non valide pour ce mode", description: `Ce code est uniquement valide pour : ${codeModes.map(m => modeLabels[m] || m).join(', ')}.`, variant: "destructive" });
        return;
      }
      setCurrentOrder(prev => prev ? {...prev, promoCode: code} : { articles: [], orderType: 'sur_place', notes: '', discounts: [], table: null, loyaltyDiscount: null, promoCode: code, customer: null });
      toast({ title: "Code promo appliqué !", description: code.description, variant: "success" });
    } catch (error) {
      console.error("Erreur lors de l'application du code promo:", error);
      toast({ title: "Erreur", description: "Impossible de vérifier le code promo.", variant: "destructive" });
    }
  }, [toast, setCurrentOrder, currentOrder?.orderType]);

  const handleRemovePromoCode = useCallback(() => {
    setCurrentOrder(prev => prev ? {...prev, promoCode: null} : null);
    toast({ title: "Code promo retiré" });
  }, [setCurrentOrder, toast]);

  if (isLoadingPosData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la caisse...</p>
        </div>
      </div>
    );
  }

  if (unclosedDays.length > 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <Card className="max-w-md mx-auto shadow-xl border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><Lock className="w-8 h-8 text-red-600" /></div>
            <h2 className="2xl font-bold text-red-900">Clôture Requise</h2>
            <p className="text-red-700">La journée du {format(parseISO(unclosedDays[0]), 'dd MMMM yyyy', { locale: fr })} n'a pas été clôturée. Vous devez clôturer toutes les journées précédentes avant de continuer.</p>
            <Link to={`${createPageUrl('ComptageCaisse')}?date=${unclosedDays[0]}`}><Button className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 text-lg py-3 mt-4">Clôturer maintenant</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDateClosed && unclosedDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <Card className="max-w-md mx-auto shadow-xl border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto"><span className="text-2xl">🔒</span></div>
            <h2 className="2xl font-bold text-red-900">Journée Clôturée</h2>
            <p className="text-red-700">La journée du {format(workingDate, 'dd/MM/yyyy', { locale: fr })} a été définitivement clôturée. Aucune nouvelle commande ne peut être créée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEditOrderWrapper = (order) => {
    if (order?.from_web) { toast({ title: "Commande web", description: "Les commandes web ne peuvent pas être modifiées depuis la caisse. Utilisez 'Régler' pour encaisser.", variant: "destructive" }); return; }
    handleEditOrder(order);
    if (window.innerWidth < 1280) setIsOrdersListVisible(false);
  };

  const itemCount = Array.isArray(currentOrder?.articles) ? currentOrder.articles.reduce((sum, item) => sum + item.quantite, 0) : 0;
  const rawTotal = calculateOrderTotal(currentOrder);
  const totalForPaymentModal = webOrderToSettle
    ? webOrderToSettle.total_ttc
    : (currentOrder?.payee && currentOrder?.original_total != null)
      ? Math.max(0, rawTotal - currentOrder.original_total)
      : rawTotal;

  return (
    <div className="h-screen w-full bg-gray-300 overflow-hidden relative">
      <div className="h-full w-full">
        {/* Mobile layout */}
        <div className="xl:hidden w-full h-full flex flex-col overflow-hidden">
          {(isOrdersListVisible || isCartVisible) && (
            <div className="absolute inset-0 bg-black/50 z-10 transition-opacity duration-300" onClick={() => { setIsOrdersListVisible(false); setIsCartVisible(false); }} />
          )}
          <div className={`flex flex-col bg-white shadow-2xl h-full z-20 transition-all duration-300 ease-out overflow-hidden ${isOrdersListVisible ? 'translate-x-0' : '-translate-x-full'} absolute inset-y-0 left-0 w-80`}>
            <div className="flex justify-end p-4 border-b bg-indigo-600 rounded-tr-2xl">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsOrdersListVisible(false)}><X className="w-5 h-5" /></Button>
            </div>
            <OrdersList orders={orders} onEditOrder={handleEditOrderWrapper} customers={customers} onRefresh={refreshData} isLoading={isFetchingPosData} workingDate={workingDate} onSettleOrder={handleSettleOrder} onCancelOrder={handleCancelOrder} profile={profile} onManualPrint={setLastCompletedOrder} onHide={() => setIsOrdersListVisible(false)} />
          </div>
          <main className="flex-1 flex flex-col min-h-0">
            <header className="flex-shrink-0 p-4 border-b bg-white shadow-lg flex justify-between items-center gap-4">
              <div className="flex gap-2">
                <OpenDrawerButton />
                {profile?.customer_display_enabled && (
                  <Button variant="outline" size="icon" onClick={() => window.open(`${createPageUrl('CustomerDisplay')}?tenant=${currentTenant?.id}`, '_blank', 'width=1920,height=1080')} className="bg-purple-600 text-white border-0 shadow-lg" title="Ouvrir l'écran client"><Menu className="w-5 h-5" /></Button>
                )}
              </div>
              <Button variant="outline" size="icon" className="bg-indigo-600 text-white border-0 shadow-lg" onClick={() => setIsOrdersListVisible(true)}><Menu className="w-5 h-5" /></Button>
              <div className="text-center"><h2 className="font-bold text-xl text-gray-800">Caisse</h2><div className="w-12 h-1 bg-indigo-500 rounded-full mx-auto mt-1"></div></div>
              <Button variant="outline" size="icon" className="relative bg-orange-500 text-white border-0 shadow-lg" onClick={() => setIsCartVisible(true)}>
                <ShoppingCart className="w-5 h-5"/>
                {itemCount > 0 && <Badge className="absolute -top-2 -right-2 h-6 w-6 justify-center p-0 bg-red-500 text-white shadow-lg animate-pulse border-2 border-white">{itemCount}</Badge>}
              </Button>
            </header>
            <div className="flex-1 bg-gray-50 shadow-inner min-h-0">
              <ProductGrid products={products} categories={categories} menuFormulas={menuFormulas} menuItems={menuItems} onAddToCart={handleAddToCart} onAddMenuToCart={handleAddMenuToCart} isDateClosed={isDateClosed} isOrdersVisible={isDesktopOrdersVisible} onShowOrders={() => setIsDesktopOrdersVisible(true)} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onRefresh={refreshData} isRefreshing={isFetchingPosData} />
            </div>
          </main>
          <div className={`flex flex-col bg-white shadow-2xl h-full z-20 transition-all duration-300 ease-out overflow-hidden ${isCartVisible ? 'translate-x-0' : 'translate-x-full'} absolute inset-y-0 right-0 w-96 max-w-full`}>
            <div className="flex justify-start p-4 border-b bg-orange-500 rounded-tl-2xl">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsCartVisible(false)}><X className="w-5 h-5" /></Button>
            </div>
            <OrderPanel currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} isCheckingLoyalty={isCheckingLoyalty} onSelectTableClick={() => setTableModalOpen(true)} onFinalize={handleFinalize} onHoldOrder={handleHoldOrder} onClearOrder={clearOrder} onCancelOrder={handleCancelOrder} onSettleOrder={handleSettleOrder} isDateClosed={isDateClosed} onViewCustomerHistory={setViewingCustomerId} profile={profile} onApplyPromoCode={handleApplyPromoCode} onRemovePromoCode={handleRemovePromoCode} getCurrentOrderType={getCurrentOrderType} onEditItem={profile?.allow_item_edit ? setEditingCartItem : null} />
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden xl:flex w-full h-full flex-col p-4 gap-4 relative overflow-hidden">
          <div className="flex gap-2 mb-2">
            <OpenDrawerButton />
            {profile?.customer_display_enabled && (
              <Button variant="outline" size="icon" onClick={() => window.open(`${createPageUrl('CustomerDisplay')}?tenant=${currentTenant?.id}`, '_blank', 'width=1920,height=1080')} className="bg-purple-600 text-white border-0 shadow-lg" title="Ouvrir l'écran client"><Menu className="w-5 h-5" /></Button>
            )}
          </div>
          <div className="flex gap-4 flex-1 min-h-0">
            {isDesktopOrdersVisible && (
              <div className="w-[340px] flex-shrink-0 flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden">
                <OrdersList orders={orders} onEditOrder={handleEditOrderWrapper} customers={customers} onRefresh={refreshData} isLoading={isFetchingPosData} workingDate={workingDate} onSettleOrder={handleSettleOrder} onCancelOrder={handleCancelOrder} profile={profile} onManualPrint={setLastCompletedOrder} onHide={() => setIsDesktopOrdersVisible(false)} />
              </div>
            )}
            <div className="flex-1 flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden min-w-[400px]">
              <ProductGrid products={products} categories={categories} menuFormulas={menuFormulas} menuItems={menuItems} onAddToCart={handleAddToCart} onAddMenuToCart={handleAddMenuToCart} isDateClosed={isDateClosed} isOrdersVisible={isDesktopOrdersVisible} onShowOrders={() => setIsDesktopOrdersVisible(!isDesktopOrdersVisible)} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onRefresh={refreshData} isRefreshing={isFetchingPosData} />
            </div>
            <div className="w-[420px] flex-shrink-0 flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden">
              <OrderPanel currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} isCheckingLoyalty={isCheckingLoyalty} onSelectTableClick={() => setTableModalOpen(true)} onFinalize={handleFinalize} onHoldOrder={handleHoldOrder} onClearOrder={clearOrder} onCancelOrder={handleCancelOrder} onSettleOrder={handleSettleOrder} isDateClosed={isDateClosed} onViewCustomerHistory={setViewingCustomerId} profile={profile} onApplyPromoCode={handleApplyPromoCode} onRemovePromoCode={handleRemovePromoCode} getCurrentOrderType={getCurrentOrderType} onEditItem={profile?.allow_item_edit ? setEditingCartItem : null} />
            </div>
          </div>
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => { setShowPayment(false); setWebOrderToSettle(null); setWebOrderCustomer(null); }}
          onPayment={webOrderToSettle
            ? async (paymentData) => {
                const cagnotteUsed = paymentData.cagnotte_spent || 0;
                await appClient.entities.Order.update(webOrderToSettle.id, withTenant({ payee: true, statut: 'payé', mode_paiement: paymentData.mode_paiement || [], cagnotte_spent: (webOrderToSettle.cagnotte_spent || 0) + cagnotteUsed }));
                if (cagnotteUsed > 0 && webOrderCustomer) {
                  const newBalance = Math.max(0, (webOrderCustomer.cagnotte_balance || 0) - cagnotteUsed);
                  await appClient.entities.Customer.update(webOrderCustomer.id, withTenant({ cagnotte_balance: newBalance }));
                }
                const updatedOrder = { ...webOrderToSettle, payee: true, statut: 'payé', mode_paiement: paymentData.mode_paiement || [] };
                setWebOrderToSettle(null); setWebOrderCustomer(null);
                return updatedOrder;
              }
            : handleCreateOrUpdateOrder
          }
          onComplete={(result) => { handlePaymentComplete(result); setWebOrderToSettle(null); }}
          totalAmount={totalForPaymentModal}
          customerCagnotte={webOrderToSettle ? (webOrderCustomer?.cagnotte_balance || 0) : (currentOrder?.customer?.cagnotte_balance || 0)}
          cagnotteRule={cagnotteRule}
          orderType={webOrderToSettle ? (webOrderToSettle.type_commande || 'emporter') : (currentOrder?.orderType || 'sur_place')}
          profile={profile}
        />
      )}

      {showConfirmation && confirmedOrder && (
        <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-200"><CheckCircle className="w-8 h-8 text-green-600"/></div>
              <h2 className="2xl font-bold text-gray-800">Commande validée !</h2>
              {!confirmedOrder.payee && <p className="text-lg font-semibold text-orange-600 bg-orange-100 px-4 py-2 rounded-lg">Commande créée en crédit !</p>}
              <p className="text-lg text-gray-500">Commande #{confirmedOrder.numero_caisse}</p>
              {!confirmedOrder.payee && <p className="text-sm text-gray-500 pt-2">À encaisser ultérieurement</p>}
              <div className="flex w-full gap-4 pt-4">
                <Button className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700" onClick={() => { setLastCompletedOrder(confirmedOrder); }}><Printer className="w-5 h-5 mr-2"/> Imprimer ticket</Button>
                <Button className="w-full h-12 text-lg" variant="outline" onClick={() => setShowConfirmation(false)}>Fermer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {lastCompletedOrder && (
        <TicketPrint order={lastCompletedOrder} customer={lastOrderCustomer || customers[lastCompletedOrder.customer_id]} profile={profile} onPrinted={() => setLastCompletedOrder(null)} />
      )}

      {showMenuCustomization && customizingMenu && (
        <MenuCustomizationModal menu={customizingMenu} menuItems={menuItems || []} products={products || []} categories={categories || []} optionGroups={optionGroups || []} optionItems={optionItems || []} allIngredients={ingredients || []} allProductIngredients={productIngredients || []} onConfirm={handleMenuCustomizationConfirm} onCancel={() => { setShowMenuCustomization(false); setCustomizingMenu(null); }} />
      )}

      {editingCartItem && (
        <ProductCustomizationModal
          product={(() => { const item = editingCartItem; const product = products.find(p => p.id === item.product_id); return product || { id: item.product_id, nom: item.nom_produit?.replace(/ \([^)]+\)$/, '') || item.nom_produit, base_price: item.prix_unitaire, category_id: item.category_id, tva: item.tva_rate }; })()}
          category={(() => { const item = editingCartItem; const product = products.find(p => p.id === item.product_id); return categories.find(c => c.id === product?.category_id) || null; })()}
          quantity={editingCartItem.quantite}
          fixedSize={editingCartItem.size || null}
          initialSelectedOptions={editingCartItem.selected_options || []}
          initialExcludedIngredients={editingCartItem.excluded_ingredients || []}
          initialNotes={editingCartItem.notes || ''}
          initialQuantity={editingCartItem.quantite}
          onConfirm={handleEditItemConfirm}
          onCancel={() => setEditingCartItem(null)}
          optionGroups={optionGroups || []} optionItems={optionItems || []} allIngredients={ingredients || []} allProductIngredients={productIngredients || []}
          orderType={currentOrder?.orderType || 'sur_place'} profile={profile}
        />
      )}

      {customizingProduct && (
        <ProductCustomizationModal product={customizingProduct.product} category={customizingProduct.category} quantity={customizingProduct.quantity} type={customizingProduct.product.isMenu ? 'menu' : customizingProduct.type} fixedSize={customizingProduct.fixedSize} onConfirm={handleConfirmCustomization} onCancel={() => setCustomizingProduct(null)} optionGroups={optionGroups || []} optionItems={optionItems || []} allIngredients={ingredients || []} allProductIngredients={productIngredients || []} orderType={currentOrder?.orderType || 'sur_place'} profile={profile} />
      )}

      {viewingCustomerId && (
        <Dialog open={!!viewingCustomerId} onOpenChange={() => setViewingCustomerId(null)}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <CustomerHistory customerId={viewingCustomerId} tenantId={currentTenant?.id} onClose={() => setViewingCustomerId(null)} onSettleOrder={handleSettleOrder} onSelectAddress={currentOrder?.orderType === 'livraison' ? (addrStr) => { setCurrentOrder(prev => prev ? { ...prev, customer: { ...prev.customer, selectedAdresse: addrStr } } : null); } : undefined} />
          </DialogContent>
        </Dialog>
      )}

      <TableSelectionModal
        isOpen={isTableModalOpen}
        onClose={() => setTableModalOpen(false)}
        tables={allTables}
        onSelectTable={(table) => {
          setCurrentOrder(prev => ({ ...(prev || { articles: [], discounts: [], loyaltyDiscount: null, promoCode: null, notes: '', customer: null, orderType: 'sur_place', table: null }), table, orderType: 'sur_place' }));
          setTableModalOpen(false);
          toast({ title: `Table ${table.nom} sélectionnée.` });
        }}
      />
    </div>
  );
}


