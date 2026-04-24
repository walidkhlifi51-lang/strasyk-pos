import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Settings, ShoppingCart, Search, X as XIcon } from 'lucide-react';
import ProductCustomizationModal from './ProductCustomizationModal';

export default function MenuCustomizationModal({ 
  menu, 
  menuItems, 
  products, 
  categories,
  optionGroups, 
  optionItems, 
  allIngredients, 
  allProductIngredients,
  onConfirm, 
  onCancel 
}) {
  const [selectedProducts, setSelectedProducts] = useState({});
  const [showProductCustomization, setShowProductCustomization] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [customizingMenuItemId, setCustomizingMenuItemId] = useState(null);
  const [searchTerms, setSearchTerms] = useState({});

  const menuSteps = useMemo(() => {
    return (menuItems || [])
      .filter(item => item && item.menu_formula_id === menu.id)
      .map(item => {
        const stepProducts = (products || []).filter(p => p && (item.produits_inclus || []).includes(p.id) && p.disponible !== false);
        return { ...item, products: stepProducts };
      });
  }, [menu.id, menuItems, products]);

  const isMenuComplete = useMemo(() => {
    for (const step of menuSteps) {
      const requiredQuantity = step.quantite;
      const selectedQuantity = selectedProducts[step.id]?.length || 0;
      if (selectedQuantity < requiredQuantity) {
        return false;
      }
    }
    return true;
  }, [menuSteps, selectedProducts]);

  const handleProductSelect = (menuItemId, product) => {
    const menuItem = menuSteps.find(mi => mi.id === menuItemId);
    if (!menuItem) return;

    const currentSelections = selectedProducts[menuItemId] || [];
    
    if (currentSelections.length >= menuItem.quantite) {
      return;
    }

    // CORRECTION : Trouver la catégorie du produit
    const productCategory = (categories || []).find(c => c.id === product.category_id);

    const hasCustomization = 
      (product.size_prices && product.size_prices.length > 0 && !menuItem.taille_fixe) ||
      (optionGroups || []).some(og => og.product_id === product.id) ||
      (allProductIngredients || []).some(pi => pi.product_id === product.id && pi.retirable);

    if (hasCustomization) {
      setCustomizingProduct({
        ...product,
        fixedSize: menuItem.taille_fixe,
        category: productCategory // AJOUT : Passer la catégorie
      });
      setCustomizingMenuItemId(menuItemId);
      setShowProductCustomization(true);
    } else {
      const productWithDetails = {
        ...product,
        selectedOptions: [],
        excludedIngredients: [],
        notes: '',
        selectedSize: menuItem.taille_fixe || null,
        finalPrice: 0
      };

      setSelectedProducts(prev => ({
        ...prev,
        [menuItemId]: [...(prev[menuItemId] || []), productWithDetails]
      }));
    }
  };

  const handleProductCustomizationConfirm = (customizedProduct) => {
    if (!customizingMenuItemId) return;
    const menuItem = menuSteps.find(mi => mi.id === customizingMenuItemId);

    const productWithDetails = {
      ...customizedProduct.product,
      selectedOptions: customizedProduct.selectedOptions,
      excludedIngredients: customizedProduct.excludedIngredients,
      notes: customizedProduct.notes,
      selectedSize: menuItem.taille_fixe || customizedProduct.selectedSize, 
      finalPrice: 0
    };

    setSelectedProducts(prev => ({
      ...prev,
      [customizingMenuItemId]: [...(prev[customizingMenuItemId] || []), productWithDetails]
    }));

    setShowProductCustomization(false);
    setCustomizingProduct(null);
    setCustomizingMenuItemId(null);
  };

  const handleRemoveProduct = (menuItemId, productIndex) => {
    setSelectedProducts(prev => {
      const newSelections = { ...prev };
      if (newSelections[menuItemId]) {
        newSelections[menuItemId] = newSelections[menuItemId].filter((_, index) => index !== productIndex);
        if (newSelections[menuItemId].length === 0) {
          delete newSelections[menuItemId];
        }
      }
      return newSelections;
    });
  };

  const handleConfirmMenu = () => {
    const menuArticles = [];
    
    for (const [menuItemId, selectedProductsList] of Object.entries(selectedProducts)) {
      selectedProductsList.forEach(selectedProduct => {
        menuArticles.push({
          product: selectedProduct,
          quantity: 1,
          selectedOptions: selectedProduct.selectedOptions,
          excludedIngredients: selectedProduct.excludedIngredients,
          notes: selectedProduct.notes,
          selectedSize: selectedProduct.selectedSize,
          finalPrice: 0,
          isFromMenu: true,
          menuId: menu.id,
          menuName: menu.nom
        });
      });
    }

    onConfirm({
      articles: menuArticles,
      notes: "",
      totalPrice: menu.prix
    });
  };

  return (
    <>
      <Dialog open={true} onOpenChange={() => onCancel()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Personnaliser votre {menu.nom}
              <Badge className="bg-green-100 text-green-800 font-bold">
                {menu.prix?.toFixed(2)}€
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4"> 
            {menu.description && (
              <p className="text-sm text-gray-600">{menu.description}</p>
            )}

            {menuSteps.map(menuItem => {
              const selectedForThisItem = selectedProducts[menuItem.id] || [];
              const remainingSlots = menuItem.quantite - selectedForThisItem.length;

              return (
                <Card key={menuItem.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {menuItem.nom_affichage}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Sélectionnez {remainingSlots > 0 ? remainingSlots : 'tous vos choix'}
                          {menuItem.taille_fixe && ` (taille: ${menuItem.taille_fixe})`}
                        </p>
                      </div>
                      <Badge variant={remainingSlots === 0 ? "default" : "secondary"}>
                        {selectedForThisItem.length} / {menuItem.quantite}
                      </Badge>
                    </div>

                    {selectedForThisItem.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <h4 className="font-medium text-sm">Vos choix :</h4>
                        {selectedForThisItem.map((product, index) => (
                          <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded">
                            <div className="flex-1">
                              <span className="font-medium">{product.nom}</span>
                              {product.selectedSize && (
                                <Badge variant="outline" className="ml-2">{product.selectedSize}</Badge>
                              )}
                              {product.selectedOptions?.length > 0 && (
                                <div className="text-xs text-gray-600 mt-1">
                                  + {product.selectedOptions.map(opt => opt.nom).join(', ')}
                                </div>
                              )}
                              {product.excludedIngredients?.length > 0 && (
                                <div className="text-xs text-red-600 mt-1">
                                  Sans : {product.excludedIngredients.map(ing => ing.nom).join(', ')}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveProduct(menuItem.id, index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {remainingSlots > 0 && (
                      <>
                        {menuItem.products.length > 6 && (
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Rechercher un produit..."
                              value={searchTerms[menuItem.id] || ''}
                              onChange={e => setSearchTerms(prev => ({ ...prev, [menuItem.id]: e.target.value }))}
                              className="pl-9 pr-8"
                            />
                            {searchTerms[menuItem.id] && (
                              <button onClick={() => setSearchTerms(prev => ({ ...prev, [menuItem.id]: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                        <ScrollArea className="h-64">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {menuItem.products
                              .filter(p => !searchTerms[menuItem.id] || p.nom.toLowerCase().includes(searchTerms[menuItem.id].toLowerCase()))
                              .map(product => (
                              <Card
                                key={product.id}
                                className="cursor-pointer hover:shadow-md hover:border-green-400 transition-all border-2 border-transparent"
                                onClick={() => handleProductSelect(menuItem.id, product)}
                              >
                                <CardContent className="p-3">
                                  <h4 className="font-semibold text-sm leading-tight">{product.nom}</h4>
                                  {product.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                      Inclus
                                    </Badge>
                                    {(
                                      (product.size_prices?.length > 0 && !menuItem.taille_fixe) || 
                                      (optionGroups || []).some(og => og.product_id === product.id) ||
                                      (allProductIngredients || []).some(pi => pi.product_id === product.id && pi.retirable)
                                    ) && (
                                      <Settings className="w-3 h-3 text-orange-400" />
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            {menuItem.products.filter(p => !searchTerms[menuItem.id] || p.nom.toLowerCase().includes(searchTerms[menuItem.id].toLowerCase())).length === 0 && (
                              <p className="col-span-3 text-center text-gray-400 py-4 text-sm">Aucun produit trouvé</p>
                            )}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-4 border-t mt-auto"> 
            <div className="text-sm text-gray-600">
              {isMenuComplete ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Menu complet !
                </span>
              ) : (
                <span>Veuillez compléter toutes les sélections</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                Annuler
              </Button>
              <Button 
                onClick={handleConfirmMenu}
                disabled={!isMenuComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                Ajouter au panier - {menu.prix?.toFixed(2)}€
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showProductCustomization && customizingProduct && (
        <ProductCustomizationModal
          product={customizingProduct}
          category={customizingProduct.category} // CORRECTION : Passer la catégorie
          quantity={1}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allIngredients={allIngredients}
          allProductIngredients={allProductIngredients}
          fixedSize={menuSteps.find(mi => mi.id === customizingMenuItemId)?.taille_fixe}
          onConfirm={handleProductCustomizationConfirm}
          onCancel={() => {
            setShowProductCustomization(false);
            setCustomizingProduct(null);
            setCustomizingMenuItemId(null);
          }}
        />
      )}
    </>
  );
}
