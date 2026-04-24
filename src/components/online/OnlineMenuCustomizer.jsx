import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, ChevronRight, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';

// Sous-modal de personnalisation d'un produit du menu
function ProductCustomizerInMenu({ product, step, categories, optionGroups, optionItems, allIngredients, allProductIngredients, primaryColor, onConfirm, onCancel }) {
  const cat = categories.find(c => c.id === product.category_id);
  const managesSizes = !step.taille_fixe && cat?.manages_sizes && cat?.size_template?.length > 0;
  const sizesArray = cat?.size_template || [];

  const [selectedSize, setSelectedSize] = useState(step.taille_fixe || (managesSizes ? sizesArray[0] : null));
  const [selectedOptions, setSelectedOptions] = useState({});
  const [excludedIngredients, setExcludedIngredients] = useState([]);

  const productOptionGroups = useMemo(() =>
    optionGroups
      .filter(g => g.product_id === product.id)
      .map(g => ({ ...g, items: optionItems.filter(i => i.option_group_id === g.id) })),
    [optionGroups, optionItems, product.id]
  );

  const removableIngredients = useMemo(() =>
    allProductIngredients
      .filter(pi => pi.product_id === product.id && pi.retirable)
      .map(pi => allIngredients.find(i => i.id === pi.ingredient_id))
      .filter(Boolean),
    [allProductIngredients, allIngredients, product.id]
  );

  const hasCustomization = managesSizes || productOptionGroups.length > 0 || removableIngredients.length > 0;

  // Si aucune personnalisation possible, confirmer directement
  React.useEffect(() => {
    if (!hasCustomization) {
      onConfirm({ product, selectedSize: step.taille_fixe || null, selectedOptions: [], excludedIngredients: [] });
    }
  }, []);

  if (!hasCustomization) return null;

  const handleOptionChange = (groupId, itemId, isMultiple, maxSelections) => {
    if (isMultiple) {
      setSelectedOptions(prev => {
        const current = prev[groupId] || [];
        const newSel = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId];
        if (maxSelections && newSel.length > maxSelections) return prev;
        return { ...prev, [groupId]: newSel };
      });
    } else {
      setSelectedOptions(prev => ({ ...prev, [groupId]: [itemId] }));
    }
  };

  const getGroupSelectionError = (group) => {
    const count = (selectedOptions[group.id] || []).length;
    const min = group.required ? (parseInt(group.min_selections || 1, 10) || 1) : (parseInt(group.min_selections || 0, 10) || 0);
    const max = group.selection_type === 'single' ? 1 : (parseInt(group.max_selections || 0, 10) || 0);
    if (min > 0 && count < min) {
      return min === max
        ? `Choisissez exactement ${min} option${min > 1 ? 's' : ''} dans "${group.nom}".`
        : `Choisissez au moins ${min} option${min > 1 ? 's' : ''} dans "${group.nom}".`;
    }
    if (max > 0 && count > max) {
      return `Choisissez au maximum ${max} option${max > 1 ? 's' : ''} dans "${group.nom}".`;
    }
    return null;
  };

  const handleConfirm = () => {
    const validationError = productOptionGroups.map(getGroupSelectionError).find(Boolean);
    if (validationError) {
      alert(validationError);
      return;
    }

    const selectedOptionsDetails = [];
    productOptionGroups.forEach(group => {
      (selectedOptions[group.id] || []).forEach(itemId => {
        const item = group.items.find(i => i.id === itemId);
        if (!item) return;
        let surcharge = 0;
        if (group.manages_sizes && selectedSize && item.size_surcharges) {
          const key = Object.keys(item.size_surcharges).find(k => k.toLowerCase() === selectedSize.toLowerCase());
          if (key) surcharge = parseFloat(item.size_surcharges[key]) || 0;
        } else {
          surcharge = parseFloat(item.price_surcharge) || 0;
        }
        selectedOptionsDetails.push({ id: item.id, nom: item.nom, price_surcharge: surcharge });
      });
    });
    onConfirm({
      product,
      selectedSize,
      selectedOptions: selectedOptionsDetails,
      excludedIngredients: excludedIngredients.map(id => ({
        id,
        nom: removableIngredients.find(i => i.id === id)?.nom || 'Ingrédient'
      }))
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Back header */}
      <div className="p-4 bg-blue-50 border-b flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-blue-100">
          <ArrowLeft className="w-5 h-5 text-blue-700" />
        </button>
        <div>
          <p className="text-xs text-blue-500 font-semibold uppercase">Personnaliser</p>
          <p className="font-bold text-blue-900">{product.nom}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Taille */}
        {managesSizes && (
          <div className="bg-blue-50 rounded-2xl p-4">
            <h3 className="font-bold text-blue-900 mb-3">📏 Taille <span className="text-red-500">*</span></h3>
            <div className="grid grid-cols-2 gap-2">
              {sizesArray.map(size => (
                <button key={size} onClick={() => setSelectedSize(size)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{ borderColor: selectedSize === size ? primaryColor : '#bfdbfe', backgroundColor: selectedSize === size ? primaryColor + '15' : 'white' }}>
                  <div className="font-semibold text-sm">{size}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Taille fixe imposée */}
        {step.taille_fixe && (
          <div className="bg-blue-50 rounded-2xl p-3 flex items-center gap-2">
            <span className="text-blue-700 text-sm font-semibold">📏 Taille imposée : {step.taille_fixe}</span>
          </div>
        )}

        {/* Groupes d'options */}
        {productOptionGroups.map(group => (
          <div key={group.id} className="bg-orange-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-orange-900">
                🍕 {group.nom}
                {group.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                {group.selection_type === 'multiple'
                  ? [
                      group.min_selections || group.required ? `Min ${group.min_selections || 1}` : null,
                      group.max_selections ? `Max ${group.max_selections}` : 'Plusieurs choix'
                    ].filter(Boolean).join(' / ')
                  : '1 choix'}
              </span>
            </div>
            <div className="space-y-2">
              {group.items.map(item => {
                const isSelected = (selectedOptions[group.id] || []).includes(item.id);
                let surcharge = 0;
                if (group.manages_sizes && selectedSize && item.size_surcharges) {
                  const key = Object.keys(item.size_surcharges).find(k => k.toLowerCase() === selectedSize?.toLowerCase());
                  if (key) surcharge = parseFloat(item.size_surcharges[key]) || 0;
                } else {
                  surcharge = parseFloat(item.price_surcharge) || 0;
                }
                const isMaxReached = group.selection_type === 'multiple' && group.max_selections && (selectedOptions[group.id] || []).length >= group.max_selections;
                const isDisabled = !isSelected && isMaxReached;

                return (
                  <button key={item.id} disabled={isDisabled}
                    onClick={() => handleOptionChange(group.id, item.id, group.selection_type === 'multiple', group.max_selections)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{ borderColor: isSelected ? primaryColor : '#fed7aa', backgroundColor: isSelected ? primaryColor + '10' : 'white' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 flex items-center justify-center border-2 flex-shrink-0 ${group.selection_type === 'single' ? 'rounded-full' : 'rounded-md'}`}
                        style={{ borderColor: isSelected ? primaryColor : '#9ca3af', backgroundColor: isSelected ? primaryColor : 'white' }}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-medium text-left text-sm">{item.nom}</span>
                    </div>
                    {surcharge > 0 && <span className="text-sm font-bold text-green-600 flex-shrink-0">+{surcharge.toFixed(2)}€</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Ingrédients retirables */}
        {removableIngredients.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4">
            <h3 className="font-bold text-red-900 mb-3">❌ Retirer des ingrédients</h3>
            <div className="space-y-2">
              {removableIngredients.map(ing => {
                const isExcluded = excludedIngredients.includes(ing.id);
                return (
                  <button key={ing.id}
                    onClick={() => setExcludedIngredients(prev => isExcluded ? prev.filter(id => id !== ing.id) : [...prev, ing.id])}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer"
                    style={{ borderColor: isExcluded ? '#f87171' : '#fecaca', backgroundColor: isExcluded ? '#fef2f2' : 'white' }}>
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: isExcluded ? '#ef4444' : '#9ca3af', backgroundColor: isExcluded ? '#ef4444' : 'white' }}>
                      {isExcluded && <X className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm font-medium ${isExcluded ? 'line-through text-gray-400' : 'text-red-900'}`}>
                      Sans {ing.nom}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bouton valider la personnalisation */}
      <div className="p-4 border-t bg-white sticky bottom-0">
        <button onClick={handleConfirm}
          className="w-full py-3 rounded-xl text-white font-bold text-base shadow-lg"
          style={{ backgroundColor: primaryColor }}>
          ✅ Valider ce choix
        </button>
      </div>
    </div>
  );
}

export default function OnlineMenuCustomizer({ menu, products, categories, optionGroups, optionItems, allIngredients, allProductIngredients, primaryColor = '#f97316', onConfirm, onCancel }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState({});
  // Personnalisation en cours : { stepId, product } ou null
  const [customizing, setCustomizing] = useState(null);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu-items-online', menu.id],
    queryFn: () => appClient.entities.MenuFormulaItem.filter({ menu_formula_id: menu.id }),
  });

  const steps = useMemo(() => {
    return menuItems.map(item => {
      const stepProducts = (item.produits_inclus || [])
        .map(pid => products.find(p => p.id === pid))
        .filter(Boolean)
        .filter(p => p.disponible !== false);
      const category = categories.find(c => c.id === item.category_id);
      return { ...item, products: stepProducts, category };
    });
  }, [menuItems, products, categories]);

  const currentStep = steps[currentStepIndex];
  const selectionsForCurrentStep = selectedProducts[currentStep?.id] || [];
  const remainingForCurrentStep = (currentStep?.quantite || 1) - selectionsForCurrentStep.length;
  const isCurrentStepComplete = remainingForCurrentStep <= 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isMenuComplete = steps.every(step => (selectedProducts[step.id] || []).length >= step.quantite);

  const handleSelectProduct = (product) => {
    const step = currentStep;
    if (!step || selectionsForCurrentStep.length >= step.quantite) return;

    // Vérifier si ce produit a des personnalisations
    const cat = categories.find(c => c.id === product.category_id);
    const managesSizes = !step.taille_fixe && cat?.manages_sizes && cat?.size_template?.length > 0;
    const hasOptions = optionGroups.some(g => g.product_id === product.id);
    const hasRemovable = allProductIngredients.some(pi => pi.product_id === product.id && pi.retirable);

    if (managesSizes || hasOptions || hasRemovable) {
      // Ouvrir la personnalisation
      setCustomizing({ stepId: step.id, product });
    } else {
      // Ajouter directement
      addProductToStep(step.id, {
        product,
        selectedSize: step.taille_fixe || null,
        selectedOptions: [],
        excludedIngredients: []
      });
    }
  };

  const handleCustomizationConfirm = (entry) => {
    if (!customizing) return;
    addProductToStep(customizing.stepId, entry);
    setCustomizing(null);
  };

  const addProductToStep = (stepId, entry) => {
    setSelectedProducts(prev => ({
      ...prev,
      [stepId]: [...(prev[stepId] || []), entry]
    }));
  };

  const removeProductFromStep = (stepId, index) => {
    setSelectedProducts(prev => ({
      ...prev,
      [stepId]: (prev[stepId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleNext = () => {
    if (isLastStep) handleConfirmMenu();
    else setCurrentStepIndex(i => i + 1);
  };

  const handleConfirmMenu = () => {
    const menuDetails = [];
    steps.forEach(step => {
      (selectedProducts[step.id] || []).forEach(entry => {
        menuDetails.push({
          product: entry.product,
          selectedSize: entry.selectedSize,
          selectedOptions: entry.selectedOptions,
          excludedIngredients: entry.excludedIngredients,
          notes: '',
          finalPrice: 0,
          isFromMenu: true
        });
      });
    });
    onConfirm({ menu, menuDetails, price: menu.prix });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: primaryColor }} />
          <p className="text-gray-600">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <p className="text-gray-500 mb-4">Ce menu ne contient pas d'étapes configurées.</p>
          <button onClick={onCancel} className="px-6 py-2 rounded-xl border">Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Menu</span>
                <span className="font-bold text-lg">{menu.nom}</span>
              </div>
              <p className="text-xl font-extrabold" style={{ color: primaryColor }}>{menu.prix?.toFixed(2)}€</p>
            </div>
            <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress steps */}
          <div className="flex gap-1.5 mt-3">
            {steps.map((step, i) => {
              const done = (selectedProducts[step.id] || []).length >= step.quantite;
              const active = i === currentStepIndex;
              return (
                <button key={step.id} onClick={() => !customizing && setCurrentStepIndex(i)}
                  className="flex-1 h-1.5 rounded-full transition-all"
                  style={{ backgroundColor: done ? '#22c55e' : active ? primaryColor : '#e5e7eb' }}
                />
              );
            })}
          </div>
        </div>

        {/* Si on est en mode personnalisation d'un produit */}
        {customizing ? (
          <ProductCustomizerInMenu
            product={customizing.product}
            step={steps.find(s => s.id === customizing.stepId)}
            categories={categories}
            optionGroups={optionGroups}
            optionItems={optionItems}
            allIngredients={allIngredients}
            allProductIngredients={allProductIngredients}
            primaryColor={primaryColor}
            onConfirm={handleCustomizationConfirm}
            onCancel={() => setCustomizing(null)}
          />
        ) : (
          <>
            {/* Current step */}
            {currentStep && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{currentStep.nom_affichage}</h3>
                      <p className="text-sm text-gray-500">
                        {remainingForCurrentStep > 0
                          ? `Choisissez encore ${remainingForCurrentStep} article${remainingForCurrentStep > 1 ? 's' : ''}`
                          : '✅ Sélection complète'}
                        {currentStep.taille_fixe && ` · Taille : ${currentStep.taille_fixe}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: primaryColor + '20', color: primaryColor }}>
                      {selectionsForCurrentStep.length}/{currentStep.quantite}
                    </span>
                  </div>

                  {/* Selected products chips */}
                  {selectionsForCurrentStep.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectionsForCurrentStep.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white border border-green-200 rounded-full px-3 py-1 text-sm">
                          <span className="text-green-700 font-medium">
                            {entry.product.nom}
                            {entry.selectedSize ? ` (${entry.selectedSize})` : ''}
                            {entry.selectedOptions?.length > 0 ? ` + ${entry.selectedOptions.map(o => o.nom).join(', ')}` : ''}
                            {entry.excludedIngredients?.length > 0 ? ` - sans ${entry.excludedIngredients.map(o => o.nom).join(', ')}` : ''}
                          </span>
                          <button onClick={() => removeProductFromStep(currentStep.id, idx)} className="text-gray-400 hover:text-red-500 ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product grid */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  {currentStep.products.map(product => {
                    const alreadySelected = selectionsForCurrentStep.filter(e => e.product.id === product.id).length;
                    const isDisabled = remainingForCurrentStep <= 0 && alreadySelected === 0;

                    return (
                      <button key={product.id}
                        onClick={() => !isDisabled && handleSelectProduct(product)}
                        disabled={isDisabled}
                        className={`bg-white rounded-xl border-2 overflow-hidden text-left transition-all ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}`}
                        style={{ borderColor: alreadySelected > 0 ? '#22c55e' : '#e5e7eb' }}>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.nom} className="w-full h-24 object-contain bg-gray-50" style={{ mixBlendMode: 'multiply' }} />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center text-3xl" style={{ backgroundColor: product.color || '#f3f4f6' }}>
                            🍕
                          </div>
                        )}
                        <div className="p-2">
                          <p className="font-semibold text-sm text-gray-900 line-clamp-2">{product.nom}</p>
                          {alreadySelected > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">
                                {alreadySelected > 1 ? `×${alreadySelected}` : 'Sélectionné'}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t flex-shrink-0 bg-white rounded-b-3xl sm:rounded-b-2xl">
              <div className="flex gap-3">
                {currentStepIndex > 0 && (
                  <button onClick={() => setCurrentStepIndex(i => i - 1)}
                    className="px-4 py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:bg-gray-50">
                    Retour
                  </button>
                )}
                <button onClick={handleNext} disabled={!isCurrentStepComplete}
                  className="flex-1 py-3 rounded-xl text-white font-bold text-base shadow-lg transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: isMenuComplete && isLastStep ? '#22c55e' : primaryColor }}>
                  {isLastStep
                    ? (isMenuComplete ? `✅ Ajouter au panier · ${menu.prix?.toFixed(2)}€` : 'Compléter le menu')
                    : <><span>Étape suivante</span><ChevronRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

