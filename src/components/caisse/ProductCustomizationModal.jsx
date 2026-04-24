import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Search } from "lucide-react";

export default function ProductCustomizationModal({ 
  product, 
  category,
  onConfirm, 
  onCancel, 
  fixedSize,
  optionGroups: allOptionGroups,
  optionItems: allOptionItems,
  allIngredients,
  allProductIngredients,
  orderType = 'sur_place',
  profile = null,
  initialSelectedOptions = [],
  initialExcludedIngredients = [],
  initialNotes = '',
  initialQuantity = 1,
}) {
  const [quantity, setQuantity] = useState(initialQuantity || 1);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState(() => {
    // Reconstituer l'état des options depuis le tableau plat initialSelectedOptions
    const state = {};
    (initialSelectedOptions || []).forEach(opt => {
      // Trouver le groupe de cette option
      if (!allOptionGroups || !allOptionItems) return;
      const group = allOptionGroups.find(g => (allOptionItems || []).some(i => i.id === opt.id && i.option_group_id === g.id));
      if (!group) return;
      if (group.selection_type === 'multiple') {
        if (!state[group.id]) state[group.id] = {};
        state[group.id][opt.id] = (state[group.id][opt.id] || 0) + 1;
      } else {
        state[group.id] = opt.id;
      }
    });
    return state;
  });
  const [excludedIngredients, setExcludedIngredients] = useState(
    (initialExcludedIngredients || []).map(e => e.id)
  );
  const [notes, setNotes] = useState(initialNotes || "");
  const [searchTerms, setSearchTerms] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Ouvrir automatiquement les groupes qui ont des options déjà sélectionnées
    const state = {};
    (initialSelectedOptions || []).forEach(opt => {
      if (!allOptionGroups || !allOptionItems) return;
      const group = allOptionGroups.find(g => (allOptionItems || []).some(i => i.id === opt.id && i.option_group_id === g.id));
      if (group) state[group.id] = true;
    });
    return state;
  });

  // CORRECTION : Plus de chargement asynchrone, la catégorie est toujours fournie
  const effectiveCategory = category;
  const managesSizes = effectiveCategory?.manages_sizes && effectiveCategory?.size_template?.length > 0;
  const sizesArray = effectiveCategory?.size_template || [];

  useEffect(() => {
    if (fixedSize) {
      setSelectedSize(fixedSize);
    } else if (managesSizes && sizesArray.length > 0 && !selectedSize) {
      setSelectedSize(sizesArray[0]);
    }
  }, [managesSizes, sizesArray, selectedSize, fixedSize]);

  const productOptionGroups = useMemo(() => {
    if (!allOptionGroups || !product?.id) return [];
    
    const groups = allOptionGroups.filter(g => g.product_id === product.id);
    console.log('🔍 Groupes bruts trouvés:', groups);
    
    const groupsWithItems = groups.map(group => {
      const items = (allOptionItems || []).filter(item => item.option_group_id === group.id);
      console.log(`  ➜ Groupe "${group.nom}" (${group.id}):`, items.length, 'items', items);
      return {
        ...group,
        items
      };
    });
    
    console.log('📦 Groupes finaux avec items:', groupsWithItems);
    return groupsWithItems;
  }, [allOptionGroups, allOptionItems, product?.id]);

  const removableIngredients = useMemo(() => {
    if (!allProductIngredients || !allIngredients || !product?.id) return [];
    
    console.log('🔍 Tous les ProductIngredients:', allProductIngredients);
    console.log('🔍 Tous les Ingredients:', allIngredients);
    console.log('🔍 Product ID:', product.id);
    
    const productIngs = allProductIngredients.filter(
      pi => pi.product_id === product.id && pi.retirable
    );
    
    console.log('🔍 ProductIngredients filtrés (retirable):', productIngs);
    
    const ingredients = productIngs
      .map(pi => {
        const ing = allIngredients.find(ing => ing.id === pi.ingredient_id);
        console.log(`  ➜ Mapping ingredient_id ${pi.ingredient_id}:`, ing);
        return ing;
      })
      .filter(Boolean);
    
    console.log('📦 Ingrédients retirables finaux:', ingredients);
    return ingredients;
  }, [allProductIngredients, allIngredients, product?.id]);

  const handleOptionChange = (groupId, itemId) => {
    // Pour les groupes single: toggle (recliquer déselectionne)
    setSelectedOptions(prev => ({
      ...prev,
      [groupId]: prev[groupId] === itemId ? undefined : itemId
    }));
  };

  const handleMultipleQuantityChange = (groupId, itemId, delta, maxSelections) => {
    setSelectedOptions(prev => {
      const groupQtys = prev[groupId] || {};
      const currentQty = groupQtys[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);

      // Vérifier la limite max_selections (somme de toutes les qtés)
      if (delta > 0 && maxSelections) {
        const totalSelected = Object.values(groupQtys).reduce((s, q) => s + q, 0);
        if (totalSelected >= maxSelections) return prev;
      }

      const newGroupQtys = { ...groupQtys, [itemId]: newQty };
      if (newQty === 0) delete newGroupQtys[itemId];
      return { ...prev, [groupId]: newGroupQtys };
    });
  };

  const getGroupSelectionCount = (group) => {
    if (group.selection_type === 'multiple') {
      return Object.values(selectedOptions[group.id] || {}).reduce((sum, qty) => sum + qty, 0);
    }
    return selectedOptions[group.id] ? 1 : 0;
  };

  const getGroupSelectionError = (group) => {
    const count = getGroupSelectionCount(group);
    const min = group.required ? (parseInt(group.min_selections || 1, 10) || 1) : (parseInt(group.min_selections || 0, 10) || 0);
    const max = group.selection_type === 'single' ? 1 : (parseInt(group.max_selections || 0, 10) || 0);

    if (min > 0 && count < min) {
      return min === max
        ? `Vous devez choisir exactement ${min} option${min > 1 ? 's' : ''} dans "${group.nom}".`
        : `Vous devez choisir au moins ${min} option${min > 1 ? 's' : ''} dans "${group.nom}".`;
    }
    if (max > 0 && count > max) {
      return `Vous pouvez choisir au maximum ${max} option${max > 1 ? 's' : ''} dans "${group.nom}".`;
    }
    return null;
  };

  const handleIngredientExclusion = (ingredientId) => {
    setExcludedIngredients(prev =>
      prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const calculatePrice = useMemo(() => {
    let basePrice = 0;
    const prixDifferencies = profile?.prix_differencies_par_mode === true;

    if (managesSizes && selectedSize) {
      // Produit avec tailles - vérifier les prix différenciés par mode
      if (prixDifferencies && product.size_prix_par_mode?.length > 0) {
        const sizeMode = product.size_prix_par_mode.find(s => s.size === selectedSize);
        if (sizeMode && sizeMode[orderType] > 0) {
          basePrice = sizeMode[orderType];
        } else {
          const sizePrice = product.size_prices?.find(sp => sp.size === selectedSize);
          basePrice = sizePrice?.price || 0;
        }
      } else {
        const sizePrice = product.size_prices?.find(sp => sp.size === selectedSize);
        basePrice = sizePrice?.price || 0;
      }
    } else {
      // Produit sans taille - vérifier les prix différenciés par mode
      if (prixDifferencies && product.prix_par_mode) {
        const modePrice = product.prix_par_mode[orderType];
        if (modePrice > 0) {
          basePrice = modePrice;
        } else {
          basePrice = product.base_price || product.prix || 0;
        }
      } else {
        basePrice = product.base_price || product.prix || 0;
      }
    }

    let optionsTotal = 0;
    productOptionGroups.forEach(group => {
      if (group.selection_type === 'multiple') {
        const groupQtys = selectedOptions[group.id] || {};
        Object.entries(groupQtys).forEach(([itemId, qty]) => {
          const item = group.items.find(i => i.id === itemId);
          if (item && qty > 0) {
            let surcharge = 0;
            if (group.manages_sizes && selectedSize && item.size_surcharges) {
              const matchingKey = Object.keys(item.size_surcharges).find(
                key => key.toLowerCase() === selectedSize.toLowerCase()
              );
              if (matchingKey) surcharge = parseFloat(item.size_surcharges[matchingKey]) || 0;
            } else if (item.price_surcharge !== undefined && item.price_surcharge !== null) {
              surcharge = parseFloat(item.price_surcharge) || 0;
            }
            optionsTotal += surcharge * qty;
          }
        });
      } else {
        const itemId = selectedOptions[group.id];
        if (itemId) {
          const item = group.items.find(i => i.id === itemId);
          if (item) {
            let surcharge = 0;
            if (group.manages_sizes && selectedSize && item.size_surcharges) {
              const matchingKey = Object.keys(item.size_surcharges).find(
                key => key.toLowerCase() === selectedSize.toLowerCase()
              );
              if (matchingKey) surcharge = parseFloat(item.size_surcharges[matchingKey]) || 0;
            } else if (item.price_surcharge !== undefined && item.price_surcharge !== null) {
              surcharge = parseFloat(item.price_surcharge) || 0;
            }
            optionsTotal += surcharge;
          }
        }
      }
    });

    const totalPrice = basePrice + optionsTotal;
    
    return totalPrice * quantity;
  }, [product, selectedSize, selectedOptions, productOptionGroups, quantity, managesSizes, profile, orderType]);

  const handleConfirm = () => {
    if (!product || !product.id) {
      console.error("Product invalide:", product);
      if (onCancel) onCancel();
      return;
    }

    const validationError = productOptionGroups.map(getGroupSelectionError).find(Boolean);
    if (validationError) {
      alert(validationError);
      return;
    }

    const selectedOptionsDetails = [];
    productOptionGroups.forEach(group => {
      if (group.selection_type === 'multiple') {
        const groupQtys = selectedOptions[group.id] || {};
        Object.entries(groupQtys).forEach(([itemId, qty]) => {
          const item = group.items.find(i => i.id === itemId);
          if (item && qty > 0) {
            let priceSurcharge = 0;
            if (group.manages_sizes && selectedSize && item.size_surcharges) {
              const matchingKey = Object.keys(item.size_surcharges).find(
                key => key.toLowerCase() === selectedSize.toLowerCase()
              );
              if (matchingKey) priceSurcharge = parseFloat(item.size_surcharges[matchingKey]) || 0;
            } else {
              priceSurcharge = parseFloat(item.price_surcharge) || 0;
            }
            // Ajouter autant de fois que la quantité choisie
            for (let i = 0; i < qty; i++) {
              selectedOptionsDetails.push({ id: item.id, nom: item.nom, price_surcharge: priceSurcharge });
            }
          }
        });
      } else {
        const itemId = selectedOptions[group.id];
        const item = group.items.find(i => i.id === itemId);
        if (item) {
          let priceSurcharge = 0;
          if (group.manages_sizes && selectedSize && item.size_surcharges) {
            const matchingKey = Object.keys(item.size_surcharges).find(
              key => key.toLowerCase() === selectedSize.toLowerCase()
            );
            if (matchingKey) priceSurcharge = parseFloat(item.size_surcharges[matchingKey]) || 0;
          } else {
            priceSurcharge = parseFloat(item.price_surcharge) || 0;
          }
          selectedOptionsDetails.push({ id: item.id, nom: item.nom, price_surcharge: priceSurcharge });
        }
      }
    });

    const excludedIngredientsDetails = excludedIngredients.map(id => {
      const ingredient = removableIngredients.find(ing => ing.id === id);
      return { id, nom: ingredient?.nom || "Ingrédient" };
    });

    const pricePerUnit = calculatePrice / quantity;

    onConfirm({
      product: product,
      quantity: quantity,
      selectedSize: managesSizes ? selectedSize : null,
      selectedOptions: selectedOptionsDetails,
      excludedIngredients: excludedIngredientsDetails,
      notes: notes,
      finalPrice: pricePerUnit
    });
  };

  // CORRECTION : Plus d'état de chargement nécessaire
  if (!effectiveCategory) {
    return (
      <Dialog open={true} onOpenChange={onCancel}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Erreur</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-gray-500">
            Impossible de charger les informations du produit.
          </div>
          <DialogFooter>
            <Button onClick={onCancel}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Personnaliser: {product.nom}</span>
            <Badge variant="outline" className="text-lg font-bold text-orange-600">
              {(calculatePrice).toFixed(2)}€
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {managesSizes && sizesArray.length > 0 && !fixedSize && (
            <div className="space-y-3 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
              <Label className="text-base font-semibold text-blue-900">
                📏 Taille *
              </Label>
              <RadioGroup value={selectedSize || ""} onValueChange={setSelectedSize}>
                <div className="grid grid-cols-3 gap-3">
                  {sizesArray.map(size => {
                    // Calculer le prix en fonction du mode de commande et prix différenciés
                    const prixDifferencies = profile?.prix_differencies_par_mode === true;
                    let displayPrice = 0;
                    
                    if (prixDifferencies && product.size_prix_par_mode?.length > 0) {
                      const sizeMode = product.size_prix_par_mode.find(s => s.size === size);
                      if (sizeMode && sizeMode[orderType] > 0) {
                        displayPrice = sizeMode[orderType];
                      } else {
                        const sizePrice = product.size_prices?.find(sp => sp.size === size);
                        displayPrice = sizePrice?.price || 0;
                      }
                    } else {
                      const sizePrice = product.size_prices?.find(sp => sp.size === size);
                      displayPrice = sizePrice?.price || 0;
                    }
                    
                    return (
                      <div key={size} className="flex items-center space-x-2 border-2 border-blue-300 bg-white rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                           onClick={() => setSelectedSize(size)}>
                        <RadioGroupItem value={size} id={`size-${size}`} />
                        <Label htmlFor={`size-${size}`} className="cursor-pointer flex-1">
                          <div className="font-medium text-blue-900">{size}</div>
                          <div className="text-sm text-blue-600 font-semibold">{displayPrice.toFixed(2)}€</div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>
          )}

          {fixedSize && (
            <div className="p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white text-base px-3 py-1">
                  📏 Taille: {fixedSize}
                </Badge>
                <span className="text-sm text-blue-700">
                  (imposée par le menu)
                </span>
              </div>
            </div>
          )}

          {removableIngredients.length > 0 && (
            <div className="space-y-3 p-4 rounded-lg bg-red-50 border-2 border-red-200">
              <Label className="text-base font-semibold text-red-900">
                ❌ Retirer des ingrédients (optionnel)
              </Label>
              {removableIngredients.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Rechercher un ingrédient..."
                    value={searchTerms['ingredients'] || ''}
                    onChange={(e) => setSearchTerms({...searchTerms, ingredients: e.target.value})}
                    className="pl-10 bg-white border-red-300"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {removableIngredients.filter(ingredient => 
                  !searchTerms['ingredients'] || 
                  ingredient.nom.toLowerCase().includes(searchTerms['ingredients'].toLowerCase())
                ).map(ingredient => {
                  const isExcluded = excludedIngredients.includes(ingredient.id);
                  return (
                    <button
                      key={ingredient.id}
                      type="button"
                      onClick={() => handleIngredientExclusion(ingredient.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        isExcluded
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-white border-red-200 text-red-800 hover:border-red-400'
                      }`}
                    >
                      <span className="text-base">{isExcluded ? '✗' : '○'}</span>
                      <span className="truncate">Sans {ingredient.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {productOptionGroups.map(group => {
            const filteredItems = (group.items || [])
              .filter(item =>
                !searchTerms[group.id] ||
                item.nom.toLowerCase().includes(searchTerms[group.id].toLowerCase())
              )
              .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

            const groupSelection = selectedOptions[group.id];
            let selectionSummary = '';
            if (group.selection_type === 'single' && groupSelection) {
              const item = group.items.find(i => i.id === groupSelection);
              selectionSummary = item ? item.nom : '';
            } else if (group.selection_type === 'multiple' && groupSelection) {
              const count = Object.values(groupSelection).reduce((s, q) => s + q, 0);
              if (count > 0) selectionSummary = `${count} sélectionné${count > 1 ? 's' : ''}`;
            }

            const isExpanded = expandedGroups[group.id] === true;

            return (
              <div key={group.id} className="rounded-lg border-2 border-orange-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !isExpanded }))}
                  className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-orange-900">
                      🍕 {group.nom}
                      {group.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                    {selectionSummary && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                        {selectionSummary}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {group.selection_type === 'multiple' && group.max_selections && (
                      <Badge variant="secondary" className="bg-orange-200 text-orange-800">
                        Max {group.max_selections}
                      </Badge>
                    )}
                    {(group.required || group.min_selections) && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        Min {group.min_selections || 1}
                      </Badge>
                    )}
                    <span className="text-orange-600 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-white border-t border-orange-200 space-y-3">
                    {group.items.length > 5 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Rechercher une option..."
                          value={searchTerms[group.id] || ''}
                          onChange={(e) => setSearchTerms({...searchTerms, [group.id]: e.target.value})}
                          className="pl-10 bg-white border-orange-300"
                        />
                      </div>
                    )}

                    {group.selection_type === 'single' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map(item => {
                          let surchargeValue = 0;
                          if (group.manages_sizes && selectedSize && item.size_surcharges) {
                            const matchingKey = Object.keys(item.size_surcharges).find(
                              key => key.toLowerCase() === selectedSize.toLowerCase()
                            );
                            if (matchingKey) surchargeValue = parseFloat(item.size_surcharges[matchingKey]) || 0;
                          } else if (item.price_surcharge !== undefined && item.price_surcharge !== null) {
                            surchargeValue = parseFloat(item.price_surcharge) || 0;
                          }
                          const isSelected = selectedOptions[group.id] === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleOptionChange(group.id, item.id)}
                              className={`flex flex-col items-center justify-center px-3 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                                isSelected
                                  ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                                  : 'bg-white border-orange-200 text-orange-900 hover:border-orange-400'
                              }`}
                            >
                              <span className="font-semibold text-center">{item.nom}</span>
                              {surchargeValue > 0 && (
                                <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-orange-100' : 'text-green-600'}`}>
                                  +{surchargeValue.toFixed(2)}€
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map(item => {
                          let surchargeValue = 0;
                          if (group.manages_sizes && selectedSize && item.size_surcharges) {
                            const matchingKey = Object.keys(item.size_surcharges).find(
                              key => key.toLowerCase() === selectedSize.toLowerCase()
                            );
                            if (matchingKey) surchargeValue = parseFloat(item.size_surcharges[matchingKey]) || 0;
                          } else if (item.price_surcharge !== undefined && item.price_surcharge !== null) {
                            surchargeValue = parseFloat(item.price_surcharge) || 0;
                          }

                          const groupQtys = selectedOptions[group.id] || {};
                          const itemQty = groupQtys[item.id] || 0;
                          const totalSelected = Object.values(groupQtys).reduce((s, q) => s + q, 0);
                          const isMaxReached = group.max_selections && totalSelected >= group.max_selections;

                          return (
                            <div key={item.id} className={`relative flex flex-col items-center justify-center px-2 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                              itemQty > 0
                                ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                                : 'bg-white border-orange-200 text-orange-900'
                            }`}>
                              {itemQty > 0 && (
                                <span className="absolute -top-2 -right-2 bg-white text-orange-600 border-2 border-orange-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{itemQty}</span>
                              )}
                              <span className="font-semibold text-center text-xs leading-tight">{item.nom}</span>
                              {surchargeValue > 0 && (
                                <span className={`text-xs font-bold mt-0.5 ${itemQty > 0 ? 'text-orange-100' : 'text-green-600'}`}>+{surchargeValue.toFixed(2)}€</span>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {itemQty > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMultipleQuantityChange(group.id, item.id, -1, group.max_selections)}
                                    className="w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center font-bold"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => !isMaxReached && handleMultipleQuantityChange(group.id, item.id, 1, group.max_selections)}
                                  disabled={isMaxReached && itemQty === 0}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                    itemQty > 0 ? 'bg-white/30 hover:bg-white/50' : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                  } disabled:opacity-40`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="space-y-2 p-4 rounded-lg bg-gray-50 border-2 border-gray-200">
            <Label htmlFor="notes" className="text-base font-semibold text-gray-900">
              📝 Notes spéciales (optionnel)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Bien cuit, sans oignons, etc."
              rows={3}
              className="bg-white border-2 border-gray-300"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-50 border-2 border-indigo-200">
            <Label className="text-base font-semibold text-indigo-900">🔢 Quantité</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="border-2 border-indigo-300 hover:bg-indigo-100"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xl font-bold w-12 text-center text-indigo-900">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                className="border-2 border-indigo-300 hover:bg-indigo-100"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center border-t pt-4">
          <Button variant="outline" onClick={onCancel} className="border-2">
            Annuler
          </Button>
          <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg">
            Ajouter pour {(calculatePrice).toFixed(2)}€
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

