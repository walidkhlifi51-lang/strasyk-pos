import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, ArrowLeft, X, Search } from 'lucide-react';
import { calculateOfferDiscounts } from '@/utils/offerUtils';
import ProductIngredientsButton from '../restaurant-site/ProductIngredientsButton';
import OnlineProductCustomizer from './OnlineProductCustomizer';
import OnlineMenuCustomizer from './OnlineMenuCustomizer';
import ScratchTicketDisplay from '../scratch/ScratchTicketDisplay';

// Retourne le prix web effectif d'un produit (avec flash offer appliqué)
export function getWebPrice(product, flashOffer = null, selectedSize = null, orderType = null) {
  if (flashOffer?.active && flashOffer?.product_id === product.id && flashOffer?.reduction_type === 'fixed_price_by_size') {
    const cibles = (flashOffer.cible || 'site').split(',').map(c => c.trim());
    if (cibles.includes('site') && selectedSize) {
      const flashPrice = flashOffer.size_prices?.find(sp => sp.size === selectedSize)?.price;
      if (flashPrice != null && flashPrice > 0) return flashPrice;
    }
  }

  let price;
  if (selectedSize) {
    const webSp = product.web_size_prices?.find(s => s.size === selectedSize);
    const sp = product.size_prices?.find(s => s.size === selectedSize);
    const modeSp = product.size_prix_par_mode?.find(s => s.size === selectedSize);
    let modePrice = 0;
    if (modeSp) {
      if (orderType && modeSp[orderType] > 0) modePrice = modeSp[orderType];
      else {
        const validPrices = [modeSp.emporter, modeSp.livraison, modeSp.sur_place].filter(p => p > 0);
        if (validPrices.length > 0) modePrice = Math.min(...validPrices);
      }
    }
    price = (webSp?.price > 0 ? webSp.price : null) ?? (sp?.price > 0 ? sp.price : null) ?? (modePrice > 0 ? modePrice : null) ?? 0;
  } else {
    if (product.web_price && product.web_price > 0) price = product.web_price;
    else if (product.base_price && product.base_price > 0) price = product.base_price;
    else if (product.prix_par_mode && Object.keys(product.prix_par_mode).length > 0) {
      if (orderType && product.prix_par_mode[orderType] > 0) price = product.prix_par_mode[orderType];
      else {
        const validPrices = Object.values(product.prix_par_mode).filter(p => p > 0);
        price = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      }
    } else if (product.size_prices?.length > 0) {
      price = product.size_prices.find(sp => sp.price > 0)?.price || 0;
    } else price = 0;
  }

  if (flashOffer?.active && flashOffer?.product_id === product.id && (flashOffer?.reduction_value > 0 || flashOffer?.reduction_type === 'fixed_price_by_size')) {
    const cibles = (flashOffer.cible || 'site').split(',').map(c => c.trim());
    if (cibles.includes('site')) {
      if (flashOffer.reduction_type === 'percentage') price = price * (1 - flashOffer.reduction_value / 100);
      else if (flashOffer.reduction_type === 'fixed_amount') price = Math.max(0, price - flashOffer.reduction_value);
    }
  }
  return price;
}

export default function OnlineProductBrowser({ products, menus = [], categories, profile, orderType, cart, onCartChange, onCheckout, onBack, flashOffer, ingredientsByProduct = {}, optionGroups = [], optionItems = [], allProductIngredients = [], allIngredients = [], tenantId, onAddScratchToCart, offers = [] }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSizeModal, setShowSizeModal] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [customizerProduct, setCustomizerProduct] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(null);

  const primaryColor = profile.site_primary_color || profile.kiosk_primary_color || '#f97316';

  const rootCategories = useMemo(() => 
    categories.filter(c => !c.parent_id).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.nom.localeCompare(b.nom)),
  [categories]);

  const visibleProducts = useMemo(() => {
    let list;
    if (selectedCategory) {
      const subCategoryIds = categories.filter(c => c.parent_id === selectedCategory).map(c => c.id);
      const allCategoryIds = [selectedCategory, ...subCategoryIds];
      list = products.filter(p => allCategoryIds.includes(p.category_id));
    } else {
      list = products;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.nom.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, categories, selectedCategory, searchQuery]);

  const visibleMenus = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return menus.filter(m => m.nom.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    if (selectedCategory) return menus.filter(m => m.category_id === selectedCategory);
    return menus;
  }, [menus, selectedCategory, searchQuery]);

  const handleMenuConfirm = ({ menu, menuDetails, price }) => {
    const itemKey = `menu-${menu.id}-${Date.now()}`;
    onCartChange([...cart, { _key: itemKey, product_id: menu.id, menu_id: menu.id, isMenu: true, nom_produit: `🍽️ ${menu.nom}`, quantite: 1, prix_unitaire: price, total_ligne: price, tva: Number(menu.tva) || 0, options: [], exclusions: [], menuDetails }]);
    setSelectedMenu(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total_ligne, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantite, 0);

  const offerDiscounts = useMemo(() => {
    const realItems = cart.filter(i => !i.is_scratch_discount && !i.is_scratch_gift && i.product_id && !i.product_id.startsWith('offer-'));
    return calculateOfferDiscounts(realItems, offers, orderType, products);
  }, [cart, offers, orderType, products]);
  const offerDiscountTotal = offerDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const cartTotalAfterOffers = Math.max(0, cartTotal + offerDiscountTotal);

  const getProductPrice = (product) => {
    const sizes = product.size_prices?.length > 0 ? product.size_prices.map(s => s.size)
                : product.size_prix_par_mode?.length > 0 ? product.size_prix_par_mode.map(s => s.size) : null;
    if (sizes?.length > 0) {
      const prices = sizes.map(size => getWebPrice(product, flashOffer, size)).filter(p => p > 0);
      return prices.length > 0 ? Math.min(...prices) : getWebPrice(product, flashOffer);
    }
    return getWebPrice(product, flashOffer);
  };

  const productHasSizes = (product) => (product.size_prices?.length > 0) || (product.size_prix_par_mode?.length > 0);

  const addToCart = (product, selectedSize = null) => {
    const price = getWebPrice(product, flashOffer, selectedSize);
    const itemKey = `${product.id}-${selectedSize || 'default'}`;
    const existingIndex = cart.findIndex(item => item._key === itemKey);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex] = { ...newCart[existingIndex], quantite: newCart[existingIndex].quantite + 1, total_ligne: (newCart[existingIndex].quantite + 1) * price };
      onCartChange(newCart);
    } else {
      onCartChange([...cart, { _key: itemKey, product_id: product.id, category_id: product.category_id, nom_produit: selectedSize ? `${product.nom} (${selectedSize})` : product.nom, selectedSize: selectedSize || null, quantite: 1, prix_unitaire: price, total_ligne: price, tva: product.tva || 5.5, options: [], exclusions: [] }]);
    }
  };

  const hasCustomization = (product) => {
    const hasSizes = product.size_prices?.length > 0;
    const category = categories.find(c => c.id === product.category_id);
    const hasCategorySizes = category?.manages_sizes && category?.size_template?.length > 0;
    const hasOptions = optionGroups.some(g => g.product_id === product.id);
    const hasRemovable = allProductIngredients.some(pi => pi.product_id === product.id && pi.retirable);
    return hasSizes || hasCategorySizes || hasOptions || hasRemovable;
  };

  const handleAddProduct = (product) => {
    if (hasCustomization(product)) setCustomizerProduct(product);
    else addToCart(product);
  };

  const handleCustomizerConfirm = ({ product, quantity, selectedSize, selectedOptions, excludedIngredients, notes, finalPrice }) => {
    const itemKey = `${product.id}-${selectedSize || 'default'}-${JSON.stringify(selectedOptions)}-${JSON.stringify(excludedIngredients)}`;
    onCartChange([...cart, { _key: itemKey, product_id: product.id, category_id: product.category_id, nom_produit: selectedSize ? `${product.nom} (${selectedSize})` : product.nom, selectedSize: selectedSize || null, quantite: quantity, prix_unitaire: finalPrice, total_ligne: finalPrice * quantity, tva: product.tva || 5.5, options: selectedOptions, exclusions: excludedIngredients, notes }]);
    setCustomizerProduct(null);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    const newQty = newCart[index].quantite + delta;
    if (newQty <= 0) newCart.splice(index, 1);
    else newCart[index] = { ...newCart[index], quantite: newQty, total_ligne: newQty * newCart[index].prix_unitaire };
    onCartChange(newCart);
  };

  // Détermine si on est en mode "catégories" (vue d'accueil) ou "produits"
  const showingCategories = !selectedCategory && !searchQuery.trim();
  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.nom;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {profile.logo_url && <img src={profile.logo_url} alt="" className="w-7 h-7 rounded-full object-contain flex-shrink-0" />}
            <span className="font-semibold text-gray-900 truncate">{profile.nom_etablissement}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 flex-shrink-0">
              {orderType === 'livraison' ? '🛵 Livraison' : '🥡 À emporter'}
            </span>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-white font-medium text-sm flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{cartCount > 0 ? `${cartTotal.toFixed(2)}€` : 'Panier'}</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedCategory(null); }}
              placeholder="Rechercher un produit..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': primaryColor }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb quand une catégorie est sélectionnée */}
        {selectedCategory && (
          <div className="max-w-6xl mx-auto px-4 pb-2 flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Catégories
            </button>
            <span className="text-gray-300">›</span>
            <span className="text-sm font-semibold text-gray-800">{selectedCategoryName}</span>
          </div>
        )}
      </div>

      {/* Bandeau flash offer */}
      {flashOffer && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-4">
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
            <span className="text-yellow-300 text-lg">⚡</span>
            <span className="font-bold">{flashOffer.titre}</span>
            {flashOffer.reduction_value > 0 && (
              <span className="ml-auto bg-white bg-opacity-20 rounded-lg px-2 py-0.5 text-xs">
                -{flashOffer.reduction_type === 'percentage' ? `${flashOffer.reduction_value}%` : `${flashOffer.reduction_value}€`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scratch Ticket */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4">
        <ScratchTicketDisplay
          tenantId={tenantId}
          displayOn="order_page"
          cartTotal={cartTotal}
          onAddToCart={(gain) => {
            if (gain.type === 'product') {
              onCartChange(prevCart => [...prevCart, { _key: `scratch-gift-${Date.now()}`, product_id: gain.product_id || 'scratch-gift', nom_produit: `🎁 CADEAU: ${gain.product_nom}`, quantite: gain.quantite || 1, prix_unitaire: 0, total_ligne: 0, tva: 5.5, options: [], exclusions: [], is_scratch_gift: true }]);
            } else if (gain.type === 'percentage_discount' || gain.type === 'fixed_discount') {
              const reductionLabel = gain.type === 'percentage_discount' ? `Réduction -${gain.reduction_value}%` : `Réduction -${gain.reduction_value}€`;
              onCartChange(prevCart => [...prevCart, { _key: `scratch-reduction-${Date.now()}`, product_id: 'scratch-reduction', nom_produit: `🎫 CADEAU SCRATCH: ${reductionLabel}`, quantite: 1, prix_unitaire: 0, total_ligne: 0, tva: 0, options: [], exclusions: [], is_scratch_discount: true, scratch_discount_type: gain.type, scratch_discount_value: gain.reduction_value }]);
            }
          }}
          primaryColor={primaryColor}
          profile={profile}
        />
      </div>

      {/* === VUE CATÉGORIES === */}
      {showingCategories && (
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Nos catégories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {rootCategories.map(cat => {
              const subIds = categories.filter(c => c.parent_id === cat.id).map(c => c.id);
              const productCount = products.filter(p => [cat.id, ...subIds].includes(p.category_id)).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="group flex flex-col overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all bg-white border border-gray-100 active:scale-95"
                >
                  <div className="w-full aspect-square overflow-hidden bg-white">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.nom}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-5xl"
                        style={{ backgroundColor: cat.color || '#f3f4f6' }}
                      >
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <p className="font-bold text-gray-900 text-sm leading-tight">{cat.nom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{productCount} produit{productCount > 1 ? 's' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === VUE PRODUITS (catégorie sélectionnée ou recherche) === */}
      {!showingCategories && (
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          {visibleProducts.length === 0 && visibleMenus.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucun produit disponible</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Menus */}
              {visibleMenus.map(menu => (
                <div key={menu.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow relative cursor-pointer" onClick={() => setSelectedMenu(menu)}>
                  <div className="absolute top-2 left-2 z-10 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Menu</div>
                  {menu.image_url ? (
                    <img src={menu.image_url} alt={menu.nom} className="w-full h-36 object-contain" style={{ mixBlendMode: 'multiply' }} />
                  ) : (
                    <div className="w-full h-36 flex items-center justify-center text-4xl" style={{ backgroundColor: menu.color || '#4CAF50' }}>🍽️</div>
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{menu.nom}</h3>
                    {menu.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{menu.description}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-bold text-sm text-gray-900">{menu.prix?.toFixed(2)}€</span>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedMenu(menu); }} className="w-8 h-8 rounded-full text-white flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Produits */}
              {visibleProducts.map(product => {
                const price = getProductPrice(product);
                const hasSize = productHasSizes(product);
                const isWebPriceDiscounted = !hasSize && product.web_price != null && product.web_price < product.base_price - 0.001;
                const isFlashProduct = flashOffer?.product_id === product.id;
                const flashOrigPrice = hasSize ? null : (product.web_price ?? product.base_price ?? 0);
                const flashFinalPrice = isFlashProduct && !hasSize ? getWebPrice(product, flashOffer) : null;
                const hasFlashDiscount = isFlashProduct && flashFinalPrice != null && flashFinalPrice < flashOrigPrice - 0.001;
                const showStrikethrough = !hasSize && (isWebPriceDiscounted || hasFlashDiscount);
                const strikePrice = hasFlashDiscount ? flashOrigPrice : (product.base_price ?? 0);
                const isPromo = isWebPriceDiscounted || hasFlashDiscount;

                return (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow relative">
                    {isPromo && (
                      <div className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {hasFlashDiscount ? '⚡ Flash' : '🌐 Web'}
                      </div>
                    )}
                    {product.image_url ? (
                      <div className="relative">
                        <img src={product.image_url} alt={product.nom} className="w-full h-36 object-contain" style={{ mixBlendMode: 'multiply' }} />
                        <span className="absolute bottom-0.5 right-1 text-[9px] text-gray-300 italic">Photo non contractuelle</span>
                      </div>
                    ) : (
                      <div className="w-full h-36 flex items-center justify-center text-4xl" style={{ backgroundColor: product.color || '#f3f4f6' }}>🍽️</div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">{product.nom}</h3>
                        <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} />
                      </div>
                      {product.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{product.description}</p>}
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          {showStrikethrough && <p className="text-xs text-gray-400 line-through">{strikePrice.toFixed(2)}€</p>}
                          <span className="font-bold text-sm" style={{ color: isPromo ? '#ef4444' : '#111827' }}>
                            {price > 0 ? `${hasSize ? 'Dès ' : ''}${price.toFixed(2)}€` : '—'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddProduct(product)}
                          className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom checkout bar */}
      {cartCount > 0 && (
        <div className="sticky bottom-0 bg-white border-t shadow-lg p-4 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{cartCount} article{cartCount > 1 ? 's' : ''}</p>
              {offerDiscounts.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-400 line-through">{cartTotal.toFixed(2)}€</p>
                  <p className="text-sm font-bold text-purple-600">🎁 {cartTotalAfterOffers.toFixed(2)}€</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Total : {cartTotal.toFixed(2)}€</p>
              )}
            </div>
            <button onClick={onCheckout} className="px-8 py-3 text-white font-semibold rounded-xl transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor }}>
              Commander →
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">Mon panier</h3>
              <button onClick={() => setShowCart(false)} className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.nom_produit}</p>
                    <p className="text-xs text-gray-400">{item.prix_unitaire.toFixed(2)}€ / unité</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(index, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="w-6 text-center font-semibold text-sm">{item.quantite}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}><Plus className="w-3 h-3" /></button>
                  </div>
                  <span className="w-14 text-right font-semibold text-sm">{item.total_ligne.toFixed(2)}€</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              {offerDiscounts.map(d => (
                <div key={d.id} className="flex justify-between text-sm text-purple-600 font-semibold mb-1">
                  <span>🎁 {d.name}</span><span>{d.amount.toFixed(2)}€</span>
                </div>
              ))}
              <div className="flex justify-between mb-4">
                <span className="font-bold">Total</span>
                <span className="font-bold text-xl">{cartTotalAfterOffers.toFixed(2)}€</span>
              </div>
              <button onClick={() => { setShowCart(false); onCheckout(); }} className="w-full py-3 text-white font-semibold rounded-xl" style={{ backgroundColor: primaryColor }}>
                Valider la commande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product customizer modal */}
      {customizerProduct && (
        <OnlineProductCustomizer
          product={customizerProduct}
          category={categories.find(c => c.id === customizerProduct.category_id)}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allIngredients={allIngredients}
          allProductIngredients={allProductIngredients}
          flashOffer={flashOffer}
          primaryColor={primaryColor}
          onConfirm={handleCustomizerConfirm}
          onCancel={() => setCustomizerProduct(null)}
        />
      )}

      {/* Menu customizer */}
      {selectedMenu && (
        <OnlineMenuCustomizer
          menu={selectedMenu}
          products={products}
          categories={categories}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allIngredients={allIngredients}
          allProductIngredients={allProductIngredients}
          primaryColor={primaryColor}
          tenantId={tenantId}
          onConfirm={handleMenuConfirm}
          onCancel={() => setSelectedMenu(null)}
        />
      )}

      {/* Size selection modal */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSizeModal(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{showSizeModal.nom}</h3>
              <button onClick={() => setShowSizeModal(null)} className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Choisissez une taille :</p>
            <div className="space-y-2">
              {showSizeModal.size_prices.map(sp => {
                const webP = getWebPrice(showSizeModal, flashOffer, sp.size);
                const origP = sp.price;
                const hasDiscount = webP < origP - 0.001;
                return (
                  <button key={sp.size} onClick={() => { addToCart(showSizeModal, sp.size); setShowSizeModal(null); }} className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-gray-100 hover:border-orange-300 transition-colors">
                    <span className="font-medium">{sp.size}</span>
                    <div className="flex items-center gap-2">
                      {hasDiscount && <span className="text-xs line-through text-gray-400">{origP.toFixed(2)}€</span>}
                      <span className="font-bold" style={{ color: hasDiscount ? '#ef4444' : primaryColor }}>{webP.toFixed(2)}€</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

