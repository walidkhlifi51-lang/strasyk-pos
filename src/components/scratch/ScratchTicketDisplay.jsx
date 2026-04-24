import React, { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import ScratchTicketCard from './ScratchTicketCard';
import { Loader2 } from 'lucide-react';

// Clé sessionStorage pour stocker le gain gratté
const SCRATCH_GAIN_KEY = 'scratch_pending_gain';

export default function ScratchTicketDisplay({ tenantId, displayOn = 'web', onAddToCart, primaryColor, profile = null, cartTotal = 0 }) {
  const [sessionId] = useState(`session-${Date.now()}`);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [scratched, setScratched] = useState(false);
  const [gainLabel, setGainLabel] = useState('');

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['scratchTickets', tenantId],
    queryFn: () => appClient.entities.ScratchTicketConfig.filter({ tenant_id: tenantId, active: true }),
    enabled: !!tenantId,
  });

  const applicableConfigs = useMemo(() => configs.filter(c => c.display_location === displayOn), [configs, displayOn]);

  useEffect(() => {
    if (applicableConfigs.length > 0 && !currentTicket) {
      const config = applicableConfigs[Math.floor(Math.random() * applicableConfigs.length)];
      const allOffres = [];
      config.offres.forEach(offre => {
        for (let i = 0; i < (offre.nombre_tickets || 1); i++) allOffres.push(offre);
      });
      const selected = allOffres[Math.floor(Math.random() * allOffres.length)];
      setCurrentTicket({
        id: `ticket-${Date.now()}`,
        config_id: config.id,
        montant_minimum: config.montant_minimum || 0,
        offre_type: selected.type,
        offre_data: {
          product_id: selected.product_id,
          product_nom: selected.product_nom,
          quantite: selected.quantite,
          reduction_value: selected.reduction_value,
        },
        session_id: sessionId,
      });
    }
  }, [applicableConfigs.length]);

  const handleTicketRevealed = (ticket) => {
    const { offre_type, offre_data, montant_minimum } = ticket;
    let gain = null;

    if (offre_type === 'product' && offre_data.product_nom) {
      gain = { type: offre_type, product_id: offre_data.product_id || null, product_nom: offre_data.product_nom, quantite: offre_data.quantite || 1 };
      setGainLabel(`🎁 ${offre_data.product_nom}`);
    } else if (offre_type === 'percentage_discount' || offre_type === 'fixed_discount') {
      gain = { type: offre_type, reduction_value: offre_data.reduction_value };
      setGainLabel(offre_type === 'percentage_discount' ? `🏷️ -${offre_data.reduction_value}%` : `🏷️ -${offre_data.reduction_value}€`);
    }

    if (!gain && offre_type === 'product' && offre_data.product_nom) {
      gain = { type: offre_type, product_id: null, product_nom: offre_data.product_nom, quantite: offre_data.quantite || 1 };
      setGainLabel(`🎁 ${offre_data.product_nom}`);
    }

    if (gain) {
      setScratched(true);
      const gainWithMinimum = { ...gain, montant_minimum };
      if (onAddToCart) {
        onAddToCart(gainWithMinimum);
      } else {
        sessionStorage.setItem(SCRATCH_GAIN_KEY, JSON.stringify(gainWithMinimum));
      }
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (applicableConfigs.length === 0) return null;

  return (
    <div className="w-full max-w-sm mx-auto py-6 px-4">
      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold text-gray-900 mb-1">🎫 Gagnez des cadeaux !</h3>
        <p className="text-sm text-gray-500">Grattez votre ticket pour découvrir votre gain</p>
      </div>

      {!scratched && currentTicket && (
        <ScratchTicketCard
          ticket={currentTicket}
          onRevealed={handleTicketRevealed}
          primaryColor={primaryColor}
          tenantId={tenantId}
        />
      )}

      {scratched && (
        <div className="rounded-xl bg-green-50 border-2 border-green-200 p-5 text-center space-y-2">
          <div className="text-3xl">🎉</div>
          <p className="font-bold text-green-700 text-lg">Vous avez gagné !</p>
          <p className="text-green-600 font-semibold">{gainLabel}</p>
          <p className="text-xs text-green-500">Votre cadeau sera appliqué à la validation de votre commande</p>
        </div>
      )}
    </div>
  );
}
