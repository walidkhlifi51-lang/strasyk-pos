import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Monitor, Globe, ShoppingBag } from 'lucide-react';

const ALL_CANAUX = ['caisse', 'site', 'borne'];
const CANAL_CONFIG = {
  caisse: { label: 'Caisse', icon: ShoppingBag, color: 'text-orange-600' },
  site: { label: 'Site web', icon: Globe, color: 'text-blue-600' },
  borne: { label: 'Borne', icon: Monitor, color: 'text-purple-600' },
};

export default function CanauxSelector({ value = ['caisse'], onChange }) {
  const selected = Array.isArray(value) ? value : ['caisse'];

  const toggle = (canal, checked) => {
    const next = checked
      ? [...selected, canal]
      : selected.filter(c => c !== canal);
    onChange(next.length > 0 ? next : [canal]);
  };

  return (
    <div className="p-3 border rounded-lg bg-blue-50 space-y-2">
      <Label className="font-semibold text-blue-900">Canaux de vente concernés</Label>
      <div className="flex flex-wrap gap-4">
        {ALL_CANAUX.map(canal => {
          const cfg = CANAL_CONFIG[canal];
          return (
            <div key={canal} className="flex items-center space-x-2">
              <Checkbox
                id={`canal-${canal}-${Math.random()}`}
                checked={selected.includes(canal)}
                onCheckedChange={(checked) => toggle(canal, checked)}
              />
              <label htmlFor={`canal-${canal}-${Math.random()}`} className={`text-sm cursor-pointer flex items-center gap-1 ${cfg.color}`}>
                <cfg.icon className="w-3.5 h-3.5" />
                {cfg.label}
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-blue-600">Choisissez où cette règle s'applique : caisse physique, site de commande en ligne, ou borne de commande.</p>
    </div>
  );
}
