import React, { useState, useEffect } from 'react';
import { Gift, ShoppingBag, X } from 'lucide-react';

const SCRATCH_GAIN_KEY = 'scratch_pending_gain';

function buildCartItem(gain) {
  if (gain.type === 'product') {
    return {
      _key: `scratch-gift-${Date.now()}`,
      product_id: gain.product_id || 'scratch-gift',
      nom_produit: `🎁 CADEAU: ${gain.product_nom}`,
      quantite: gain.quantite || 1,
      prix_unitaire: 0,
      total_ligne: 0,
      tva: 5.5,
      options: [],
      exclusions: [],
      is_scratch_gift: true,
    };
  } else if (gain.type === 'percentage_discount' || gain.type === 'fixed_discount') {
    const reductionLabel = gain.type === 'percentage_discount'
      ? `Réduction -${gain.reduction_value}%`
      : `Réduction -${gain.reduction_value}€`;
    return {
      _key: `scratch-reduction-${Date.now()}`,
      product_id: 'scratch-reduction',
      nom_produit: `🎫 CADEAU SCRATCH: ${reductionLabel}`,
      quantite: 1,
      prix_unitaire: 0,
      total_ligne: 0,
      tva: 0,
      options: [],
      exclusions: [],
      is_scratch_discount: true,
      scratch_discount_type: gain.type,
      scratch_discount_value: gain.reduction_value,
    };
  }
  return null;
}

/**
 * À placer dans OnlineCheckout.
 * - Si le gain existe et minimum atteint → l'applique automatiquement au montage
 * - Si minimum non atteint → affiche un bandeau avec 2 choix
 */
export default function ScratchGainChecker({ cartTotal, onCartChange, onBack }) {
  const [gain, setGain] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SCRATCH_GAIN_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setGain(parsed);
    } catch {
      sessionStorage.removeItem(SCRATCH_GAIN_KEY);
    }
  }, []);

  useEffect(() => {
    if (!gain || applied || dismissed) return;
    const minimum = gain.montant_minimum || 0;
    const reached = minimum === 0 || Math.round(cartTotal * 100) >= Math.round(minimum * 100);
    console.log('🎫 ScratchGainChecker:', { gain, cartTotal, minimum, reached, hasOnCartChange: !!onCartChange });
    if (reached) {
      const item = buildCartItem(gain);
      console.log('✅ Item à ajouter:', item);
      if (item && onCartChange) {
        sessionStorage.removeItem(SCRATCH_GAIN_KEY);
        onCartChange(prev => {
          console.log('🛒 Panier avant ajout scratch:', prev);
          return [...(Array.isArray(prev) ? prev : []), item];
        });
        setApplied(true);
      }
    }
  }, [gain, cartTotal, applied, dismissed]);

  if (!gain || applied) return null;

  const minimum = gain.montant_minimum || 0;
  const reached = minimum === 0 || Math.round(cartTotal * 100) >= Math.round(minimum * 100);
  const manquant = Math.max(0, minimum - cartTotal);

  if (reached || dismissed) return null;

  const gainLabel = gain.type === 'product'
    ? `🎁 ${gain.product_nom}`
    : gain.type === 'percentage_discount'
      ? `🏷️ -${gain.reduction_value}% sur votre commande`
      : `🏷️ -${gain.reduction_value}€ sur votre commande`;

  return (
    <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-orange-800">Vous avez un cadeau scratch !</p>
            <p className="text-orange-700 font-semibold text-sm">{gainLabel}</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-orange-400 hover:text-orange-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
        <p className="text-sm text-orange-700">Il vous manque encore</p>
        <p className="text-2xl font-black text-orange-600">{manquant.toFixed(2)}€</p>
        <p className="text-xs text-orange-500">pour atteindre le minimum de {minimum.toFixed(2)}€</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-orange-400 text-orange-700 font-semibold text-sm hover:bg-orange-100 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          Continuer mes achats
        </button>
        <button
          onClick={() => {
            sessionStorage.removeItem(SCRATCH_GAIN_KEY);
            setDismissed(true);
          }}
          className="py-2.5 rounded-xl bg-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-300 transition-colors"
        >
          Continuer sans cadeau
        </button>
      </div>
    </div>
  );
}
