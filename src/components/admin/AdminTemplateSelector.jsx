import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Palette, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TEMPLATES = [
  { id: 'moderne',        label: 'Moderne',         emoji: '🎨', desc: 'Épuré, grille de produits',       bg: 'from-orange-400 to-blue-600' },
  { id: 'chaleureux',     label: 'Chaleureux',       emoji: '🍂', desc: 'Convivial, style magazine',       bg: 'from-amber-400 to-orange-600' },
  { id: 'sombre',         label: 'Sombre',           emoji: '🌙', desc: 'Élégant, fond noir, premium',     bg: 'from-gray-700 to-slate-900' },
  { id: 'brasserie',      label: 'Classique',        emoji: '🏛️', desc: 'Sidebar gauche + grille produits', bg: 'from-stone-400 to-amber-700' },
  { id: 'gastronomique',  label: 'Élégant',          emoji: '✨', desc: 'Liste + sidebar droite, raffiné',  bg: 'from-gray-300 to-gray-600' },
  { id: 'streetfood',     label: 'Dynamique',        emoji: '⚡', desc: 'Fond sombre, grille + sidebar',    bg: 'from-gray-800 to-red-800' },
];

export default function AdminTemplateSelector({ tenant, onSaved }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState('moderne');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    appClient.entities.RestaurantProfile.filter({ tenant_id: tenant.id }).then(profiles => {
      if (profiles[0]) {
        setProfile(profiles[0]);
        setSelected(profiles[0].site_template || 'moderne');
      }
    });
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    await appClient.entities.RestaurantProfile.update(profile.id, { site_template: selected });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: `✅ Template "${TEMPLATES.find(t => t.id === selected)?.label}" assigné à ${tenant.nom_commercial}` });
    onSaved?.();
  };

  return (
    <Card className="border-2 border-purple-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          Template du site vitrine
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">Sélectionnez le template à assigner à ce commerce</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`relative rounded-xl overflow-hidden border-2 text-left transition-all hover:scale-[1.02] ${selected === t.id ? 'border-purple-500 shadow-md' : 'border-gray-200'}`}
            >
              <div className={`h-16 bg-gradient-to-br ${t.bg} flex items-center justify-center text-2xl`}>{t.emoji}</div>
              <div className="p-2 bg-white">
                <p className="font-semibold text-xs text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-400 leading-tight">{t.desc}</p>
              </div>
              {selected === t.id && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !profile}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</> : saved ? '✅ Template assigné !' : 'Assigner ce template'}
        </Button>
      </CardContent>
    </Card>
  );
}
