import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import SiteQRCode from './SiteQRCode';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Globe, AlertTriangle, Clock, Zap, Save, ExternalLink, CheckCircle2, Monitor, Palette, Lock, Image, Video, Plus, Trash2, Upload } from 'lucide-react';
import { useTenant } from '@/components/contexts/TenantContext';
import { createPageUrl } from '@/utils';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };

export default function WebOrderingSettings({ data, onDataChange }) {
  const { currentTenant } = useTenant();
  const profile = data?.profile;
  const products = data?.products || [];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [closed, setClosed] = useState(profile?.web_ordering_closed ?? false);
  const [closedMessage, setClosedMessage] = useState(profile?.web_ordering_closed_message ?? 'Les commandes en ligne sont temporairement indisponibles. Réessayez plus tard.');
  const [horaires, setHoraires] = useState(profile?.web_ordering_horaires ?? {
    lundi: '11:00 - 22:00',
    mardi: '11:00 - 22:00',
    mercredi: '11:00 - 22:00',
    jeudi: '11:00 - 22:00',
    vendredi: '11:00 - 23:00',
    samedi: '11:00 - 23:00',
    dimanche: 'Fermé',
  });
  const [delaiLivraison, setDelaiLivraison] = useState(profile?.web_ordering_delai_livraison ?? '30-45 min');
  const [delaiEmporter, setDelaiEmporter] = useState(profile?.web_ordering_delai_emporter ?? '15-20 min');
  const [webFraisEnabled, setWebFraisEnabled] = useState(profile?.web_frais_livraison_enabled ?? true);
  const [webFraisMontant, setWebFraisMontant] = useState(profile?.web_frais_livraison ?? profile?.frais_livraison ?? 2.5);
  const [flashOffer, setFlashOffer] = useState(profile?.web_ordering_flash_offer ?? { active: false, titre: '', description: '', expires_at: '', cible: 'site', product_id: '', reduction_type: 'percentage', reduction_value: '', selected_sizes: [], size_prices: [] });
  const [sitePrimaryColor, setSitePrimaryColor] = useState(profile?.site_primary_color || profile?.kiosk_primary_color || '#f97316');
  const [heroImages, setHeroImages] = useState(profile?.site_hero_images || []);
  const [heroImageSource, setHeroImageSource] = useState(profile?.site_hero_source || (profile?.site_hero_images?.length > 0 ? 'custom' : 'products'));
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [videoUrl, setVideoUrl] = useState(profile?.site_video_url || '');
  const [videoTitre, setVideoTitre] = useState(profile?.site_video_titre || '');
  const [siteSubtitle, setSiteSubtitle] = useState(profile?.site_subtitle || '');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [heroMessages, setHeroMessages] = useState(profile?.site_hero_messages || [
    { titre: 'Bienvenue chez nous 👋', sous_titre: 'Découvrez nos spécialités du moment' },
    { titre: 'Commandez en ligne 🛵', sous_titre: 'Livraison rapide à domicile ou à emporter' },
    { titre: 'Nos incontournables ⭐', sous_titre: 'Les plats préférés de nos clients' },
  ]);

  const siteUrl = `${window.location.origin}${createPageUrl('OrderOnline')}?slug=${currentTenant?.slug || ''}`;
  const restaurantSiteUrl = `${window.location.origin}${createPageUrl('RestaurantSite')}?slug=${currentTenant?.slug || ''}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanedFlashOffer = {
        ...flashOffer,
        reduction_value: flashOffer.reduction_value === '' || flashOffer.reduction_value === null || flashOffer.reduction_value === undefined
          ? 0
          : parseFloat(flashOffer.reduction_value) || 0,
      };
      await appClient.entities.RestaurantProfile.update(profile.id, {
        web_ordering_closed: closed,
        web_ordering_closed_message: closedMessage,
        web_ordering_horaires: horaires,
        web_ordering_delai_livraison: delaiLivraison,
        web_ordering_delai_emporter: delaiEmporter,
        web_ordering_flash_offer: cleanedFlashOffer,
        site_primary_color: sitePrimaryColor,
        web_frais_livraison_enabled: webFraisEnabled,
        web_frais_livraison: webFraisMontant,
        site_hero_images: heroImageSource === 'products' ? [] : heroImages.filter(Boolean),
        site_hero_source: heroImageSource,
        site_video_url: videoUrl,
        site_video_titre: videoTitre,
        site_subtitle: siteSubtitle,
        site_hero_messages: heroMessages.filter(m => m.titre || m.sous_titre),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onDataChange?.();
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      alert('Erreur lors de la sauvegarde : ' + (err.message || 'Veuillez réessayer'));
    } finally {
      setSaving(false);
    }
  };

  if (!profile?.manages_web_ordering) {
    return (
      <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
        <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Module non activé</h3>
        <p className="text-gray-400 text-sm">La commande en ligne n'est pas activée pour votre établissement.<br/>Contactez le support pour activer ce module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Codes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📱</span>
          <div>
            <h3 className="font-semibold text-gray-800">QR Codes à afficher</h3>
            <p className="text-xs text-gray-500">Imprimez ou téléchargez ces QR codes pour vos clients</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SiteQRCode url={restaurantSiteUrl} label="QR Code — Site vitrine" profile={profile} />
          <SiteQRCode url={siteUrl} label="QR Code — Commande directe" profile={profile} />
        </div>
      </div>

      {/* Liens du site */}
      <div className="space-y-3">
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <Globe className="w-6 h-6 text-orange-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-800 mb-0.5">Site vitrine (avec produits)</p>
            <p className="text-xs text-orange-600 truncate font-mono">{restaurantSiteUrl}</p>
          </div>
          <a href={restaurantSiteUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1 flex-shrink-0 text-xs px-3">
              <ExternalLink className="w-3 h-3" /> Ouvrir
            </Button>
          </a>
        </div>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Monitor className="w-6 h-6 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800 mb-0.5">Page de commande directe</p>
            <p className="text-xs text-blue-600 truncate font-mono">{siteUrl}</p>
          </div>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1 flex-shrink-0 text-xs px-3 border-blue-400 text-blue-600">
              <ExternalLink className="w-3 h-3" /> Ouvrir
            </Button>
          </a>
        </div>
      </div>

      {false && <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-emerald-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Nom de domaine personnalisé</h3>
            <p className="text-xs text-gray-500">Permet d'utiliser uniquement le site web sur votre propre domaine.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Domaine public</label>
          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="www.mondomaine.fr"
          />
          <p className="text-xs text-gray-500">
            Saisissez uniquement le domaine, sans `https://` ni chemin. Exemple : `www.mondomaine.fr`
          </p>
        </div>

        {normalizedCustomDomain && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">URL publique attendue</p>
              <p className="text-sm font-mono text-emerald-800 break-all">{publicCustomDomainUrl}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">Configuration DNS à donner au commerçant</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded border border-blue-100 p-2">
                  <p className="text-gray-500 mb-1">Type</p>
                  <p className="font-mono text-blue-900">CNAME</p>
                </div>
                <div className="bg-white rounded border border-blue-100 p-2">
                  <p className="text-gray-500 mb-1">Nom</p>
                  <p className="font-mono text-blue-900">www</p>
                </div>
                <div className="bg-white rounded border border-blue-100 p-2">
                  <p className="text-gray-500 mb-1">Valeur</p>
                  <p className="font-mono text-blue-900 break-all">{window.location.hostname}</p>
                </div>
              </div>
              <p className="text-xs text-blue-700">
                Recommandation : utiliser `www` pour le site client et garder `app.` pour la caisse et l'administration.
              </p>
            </div>
          </>
        )}
      </div>}

      {/* Couleur principale */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-pink-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Couleur principale de votre site</h3>
            <p className="text-xs text-gray-500">Personnalisez la couleur des boutons et accents</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={sitePrimaryColor}
              onChange={e => setSitePrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer p-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Couleur actuelle</p>
              <p className="text-xs font-mono text-gray-500">{sitePrimaryColor}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#1e40af'].map(c => (
              <button key={c} onClick={() => setSitePrimaryColor(c)} className={`w-8 h-8 rounded-full border-2 transition hover:scale-110 ${sitePrimaryColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="mt-3 px-4 py-2 rounded-lg text-white text-xs font-semibold inline-block" style={{ backgroundColor: sitePrimaryColor }}>
          Aperçu bouton Commander
        </div>
      </div>

      {/* Sous-titre personnalisable (affiché sur le template Gastronomique) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">✏️</span>
          <div>
            <h3 className="font-semibold text-gray-800">Sous-titre du site vitrine</h3>
            <p className="text-xs text-gray-500">Texte affiché au-dessus du nom (ex: Restaurant, Brasserie, Pizza...)</p>
          </div>
        </div>
        <input
          type="text"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          value={siteSubtitle}
          onChange={e => setSiteSubtitle(e.target.value)}
          placeholder="Restaurant"
          maxLength={40}
        />
      </div>

      {/* Template actuel (lecture seule) */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="font-semibold text-gray-700">Template du site vitrine</h3>
            <p className="text-xs text-gray-400">Défini par votre administrateur — contactez le support pour en changer</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 capitalize">
            {profile?.site_template || 'Moderne'}
          </span>
          <span className="text-xs text-gray-400">Template actuel</span>
        </div>
      </div>

      {/* Bloquer les commandes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="font-semibold text-gray-800">Bloquer les commandes en ligne</h3>
              <p className="text-xs text-gray-500">Empêche les clients de passer des commandes temporairement</p>
            </div>
          </div>
          <Switch checked={closed} onCheckedChange={setClosed} />
        </div>
        {closed && (
          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Message affiché aux clients</label>
            <textarea
              className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
              rows={3}
              value={closedMessage}
              onChange={e => setClosedMessage(e.target.value)}
              placeholder="Ex: Nous sommes fermés pour travaux. Réouverture le 15 mars."
            />
          </div>
        )}
      </div>

      {/* Frais de livraison web */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🛵</span>
            <div>
              <h3 className="font-semibold text-gray-800">Frais de livraison (commande en ligne)</h3>
              <p className="text-xs text-gray-500">Activer et définir le montant des frais de livraison sur votre site</p>
            </div>
          </div>
          <Switch checked={webFraisEnabled} onCheckedChange={setWebFraisEnabled} />
        </div>
        {webFraisEnabled && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Montant des frais :</label>
            <div className="relative w-32">
              <input
                type="number"
                step="0.10"
                min="0"
                className="w-full border rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={webFraisMontant}
                onChange={e => setWebFraisMontant(parseFloat(e.target.value) || 0)}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
            </div>
          </div>
        )}
      </div>

      {/* Délais de préparation */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-green-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Délais de préparation</h3>
            <p className="text-xs text-gray-500">Affiché au client sur la page de confirmation de commande</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">🛵 Délai de livraison</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={delaiLivraison}
              onChange={e => setDelaiLivraison(e.target.value)}
              placeholder="Ex: 30-45 min, environ 1h..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">🥡 Délai à emporter</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              value={delaiEmporter}
              onChange={e => setDelaiEmporter(e.target.value)}
              placeholder="Ex: 15-20 min, environ 30 min..."
            />
          </div>
        </div>
      </div>

      {/* Horaires */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Horaires de commande en ligne</h3>
            <p className="text-xs text-gray-500">Affiché sur votre page de commande</p>
          </div>
        </div>
        <div className="space-y-2">
          {JOURS.map(jour => (
            <div key={jour} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-24 flex-shrink-0">{JOURS_LABELS[jour]}</span>
              <input
                type="text"
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={horaires[jour] ?? ''}
                onChange={e => setHoraires({ ...horaires, [jour]: e.target.value })}
                placeholder="Ex: 11:00 - 22:00 ou Fermé"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Offre flash */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-gray-800">Offre Flash</h3>
              <p className="text-xs text-gray-500">Bandeau promotionnel sur votre site de commande</p>
            </div>
          </div>
          <Switch
            checked={flashOffer.active ?? false}
            onCheckedChange={v => setFlashOffer({ ...flashOffer, active: v })}
          />
        </div>

        {flashOffer.active && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Titre de l'offre</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={flashOffer.titre ?? ''}
                onChange={e => setFlashOffer({ ...flashOffer, titre: e.target.value })}
                placeholder="Ex: -20% sur toutes les pizzas ce soir !"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                rows={2}
                value={flashOffer.description ?? ''}
                onChange={e => setFlashOffer({ ...flashOffer, description: e.target.value })}
                placeholder="Ex: Valable jusqu'à 23h, pour toute commande à emporter."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date d'expiration (optionnel)</label>
              <input
                type="datetime-local"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={flashOffer.expires_at ? flashOffer.expires_at.slice(0, 16) : ''}
                onChange={e => setFlashOffer({ ...flashOffer, expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              />
            </div>

            {/* Cible */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Appliquer sur</label>
              <div className="flex gap-2">
                {[{v:'site', l:'🌐 Site web'}, {v:'caisse', l:'💻 Caisse'}, {v:'borne', l:'📱 Borne'}].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      const cibles = flashOffer.cible?.split(',') || [];
                      const newCibles = cibles.includes(opt.v) 
                        ? cibles.filter(c => c !== opt.v)
                        : [...cibles, opt.v];
                      setFlashOffer({ ...flashOffer, cible: newCibles.join(',') });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition ${(flashOffer.cible?.includes(opt.v)) ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Réduction sur un produit */}
            <div className="border border-amber-100 bg-amber-50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-amber-700">Réduction prix sur un produit (optionnel)</p>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Produit concerné</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  value={flashOffer.product_id || ''}
                  onChange={e => setFlashOffer({ ...flashOffer, product_id: e.target.value, selected_sizes: [], size_prices: [] })}
                >
                  <option value="">-- Aucun produit --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              
              {flashOffer.product_id && (() => {
                const selectedProduct = products.find(p => p.id === flashOffer.product_id);
                const hasSizes = selectedProduct?.size_prices?.length > 0 || selectedProduct?.size_prix_par_mode?.length > 0;
                const sizeList = selectedProduct?.size_prices?.map(s => s.size) || selectedProduct?.size_prix_par_mode?.map(s => s.size) || [];
                
                return (
                  <>
                    {hasSizes && (
                      <div className="bg-white p-3 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-700 mb-2">Tailles concernées</p>
                        <div className="flex flex-wrap gap-2">
                          {sizeList.map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                const selected = flashOffer.selected_sizes || [];
                                const newSelected = selected.includes(size)
                                  ? selected.filter(s => s !== size)
                                  : [...selected, size];
                                setFlashOffer({ ...flashOffer, selected_sizes: newSelected });
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition ${(flashOffer.selected_sizes || []).includes(size) ? 'border-orange-400 bg-orange-100 text-orange-700' : 'border-gray-200 text-gray-600'}`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-600 mb-1 block">Type de réduction</label>
                        <select
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                          value={flashOffer.reduction_type || 'percentage'}
                          onChange={e => setFlashOffer({ ...flashOffer, reduction_type: e.target.value })}
                        >
                          <option value="percentage">Pourcentage (%)</option>
                          <option value="fixed_amount">Montant fixe à déduire (€)</option>
                          {hasSizes && <option value="fixed_price_by_size">Prix fixe par taille (€)</option>}
                        </select>
                      </div>
                      {flashOffer.reduction_type !== 'fixed_price_by_size' && (
                        <div className="w-28">
                          <label className="text-xs text-gray-600 mb-1 block">Valeur</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full border rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                              value={flashOffer.reduction_value || ''}
                              onChange={e => setFlashOffer({ ...flashOffer, reduction_value: parseFloat(e.target.value) || '' })}
                              placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                              {flashOffer.reduction_type === 'percentage' ? '%' : '€'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {flashOffer.reduction_type === 'fixed_price_by_size' && hasSizes && (
                      <div className="bg-white p-3 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-700 mb-2">Prix fixe par taille</p>
                        <div className="space-y-2">
                          {sizeList.map(size => {
                            const sizePrice = (flashOffer.size_prices || []).find(sp => sp.size === size) || { size, price: '' };
                            return (
                              <div key={size} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 w-16">{size}</span>
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full border rounded-lg px-3 py-1.5 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                    value={sizePrice.price || ''}
                                    onChange={e => {
                                      const newPrices = [...(flashOffer.size_prices || [])];
                                      const idx = newPrices.findIndex(sp => sp.size === size);
                                      if (idx >= 0) {
                                        newPrices[idx] = { size, price: parseFloat(e.target.value) || 0 };
                                      } else {
                                        newPrices.push({ size, price: parseFloat(e.target.value) || 0 });
                                      }
                                      setFlashOffer({ ...flashOffer, size_prices: newPrices });
                                    }}
                                    placeholder="0.00"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Aperçu */}
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wide mb-2 text-center">Aperçu du bandeau</p>
              <p className="text-sm font-bold text-yellow-800 text-center">⚡ {flashOffer.titre || 'Titre de l\'offre'}</p>
              {flashOffer.description && <p className="text-xs text-yellow-700 mt-0.5 text-center">{flashOffer.description}</p>}
              {flashOffer.cible && (
                <p className="text-xs text-amber-600 mt-1 text-center">
                  Canaux : {flashOffer.cible?.split(',').map(c => c === 'site' ? '🌐 Web' : c === 'caisse' ? '💻 Caisse' : '📱 Borne').join(', ')}
                </p>
              )}
              {flashOffer.product_id && (
                <p className="text-xs text-amber-600 mt-1 text-center">
                  {(() => {
                    const prod = products.find(p => p.id === flashOffer.product_id);
                    if (flashOffer.reduction_type === 'fixed_price_by_size') {
                      return `Prix fixe: ${(flashOffer.size_prices || []).map(sp => `${sp.size} ${sp.price}€`).join(', ')}`;
                    }
                    return `${flashOffer.reduction_type === 'percentage' ? `-${flashOffer.reduction_value}%` : `-${flashOffer.reduction_value}€`} sur ${prod?.nom}`;
                  })()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Photos Hero Slideshow */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Image className="w-5 h-5 text-purple-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Slideshow du site vitrine</h3>
            <p className="text-xs text-gray-500">Photos affichées en arrière-plan du hero</p>
          </div>
        </div>

        {/* Choix source */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setHeroImageSource('products')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${heroImageSource === 'products' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}
          >
            🍽️ Photos des produits vedettes
          </button>
          <button
            type="button"
            onClick={() => setHeroImageSource('custom')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${heroImageSource === 'custom' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}
          >
            📷 Mes photos personnalisées
          </button>
        </div>

        {heroImageSource === 'products' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-700">✅ Les photos de vos produits marqués <strong>Vedette</strong> seront utilisées automatiquement dans le slideshow.</p>
            {(() => {
              const featuredWithImages = products.filter(p => p.featured && p.image_url);
              return featuredWithImages.length > 0 ? (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {featuredWithImages.slice(0, 5).map(p => (
                    <img key={p.id} src={p.image_url} alt={p.nom} className="w-12 h-12 object-cover rounded-lg border border-purple-200" />
                  ))}
                  {featuredWithImages.length > 5 && <span className="text-xs text-purple-500 self-center">+{featuredWithImages.length - 5} autres</span>}
                </div>
              ) : (
                <p className="text-xs text-purple-500 mt-1">Aucun produit vedette avec photo pour l'instant.</p>
              );
            })()}
          </div>
        )}

        {heroImageSource === 'custom' && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const url = heroImages[i] || '';
              return (
                <div key={i} className="flex gap-2 items-center">
                  {url && <img src={url} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-200 flex-shrink-0" onError={e => e.target.style.display='none'} />}
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={url}
                    onChange={e => {
                      const newImages = [...heroImages];
                      newImages[i] = e.target.value;
                      setHeroImages(newImages.filter((_, idx) => idx <= i || newImages[idx]));
                    }}
                    placeholder={`URL ou télécharger photo ${i + 1}`}
                  />
                  <label className="cursor-pointer p-2 border rounded-lg hover:bg-purple-50 text-purple-500 transition flex-shrink-0" title="Télécharger une photo">
                    {uploadingIndex === i ? <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingIndex(i);
                      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
                      const newImages = [...heroImages];
                      newImages[i] = file_url;
                      setHeroImages(newImages);
                      setUploadingIndex(null);
                    }} />
                  </label>
                  {url && (
                    <button type="button" onClick={() => { const n = [...heroImages]; n[i] = ''; setHeroImages(n); }} className="p-2 text-red-400 hover:text-red-600 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages Slideshow */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">✏️</span>
          <div>
            <h3 className="font-semibold text-gray-800">Messages du slideshow</h3>
            <p className="text-xs text-gray-500">Textes affichés sur chaque slide du hero (max 5)</p>
          </div>
        </div>
        <div className="space-y-3">
          {heroMessages.slice(0, 5).map((msg, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Message {i + 1}</p>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                value={msg.titre}
                onChange={e => { const n = [...heroMessages]; n[i] = { ...n[i], titre: e.target.value }; setHeroMessages(n); }}
                placeholder="Titre (ex: Bienvenue chez nous 👋)"
              />
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                value={msg.sous_titre}
                onChange={e => { const n = [...heroMessages]; n[i] = { ...n[i], sous_titre: e.target.value }; setHeroMessages(n); }}
                placeholder="Sous-titre (ex: Livraison rapide à domicile)"
              />
            </div>
          ))}
          {heroMessages.length < 5 && (
            <button type="button" onClick={() => setHeroMessages([...heroMessages, { titre: '', sous_titre: '' }])}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500 transition">
              + Ajouter un message
            </button>
          )}
        </div>
      </div>

      {/* Vidéo YouTube */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Video className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="font-semibold text-gray-800">Vidéo de présentation</h3>
            <p className="text-xs text-gray-500">Affichée sur votre site vitrine entre le hero et les produits</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">📹 Formats acceptés</p>
          <p className="text-xs text-blue-600">Uploadez une vidéo au format <strong>MP4, WebM ou MOV</strong>. Taille recommandée : moins de 50 Mo pour un chargement rapide.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Titre de la section vidéo</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              value={videoTitre}
              onChange={e => setVideoTitre(e.target.value)}
              placeholder="Ex: Découvrez notre cuisine, Notre restaurant en vidéo..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Vidéo (MP4 / WebM / MOV)</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="URL de votre vidéo ou uploadez ci-contre →"
              />
              <label className="cursor-pointer px-3 py-2 border rounded-lg hover:bg-red-50 text-red-500 transition flex items-center gap-1 text-sm flex-shrink-0" title="Télécharger une vidéo">
                {uploadingVideo ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">Uploader</span>
                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingVideo(true);
                  const { file_url } = await appClient.integrations.Core.UploadFile({ file });
                  setVideoUrl(file_url);
                  setUploadingVideo(false);
                }} />
              </label>
            </div>
          </div>
          {videoUrl && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              ✅ Vidéo sera affichée sur votre site vitrine
            </p>
          )}
          {videoUrl && (
            <button type="button" onClick={() => setVideoUrl('')} className="text-xs text-red-400 hover:text-red-600">
              🗑️ Supprimer la vidéo
            </button>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
