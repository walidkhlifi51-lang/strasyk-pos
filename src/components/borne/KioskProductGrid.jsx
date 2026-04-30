import React, { useState, useMemo } from "react";
import { ShoppingCart, Search, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function KioskProductGrid({
  products,
  categories,
  menus,
  onAddToCart,
  cart,
  hasMobileCartBar = false,
  terminalMode = false,
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const rootCategories = useMemo(() => {
    return categories.filter(cat => !cat.parent_id && cat.disponible);
  }, [categories]);
  const shouldShowCategoryHome = !selectedCategoryId && !searchTerm && rootCategories.length > 0;

  const getSubCategories = (parentId) => {
    return categories.filter(cat => cat.parent_id === parentId && cat.disponible);
  };

  const selectedCategory = selectedCategoryId 
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  const hasSubCategories = selectedCategory 
    ? getSubCategories(selectedCategory.id).length > 0
    : false;

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.disponible);

    // Si recherche active, chercher dans tous les produits sans filtre catégorie
    if (searchTerm) {
      return filtered.filter(p => 
        p.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategoryId) {
      if (hasSubCategories) {
        const subCatIds = getSubCategories(selectedCategoryId).map(sc => sc.id);
        filtered = filtered.filter(p => subCatIds.includes(p.category_id));
      } else {
        filtered = filtered.filter(p => p.category_id === selectedCategoryId);
      }
    }

    return filtered;
  }, [products, selectedCategoryId, searchTerm, hasSubCategories]);

  const filteredMenus = useMemo(() => {
    let filtered = menus.filter(m => m.disponible);

    // Si recherche active, chercher dans tous les menus sans filtre catégorie
    if (searchTerm) {
      return filtered.filter(m => 
        m.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategoryId) {
      filtered = filtered.filter(m => m.category_id === selectedCategoryId);
    }

    return filtered;
  }, [menus, selectedCategoryId, searchTerm]);

  const getProductPrice = (product) => {
    // Essayer d'abord les prix différenciés
    if (product.prix_par_mode) {
      const prices = Object.values(product.prix_par_mode).filter(p => p > 0);
      if (prices.length > 0) {
        return Math.min(...prices);
      }
    }
    
    // Ensuite les prix par taille
    if (product.size_prices?.length > 0) {
      const validPrices = product.size_prices.filter(sp => sp.price != null && sp.price > 0);
      if (validPrices.length > 0) {
        return Math.min(...validPrices.map(sp => sp.price));
      }
    }
    
    // Prix par taille et mode
    if (product.size_prix_par_mode?.length > 0) {
      const allPrices = [];
      product.size_prix_par_mode.forEach(spm => {
        if (spm.sur_place > 0) allPrices.push(spm.sur_place);
        if (spm.emporter > 0) allPrices.push(spm.emporter);
        if (spm.livraison > 0) allPrices.push(spm.livraison);
      });
      if (allPrices.length > 0) {
        return Math.min(...allPrices);
      }
    }
    
    // Enfin le prix de base
    if (product.base_price != null && product.base_price > 0) {
      return product.base_price;
    }
    
    return 0;
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantite, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header avec recherche et panier */}
      <div className="bg-white border-b p-4 flex items-center gap-4">
        {selectedCategoryId && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedCategoryId(null)}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        {cartItemCount > 0 && (
          <div className="relative">
            <ShoppingCart className="h-8 w-8 text-orange-600" />
            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white">
              {cartItemCount}
            </Badge>
          </div>
        )}
      </div>

      {/* Catégories ou Produits */}
      <div className={`flex-1 overflow-y-auto p-3 md:p-4 ${hasMobileCartBar ? 'pb-4' : ''}`}>
        {shouldShowCategoryHome ? (
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${terminalMode ? 'xl:grid-cols-5 2xl:grid-cols-6' : ''} gap-3 md:gap-4`}>
            {rootCategories.map(category => {
              const imgDisplay = category.image_display;
              const shouldShowImage = category.image_url && (
                !imgDisplay ||
                (Array.isArray(imgDisplay)
                  ? (terminalMode && imgDisplay.includes('borne'))
                  : (imgDisplay === 'both' || (terminalMode && imgDisplay === 'borne')))
              );
              
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className="p-3 md:p-6 rounded-xl border-2 hover:border-orange-500 transition-all bg-white shadow-sm hover:shadow-lg flex flex-col items-center gap-2 md:gap-4"
                  style={{ borderColor: category.color || '#ccc' }}
                >
                  {shouldShowImage && (
                    <div className="w-20 h-20 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-white flex items-center justify-center">
                      <img 
                        src={category.image_url} 
                        alt={category.nom}
                        className="w-full h-full object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  )}
                  <h3 className="font-bold text-base md:text-xl">{category.nom}</h3>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${terminalMode ? 'xl:grid-cols-5 2xl:grid-cols-6' : ''} gap-3 md:gap-4`}>
            {filteredProducts.map(product => {
              const imgDisplayP = product.image_display;
              const shouldShowImage = product.image_url && (
                !imgDisplayP ||
                (Array.isArray(imgDisplayP)
                  ? (terminalMode && imgDisplayP.includes('borne'))
                  : (imgDisplayP === 'both' || (terminalMode && imgDisplayP === 'borne')))
              );
              
              return (
                <button
                  key={product.id}
                  onClick={() => onAddToCart({ ...product, isMenu: false })}
                  className="p-4 rounded-xl border-2 hover:border-orange-500 transition-all bg-white shadow-sm hover:shadow-lg text-left"
                >
                  {shouldShowImage && (
                    <div className="w-full h-24 md:h-32 bg-white rounded-lg mb-2 md:mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={product.image_url}
                        alt={product.nom}
                        className="w-full h-full object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  )}
                <h3 className="font-bold text-sm md:text-lg mb-1">{product.nom}</h3>
                {product.description && (
                  <p className="text-xs md:text-sm text-gray-600 mb-1 md:mb-2 line-clamp-2">
                    {product.description}
                  </p>
                )}
                {getProductPrice(product) > 0 ? (
                  <div className="text-base md:text-xl font-bold text-orange-600">
                    {product.size_prices?.length > 0 && 'À partir de '}
                    {getProductPrice(product).toFixed(2)} €
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-gray-500">
                    Prix à définir
                  </div>
                )}
                </button>
              );
            })}

            {filteredMenus.map(menu => {
              const imgDisplayM = menu.image_display;
              const shouldShowImage = menu.image_url && (
                !imgDisplayM ||
                (Array.isArray(imgDisplayM)
                  ? (terminalMode && imgDisplayM.includes('borne'))
                  : (imgDisplayM === 'both' || (terminalMode && imgDisplayM === 'borne')))
              );
              
              return (
                <button
                  key={menu.id}
                  onClick={() => onAddToCart({ ...menu, isMenu: true })}
                  className="p-4 rounded-xl border-2 hover:border-green-500 transition-all bg-green-50 shadow-sm hover:shadow-lg text-left"
                >
                  {shouldShowImage && (
                    <div className="w-full h-24 md:h-32 bg-white rounded-lg mb-2 md:mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={menu.image_url}
                        alt={menu.nom}
                        className="w-full h-full object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  )}
                <Badge className="mb-1 md:mb-2 bg-green-600 text-xs">Menu</Badge>
                <h3 className="font-bold text-sm md:text-lg mb-1">{menu.nom}</h3>
                {menu.description && (
                  <p className="text-xs md:text-sm text-gray-600 mb-1 md:mb-2 line-clamp-2">
                    {menu.description}
                  </p>
                )}
                <div className="text-base md:text-xl font-bold text-green-600">
                  {menu.prix.toFixed(2)} €
                </div>
                </button>
              );
            })}
          </div>
        )}

        {!shouldShowCategoryHome && filteredProducts.length === 0 && filteredMenus.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
            <p className="text-xl font-semibold">Aucun produit visible</p>
            <p className="mt-2 text-sm">Verifiez les categories, les produits ou les droits publics de la borne.</p>
          </div>
        )}
      </div>
    </div>
  );
}
