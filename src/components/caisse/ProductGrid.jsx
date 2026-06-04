import React, { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Utensils, Plus, Layers, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

const CategoryButton = ({ category, isSelected, onClick, hasChildren }) => {
  const bgStyle = isSelected 
    ? { backgroundColor: category.color || '#3b82f6', color: 'white' }
    : { backgroundColor: `${category.color}20` || '#f3f4f6', color: category.color || '#374151' };

  const imgDisplay = category.image_display;
  const shouldShowImage = category.image_url && (
    !imgDisplay ||
    (Array.isArray(imgDisplay) ? imgDisplay.includes('caisse') : (imgDisplay === 'both' || imgDisplay === 'caisse'))
  );

  return (
    <Button
      variant="outline"
      onClick={onClick}
      size="lg"
      style={bgStyle}
      className={`whitespace-nowrap font-semibold text-base transition-all hover:scale-105 border-2 px-6 py-6 ${
        isSelected ? 'border-white shadow-lg' : 'border-transparent'
      }`}
    >
      {shouldShowImage ? (
        <img src={category.image_url} alt={category.nom} className="w-8 h-8 rounded-md mr-3 object-contain" style={{ mixBlendMode: 'multiply' }} />
      ) : (
        <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: category.color || '#3b82f6' }}></div>
      )}
      {category.nom}
      {hasChildren && <Layers className="w-4 h-4 ml-2 opacity-60" />}
    </Button>
  );
};

const resolveProductDisplayPrice = (product) => {
  if (product.size_prix_par_mode && product.size_prix_par_mode.length > 0) {
    const allPrices = [];
    product.size_prix_par_mode.forEach(sp => {
      if (sp.sur_place && sp.sur_place > 0) allPrices.push(sp.sur_place);
      if (sp.emporter && sp.emporter > 0) allPrices.push(sp.emporter);
      if (sp.livraison && sp.livraison > 0) allPrices.push(sp.livraison);
    });
    if (allPrices.length > 0) {
      const minPrice = Math.min(...allPrices);
      return `a partir de ${minPrice.toFixed(2)} EUR`;
    }
  }
  if (product.size_prices && product.size_prices.length > 0) {
    const prices = product.size_prices.map(p => p.price).filter(p => p != null && p > 0);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      return `a partir de ${minPrice.toFixed(2)} EUR`;
    }
  }
  if (product.prix_par_mode) {
    const prices = [
      product.prix_par_mode.sur_place,
      product.prix_par_mode.emporter,
      product.prix_par_mode.livraison
    ].filter(p => p !== null && p !== undefined && !isNaN(p) && p > 0);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      return `a partir de ${minPrice.toFixed(2)} EUR`;
    }
  }
  if (product.base_price != null && product.base_price > 0) return `${product.base_price.toFixed(2)} EUR`;
  if (product.prix != null && product.prix > 0) return `${product.prix.toFixed(2)} EUR`;
  return 'N/A';
};

const ProductCard = ({ product, categories, onAddToCart }) => {
  const category = (categories || []).find(c => c.id === product.category_id);
  
  // Afficher l'image uniquement si autorisé pour la caisse
  const imgDisplay = product.image_display;
  const shouldShowImage = product.image_url && (
    !imgDisplay ||
    (Array.isArray(imgDisplay) ? imgDisplay.includes('caisse') : (imgDisplay === 'both' || imgDisplay === 'caisse'))
  );
  
  const displayPrice = resolveProductDisplayPrice(product);

  return (
    <Card 
      className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-2 hover:border-orange-400 h-full flex flex-col"
      onClick={() => onAddToCart(product, 1)}
      style={{ borderLeftColor: product.color || category?.color || '#eeeeee', borderLeftWidth: '4px' }}
    >
      {shouldShowImage && (
        <div className="h-40 overflow-hidden bg-white flex items-center justify-center">
          <img 
            src={product.image_url} 
            alt={product.nom}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      )}
      <CardContent className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2 mb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base leading-tight flex-1 min-h-[2.5rem]">
              {product.nom}
            </h3>
            <Plus className="w-6 h-6 text-orange-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
          </div>
          {product.description && (
            <p className="text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <Badge 
            variant="outline" 
            className="text-xs font-medium px-2 py-1" 
            style={{ 
              backgroundColor: `${category?.color}20`, 
              borderColor: category?.color,
              color: category?.color
            }}
          >
            {category?.nom || 'N/A'}
          </Badge>
          <span className="font-bold text-lg text-orange-600 whitespace-nowrap">
            {displayPrice}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const MenuCard = ({ menu, categories, onAddMenuToCart }) => {
  const category = (categories || []).find(c => c.id === menu.category_id);
  
  return (
    <Card 
      className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-2 hover:border-green-400 h-full flex flex-col"
      onClick={() => onAddMenuToCart(menu, 1)}
      style={{ borderLeftColor: menu.color || '#4CAF50', borderLeftWidth: '4px' }}
    >
      {menu.image_url && (
        <div className="h-40 overflow-hidden bg-white flex items-center justify-center">
          <img 
            src={menu.image_url} 
            alt={menu.nom}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      )}
      <CardContent className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2 mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-h-[2.5rem]">
              <Utensils className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <h3 className="font-bold text-base leading-tight">
                {menu.nom}
              </h3>
            </div>
            <Plus className="w-6 h-6 text-green-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
          </div>
          {menu.description && (
            <p className="text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
              {menu.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <Badge variant="outline" className="text-xs font-medium px-2 py-1 bg-green-50 border-green-300 text-green-700">
            {category?.nom || 'Menu'}
          </Badge>
          <span className="font-bold text-lg text-green-600 whitespace-nowrap">
            {menu.prix?.toFixed(2)}€
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ProductGrid({ 
  products = [], 
  categories = [], 
  onAddToCart, 
  selectedCategory = null,
  setSelectedCategory,
  menuFormulas = [],
  menuItems = [],
  onAddMenuToCart,
  onRefresh,
  isRefreshing = false,
  isOrdersVisible,
  onShowOrders
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const loggedProductIdRef = useRef(null);
  
  console.log('[ProductGrid] menuFormulas received:', menuFormulas);
  console.log('[ProductGrid] products received:', products);
  console.log('[ProductGrid] categories received:', categories);

  useEffect(() => {
    const debugProduct = (products || []).find((product) =>
      (Array.isArray(product?.size_prices) && product.size_prices.length > 0)
      || (Array.isArray(product?.size_prix_par_mode) && product.size_prix_par_mode.length > 0)
      || product?.sizes != null
      || product?.tailles != null
    ) || products?.[0];

    if (!debugProduct || loggedProductIdRef.current === debugProduct.id) return;

    loggedProductIdRef.current = debugProduct.id;
    console.log('[ProductGrid][runtime product debug]', {
      id: debugProduct.id,
      nom: debugProduct.nom,
      prix: debugProduct.prix,
      prix_par_mode: debugProduct.prix_par_mode,
      size_prices: debugProduct.size_prices,
      size_prix_par_mode: debugProduct.size_prix_par_mode,
      sizes: debugProduct.sizes,
      tailles: debugProduct.tailles,
      price: debugProduct.price,
      base_price: debugProduct.base_price,
      resolvedDisplayPrice: resolveProductDisplayPrice(debugProduct),
      available_keys: Object.keys(debugProduct).sort(),
    });
  }, [products]);

  const categoryTree = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    
    const map = {};
    const roots = [];
    categories.forEach(cat => {
      map[cat.id] = { ...cat, children: [] };
    });
    categories.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    });
    return roots.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    let filtered = products.filter(p => p && p.disponible !== false);

    // Si recherche active, on cherche dans tous les produits (ignore filtre catégorie)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return filtered.filter(p => 
        (p.nom && p.nom.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }
    
    if (selectedCategory === 'menus') {
      return [];
    }
    
    if (selectedCategory && selectedCategory !== 'menus' && categories && categories.length > 0) {
      const selectedCat = categories.find(c => c.id === selectedCategory);
      if (selectedCat) {
        const getAllChildIds = (cat) => {
          let ids = [cat.id];
          const children = categories.filter(c => c.parent_id === cat.id);
          children.forEach(child => {
            ids = ids.concat(getAllChildIds(child));
          });
          return ids;
        };
        const categoryIds = getAllChildIds(selectedCat);
        filtered = filtered.filter(p => categoryIds.includes(p.category_id));
      }
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm, categories]);

  const filteredMenus = useMemo(() => {
    if (!menuFormulas || !Array.isArray(menuFormulas)) return [];
    
    let filtered = menuFormulas.filter(m => m && m.disponible !== false);

    // Si recherche active, on cherche dans tous les menus (ignore filtre catégorie)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return filtered.filter(m => 
        (m.nom && m.nom.toLowerCase().includes(term)) ||
        (m.description && m.description.toLowerCase().includes(term))
      );
    }
    
    if (selectedCategory === 'menus') {
      return filtered;
    }
    
    if (selectedCategory && selectedCategory !== 'menus' && categories && categories.length > 0) {
      const selectedCat = categories.find(c => c.id === selectedCategory);
      if (selectedCat) {
        const getAllChildIds = (cat) => {
          let ids = [cat.id];
          const children = categories.filter(c => c.parent_id === cat.id);
          children.forEach(child => {
            ids = ids.concat(getAllChildIds(child));
          });
          return ids;
        };
        const categoryIds = getAllChildIds(selectedCat);
        filtered = filtered.filter(m => categoryIds.includes(m.category_id));
      }
    }
    
    return filtered;
  }, [menuFormulas, selectedCategory, searchTerm, categories]);

  const totalItems = filteredProducts.length + filteredMenus.length;
  
  // NOUVEAU : Calculer le nombre total de produits et menus disponibles pour les badges
  const totalProductsAvailable = useMemo(() =>
    (products || []).filter(p => p && p.disponible !== false).length,
    [products]
  );

  const totalMenusAvailable = useMemo(() => 
    (menuFormulas || []).filter(m => m && m.disponible !== false).length,
    [menuFormulas]
  );


  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-shrink-0 p-4 bg-white border-b shadow-sm space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Rechercher un produit ou menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border-2 focus:border-orange-400 transition-colors"
            />
          </div>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="hover:bg-orange-50"
              title="Actualiser les produits"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onShowOrders && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={onShowOrders}
              className="hover:bg-blue-50"
              title={isOrdersVisible ? "Masquer les commandes" : "Afficher les commandes"}
            >
              {isOrdersVisible ? (
                <Maximize2 className="w-5 h-5" />
              ) : (
                <Minimize2 className="w-5 h-5" />
              )}
            </Button>
          )}
          </div>
      </div>

      <div className="flex-shrink-0 bg-white border-b shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              size="lg"
              className={`whitespace-nowrap font-semibold text-base transition-all hover:scale-105 border-2 px-6 py-6 ${
                selectedCategory === null 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg' 
                  : ''
              }`}
            >
              <ShoppingCart className="w-5 h-5 mr-3" />
              Tous les produits
            </Button>
            <Badge 
              variant="secondary" 
              className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center font-bold text-xs shadow-md"
            >
              {totalProductsAvailable + totalMenusAvailable}
            </Badge>
          </div>

          {/* NOUVEAU : Bouton Menus */}
          {totalMenusAvailable > 0 && (
            <div className="relative">
              <Button
                variant={selectedCategory === 'menus' ? "default" : "outline"}
                onClick={() => setSelectedCategory('menus')}
                size="lg"
                style={{
                  backgroundColor: selectedCategory === 'menus' ? '#4CAF50' : '#4CAF5020',
                  color: selectedCategory === 'menus' ? 'white' : '#4CAF50',
                  borderColor: selectedCategory === 'menus' ? 'white' : 'transparent'
                }}
                className={`whitespace-nowrap font-semibold text-base transition-all hover:scale-105 border-2 px-6 py-6 ${
                  selectedCategory === 'menus' ? 'shadow-lg' : ''
                }`}
              >
                <Utensils className="w-5 h-5 mr-3" />
                Menus
              </Button>
              <Badge 
                variant="outline" 
                className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center font-bold text-xs bg-white shadow-md"
              >
                {totalMenusAvailable}
              </Badge>
            </div>
          )}
          
          {categoryTree.map(cat => {
            const getAllChildIds = (currentCat) => {
              let ids = [currentCat.id];
              const children = categories.filter(c => c.parent_id === currentCat.id);
              children.forEach(child => {
                ids = ids.concat(getAllChildIds(child));
              });
              return ids;
            };
            const categoryIds = getAllChildIds(cat);
            
            const catProducts = (products || []).filter(p => p && categoryIds.includes(p.category_id) && p.disponible !== false);
            const catMenus = (menuFormulas || []).filter(m => m && categoryIds.includes(m.category_id) && m.disponible !== false);
            const count = catProducts.length + catMenus.length;
            
            console.log(`[ProductGrid] Category ${cat.nom}:`, {
              categoryIds,
              productsCount: catProducts.length,
              menusCount: catMenus.length,
              total: count
            });
            
            return (
              <div key={cat.id} className="relative">
                <CategoryButton
                  category={cat}
                  isSelected={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  hasChildren={cat.children && cat.children.length > 0}
                />
                {count > 0 && (
                  <Badge 
                    variant="outline" 
                    className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center font-bold text-xs bg-white shadow-md"
                  >
                    {count}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4">
          {totalItems === 0 ? (
            <div className="text-center py-20">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">
                {searchTerm ? `Aucun résultat pour "${searchTerm}"` : "Aucun produit disponible dans cette catégorie"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredMenus.map(menu => (
                <MenuCard 
                  key={menu.id} 
                  menu={menu} 
                  categories={categories}
                  onAddMenuToCart={onAddMenuToCart}
                />
              ))}
              {filteredProducts.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  categories={categories}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



