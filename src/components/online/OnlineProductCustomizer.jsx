import React, { useState, useMemo } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { getWebPrice } from './OnlineProductBrowser';

export default function OnlineProductCustomizer({
  product,
  category,
  optionGroups = [],
  optionItems = [],
  allIngredients = [],
  allProductIngredients = [],
  flashOffer = null,
  primaryColor = '#f97316',
  onConfirm,
  onCancel
}) {
  const managesSizes = category?.manages_sizes && category?.size_template?.length > 0;
  const sizesArray = category?.size_template || [];

  const [selectedSize, setSelectedSize] = useState(managesSizes ? sizesArray[0] : null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [excludedIngredients, setExcludedIngredients] = useState([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

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

  const unitPrice = useMemo(() => {
    const base = getWebPrice(product, flashOffer, managesSizes ? selectedSize : null);
    let optionsTotal = 0;
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
        optionsTotal += surcharge;
      });
    });
    return base + optionsTotal;
  }, [product, flashOffer, selectedSize, selectedOptions, productOptionGroups, managesSizes]);

  const handleOptionChange = (groupId, itemId, isMultiple, maxSelections) => {
    if (isMultiple) {
      setSelectedOptions(prev => {
        const current = prev[groupId] || [];
        const newSel = current.includes(itemId)
          ? current.filter(id => id !== itemId)
          : [...current, itemId];
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
      quantity,
      selectedSize: managesSizes ? selectedSize : null,
      selectedOptions: selectedOptionsDetails,
      excludedIngredients: excludedIngredients.map(id => ({
        id,
        nom: removableIngredients.find(i => i.id === id)?.nom || 'Ingrédient'
      })),
      notes,
      finalPrice: unitPrice
    });
  };

  const showImage = !!product.image_url;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b flex-shrink-0">
          {showImage && (
            <img src={product.image_url} alt={product.nom}
              className="w-16 h-16 rounded-xl object-contain flex-shrink-0 bg-gray-50"
              style={{ mixBlendMode: 'multiply' }} />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg leading-tight">{product.nom}</h2>
            {product.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Taille */}
          {managesSizes && (
            <div className="bg-blue-50 rounded-2xl p-4">
              <h3 className="font-bold text-blue-900 mb-3">📏 Taille <span className="text-red-500">*</span></h3>
              <div className="grid grid-cols-2 gap-2">
                {sizesArray.map(size => {
                  const price = getWebPrice(product, flashOffer, size);
                  const isSelected = selectedSize === size;
                  return (
                    <button key={size} onClick={() => setSelectedSize(size)}
                      className="p-3 rounded-xl border-2 text-center transition-all"
                      style={{ borderColor: isSelected ? primaryColor : '#bfdbfe', backgroundColor: isSelected ? primaryColor + '15' : 'white' }}>
                      <div className="font-semibold text-sm">{size}</div>
                      <div className="font-bold" style={{ color: primaryColor }}>{price.toFixed(2)}€</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ingrédients retirables — EN PREMIER */}
          {removableIngredients.length > 0 && (
            <div className="bg-red-50 rounded-2xl p-4">
              <h3 className="font-bold text-red-900 mb-3">❌ Retirer des ingrédients</h3>
              <div className="space-y-2">
                {removableIngredients.map(ing => {
                  const isExcluded = excludedIngredients.includes(ing.id);
                  return (
                    <button key={ing.id}
                      onClick={() => setExcludedIngredients(prev =>
                        isExcluded ? prev.filter(id => id !== ing.id) : [...prev, ing.id]
                      )}
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

          {/* Groupes d'options — APRÈS les ingrédients */}
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
                  const isMaxReached = group.selection_type === 'multiple' && group.max_selections &&
                    (selectedOptions[group.id] || []).length >= group.max_selections;
                  const isDisabled = !isSelected && isMaxReached;

                  return (
                    <button key={item.id} disabled={isDisabled}
                      onClick={() => handleOptionChange(group.id, item.id, group.selection_type === 'multiple', group.max_selections)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ borderColor: isSelected ? primaryColor : '#fed7aa', backgroundColor: isSelected ? primaryColor + '10' : 'white' }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 flex items-center justify-center border-2 flex-shrink-0 ${group.selection_type === 'single' ? 'rounded-full' : 'rounded-md'}`}
                          style={{ borderColor: isSelected ? primaryColor : '#9ca3af', backgroundColor: isSelected ? primaryColor : 'white' }}>
                          {isSelected && <div className={`bg-white ${group.selection_type === 'single' ? 'w-2 h-2 rounded-full' : 'w-2.5 h-1.5'}`}
                            style={group.selection_type === 'multiple' ? { borderBottom: '2px solid white', borderRight: '2px solid white', transform: 'rotate(45deg)', marginTop: '-2px' } : {}} />}
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

          {/* Notes */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="font-bold text-gray-700 mb-2">📝 Instructions spéciales</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Bien cuit, sans oignons..."
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-orange-300 bg-white"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0 bg-white rounded-b-3xl sm:rounded-b-2xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-lg">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 rounded-lg text-white flex items-center justify-center shadow-sm"
                style={{ backgroundColor: primaryColor }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl text-white font-bold text-base shadow-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}>
              Ajouter · {(unitPrice * quantity).toFixed(2)}€
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

