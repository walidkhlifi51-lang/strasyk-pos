import React from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { Gift, Star, Wallet } from 'lucide-react';

function rewardLabel(rule) {
  if (rule.type_recompense === 'percentage_discount') return `-${rule.valeur_recompense}% offert`;
  if (rule.type_recompense === 'fixed_discount') return `-${rule.valeur_recompense}€ offert`;
  if (rule.type_recompense === 'free_product') return 'Produit offert';
  return '';
}

export default function WebPromoBanner({ tenantId, primaryColor }) {
  const { data: offersRaw = [] } = useQuery({
    queryKey: ['public-offers', tenantId],
    queryFn: () => appClient.entities.Offer.filter({ tenant_id: tenantId, active: true }),
    enabled: !!tenantId
  });
  const offers = offersRaw.filter(o => (o.canaux || ['caisse']).includes('site'));

  const { data: loyaltyRulesRaw = [] } = useQuery({
    queryKey: ['public-loyalty', tenantId],
    queryFn: () => appClient.entities.LoyaltyRule.filter({ tenant_id: tenantId, active: true }),
    enabled: !!tenantId
  });
  const loyaltyRules = loyaltyRulesRaw.filter(r => (r.canaux || ['caisse']).includes('site'));

  const { data: cagnotteRules = [] } = useQuery({
    queryKey: ['public-cagnotte', tenantId],
    queryFn: () => appClient.entities.CagnotteRule.filter({ tenant_id: tenantId, active: true }),
    enabled: !!tenantId
  });

  const cagnotte = cagnotteRules.find(r => (r.canaux || ['caisse']).includes('site'));
  const hasContent = offers.length > 0 || loyaltyRules.length > 0 || cagnotte;

  if (!hasContent) return null;

  return (
    <div className="bg-gray-50 border-b border-gray-200 py-4">
      <div className="max-w-6xl mx-auto px-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">🎁 Offres & Fidélité</p>
        <div className="flex gap-3 overflow-x-auto pb-1">

          {/* Cagnotte */}
          {cagnotte && (
            <div className="flex-shrink-0 bg-white rounded-xl border-2 border-amber-200 px-4 py-3 flex items-center gap-3 min-w-[220px] shadow-sm">
              <Wallet className="w-5 h-5 flex-shrink-0 text-amber-500" />
              <div>
                <p className="font-bold text-gray-900 text-sm">Cagnotte fidélité</p>
                <p className="text-xs text-amber-600 font-semibold mt-0.5">+{cagnotte.accumulation_rate}% de chaque commande</p>
                <p className="text-xs text-gray-400 mt-0.5">Cumulez des points et économisez</p>
              </div>
            </div>
          )}

          {/* Règles de fidélité */}
          {loyaltyRules.map(rule => (
            <div
              key={rule.id}
              className="flex-shrink-0 bg-white rounded-xl border-2 border-green-200 px-4 py-3 flex items-center gap-3 min-w-[220px] shadow-sm"
            >
              <Star className="w-5 h-5 flex-shrink-0 text-green-500" />
              <div>
                <p className="font-bold text-gray-900 text-sm">{rule.nom}</p>
                <p className="text-xs text-green-600 font-semibold mt-0.5">
                  À la {rule.numero_commande === 1 ? '1ère' : `${rule.numero_commande}ème`} commande : {rewardLabel(rule)}
                </p>
                {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
              </div>
            </div>
          ))}

          {/* Offres commerciales */}
          {offers.map(offer => (
            <div
              key={offer.id}
              className="flex-shrink-0 bg-white rounded-xl border-2 border-purple-200 px-4 py-3 flex items-center gap-3 min-w-[200px] shadow-sm"
            >
              <Gift className="w-5 h-5 flex-shrink-0 text-purple-500" />
              <div>
                <p className="font-bold text-gray-900 text-sm">{offer.nom}</p>
                {offer.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{offer.description}</p>}
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
