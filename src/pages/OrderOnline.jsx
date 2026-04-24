import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, MapPin, Phone, CheckCircle2, Loader2, Zap, Clock, Home } from 'lucide-react';

function FlashCountdown({ expiresAt, primaryColor }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - new Date();
      if (diff <= 0) return setTimeLeft(null);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <Clock className="w-4 h-4 text-white opacity-80" />
      <span className="text-white text-sm opacity-90">Se termine dans :</span>
      <div className="flex gap-1">
        {[{ v: timeLeft.h, l: 'h' }, { v: timeLeft.m, l: 'min' }, { v: timeLeft.s, l: 's' }].map(({ v, l }) => (
          <div key={l} className="bg-white bg-opacity-20 rounded-lg px-2 py-1 text-center min-w-[42px]">
            <div className="text-white font-bold text-xl leading-none">{pad(v)}</div>
            <div className="text-white text-xs opacity-75">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
import OnlineProductBrowser from '../components/online/OnlineProductBrowser';
import OnlineCheckout from '../components/online/OnlineCheckout';
import WebPromoBanner from '../components/online/WebPromoBanner';
import ScratchTicketDisplay from '../components/scratch/ScratchTicketDisplay';
import { buildPublicPageUrl, getPublicHostname, resolvePublicTenantContext } from '@/lib/publicSiteTenant';

export default function OrderOnline() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const currentHostname = getPublicHostname();
  const successParam = urlParams.get('success');
  const orderIdParam = urlParams.get('order_id');

  const [step, setStep] = useState(successParam === 'true' ? 'confirmation' : 'order_type');
  const [orderType, setOrderType] = useState(null);
  const [cart, setCart] = useState([]);

  // Charger les gains scratch depuis sessionStorage au démarrage
  useEffect(() => {
    const initialCart = [];
    
    // Charger le produit cadeau
    const pendingGift = sessionStorage.getItem('scratch_gift_pending');
    if (pendingGift) {
      try {
        const gift = JSON.parse(pendingGift);
        console.log('🎁 Gain produit récupéré depuis sessionStorage:', gift);
        initialCart.push({
          _key: `scratch-gift-${gift.timestamp}`,
          product_id: gift.product_id || 'scratch-gift',
          nom_produit: `🎁 CADEAU: ${gift.product_nom}`,
          quantite: gift.quantite || 1,
          prix_unitaire: 0,
          total_ligne: 0,
          tva: 5.5,
          options: [],
          exclusions: [],
          is_scratch_gift: true,
        });
        sessionStorage.removeItem('scratch_gift_pending');
      } catch (e) {
        console.error('Erreur lecture scratch gift:', e);
      }
    }

    // Charger la réduction
    const pendingDiscount = sessionStorage.getItem('scratch_discount_pending');
    if (pendingDiscount) {
      try {
        const discount = JSON.parse(pendingDiscount);
        console.log('💰 Réduction scratch récupérée depuis sessionStorage:', discount);
        const reductionLabel = discount.type === 'percentage_discount' 
          ? `Réduction -${discount.reduction_value}%`
          : `Réduction -${discount.reduction_value}€`;
        
        initialCart.push({
          _key: `scratch-reduction-${discount.timestamp}`,
          product_id: 'scratch-reduction',
          nom_produit: `🎫 CADEAU SCRATCH: ${reductionLabel}`,
          quantite: 1,
          prix_unitaire: discount.type === 'percentage_discount' ? 0 : -discount.reduction_value,
          total_ligne: discount.type === 'percentage_discount' ? 0 : -discount.reduction_value,
          tva: 0,
          options: [],
          exclusions: [],
          is_scratch_discount: true,
          scratch_discount_type: discount.type,
          scratch_discount_value: discount.reduction_value
        });
        sessionStorage.removeItem('scratch_discount_pending');
      } catch (e) {
        console.error('Erreur lecture scratch discount:', e);
      }
    }

    if (initialCart.length > 0) {
      setCart(initialCart);
      console.log('✅ Gains ajoutés au panier initial:', initialCart);
    }
  }, []);

  const { data: siteContext, isLoading: loadingTenant } = useQuery({
    queryKey: ['online-tenant-context', slug, currentHostname],
    queryFn: () => resolvePublicTenantContext({ slug, hostname: currentHostname }),
    staleTime: 5 * 60 * 1000,
  });

  const tenant = siteContext?.tenant;
  const profile = siteContext?.profile;

  const { data: products = [] } = useQuery({
    queryKey: ['online-products', tenant?.id],
    queryFn: async () => {
      const result = await appClient.entities.Product.filter({ tenant_id: tenant?.id });
      console.log('📦 Premier produit complet:', JSON.stringify(result[0], null, 2));
      return result.filter(p => p.disponible !== false);
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['online-categories', tenant?.id],
    queryFn: () => appClient.entities.Category.filter({ tenant_id: tenant?.id, disponible: true }),
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: productIngredients = [] } = useQuery({
    queryKey: ['online-product-ingredients', tenant?.id],
    queryFn: () => appClient.entities.ProductIngredient.filter({ tenant_id: tenant?.id }),
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: ingredientsList = [] } = useQuery({
    queryKey: ['online-ingredients', tenant?.id],
    queryFn: () => appClient.entities.Ingredient.filter({ tenant_id: tenant?.id }),
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: optionGroups = [] } = useQuery({
    queryKey: ['online-option-groups', tenant?.id],
    queryFn: () => appClient.entities.OptionGroup.filter({ tenant_id: tenant?.id }),
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: optionItems = [] } = useQuery({
    queryKey: ['online-option-items', tenant?.id],
    queryFn: () => appClient.entities.OptionItem.filter({ tenant_id: tenant?.id }),
    enabled: !!tenant?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: offersRaw = [] } = useQuery({
    queryKey: ['online-offers', tenant?.id],
    queryFn: () => appClient.entities.Offer.filter({ tenant_id: tenant?.id, active: true }),
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });
  const siteOffers = offersRaw.filter(o => (o.canaux || ['caisse']).includes('site'));

  const { data: menus = [] } = useQuery({
    queryKey: ['online-menus', tenant?.id],
    queryFn: () => appClient.entities.MenuFormula.filter({ tenant_id: tenant?.id, disponible: true }),
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  const ingredientsByProduct = productIngredients.reduce((acc, pi) => {
    const ing = ingredientsList.find(i => i.id === pi.ingredient_id);
    if (ing) {
      if (!acc[pi.product_id]) acc[pi.product_id] = [];
      acc[pi.product_id].push(ing.nom);
    }
    return acc;
  }, {});

  const isLoading = loadingTenant;
  const primaryColor = profile?.site_primary_color || profile?.kiosk_primary_color || '#f97316';
  const restaurantSiteUrl = buildPublicPageUrl('RestaurantSite', {
    slug: tenant?.slug || slug,
    customDomain: siteContext?.resolvedBy === 'domain' ? siteContext?.customDomain : null,
  });

  const HomeButton = () => restaurantSiteUrl ? (
    <a
      href={restaurantSiteUrl}
      className="fixed bottom-6 left-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Home className="w-4 h-4" />
      <span>Accueil</span>
    </a>
  ) : null;

  if (!slug && !tenant && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Lien invalide</h1>
          <p className="text-gray-500 mt-2">Veuillez accéder à cette page via le lien fourni par votre restaurant.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!tenant || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Restaurant introuvable</h1>
          <p className="text-gray-500 mt-2">Ce lien ne correspond à aucun restaurant actif.</p>
        </div>
      </div>
    );
  }

  if (!profile.manages_web_ordering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">{profile.nom_etablissement}</h1>
          <p className="text-gray-500 mt-2">La commande en ligne n'est pas disponible pour ce restaurant.</p>
          {profile.telephone && (
            <p className="mt-4 text-gray-600">
              Commandez par téléphone : <a href={`tel:${profile.telephone}`} className="font-semibold" style={{ color: primaryColor }}>{profile.telephone}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (profile.web_ordering_closed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          {profile.logo_url && <img src={profile.logo_url} alt={profile.nom_etablissement} className="w-20 h-20 object-contain mx-auto mb-6 rounded-full border" />}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{profile.nom_etablissement}</h1>
          <p className="text-gray-600">{profile.web_ordering_closed_message || 'Les commandes en ligne sont temporairement indisponibles.'}</p>
          {profile.telephone && (
            <p className="mt-6 text-gray-500 text-sm">
              📞 Commandez par téléphone : <a href={`tel:${profile.telephone}`} className="font-semibold" style={{ color: primaryColor }}>{profile.telephone}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'confirmation') {
    const delai = orderType === 'livraison'
      ? profile.web_ordering_delai_livraison || '30-45 min'
      : profile.web_ordering_delai_emporter || '15-20 min';
    const delaiEmoji = orderType === 'livraison' ? '🛵' : '🥡';
    const delaiLabel = orderType === 'livraison' ? 'Délai de livraison estimé' : 'Prête à récupérer dans';
    const confirmRestaurantSiteUrl = restaurantSiteUrl;

    return (<>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md mx-auto w-full">
          {profile.logo_url && (
            <img src={profile.logo_url} alt={profile.nom_etablissement} className="w-20 h-20 object-contain mx-auto mb-6 rounded-full border" />
          )}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Commande confirmée !</h1>
          <p className="text-gray-600 mb-4">
            Votre commande a bien été enregistrée chez <strong>{profile.nom_etablissement}</strong>.
          </p>

          {/* Délai */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4 mb-6 inline-block w-full">
            <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-1">{delaiLabel}</p>
            <p className="text-3xl font-extrabold text-orange-600">{delaiEmoji} {delai}</p>
          </div>

          <p className="text-sm text-gray-400 mb-6">Une confirmation vous sera envoyée par email.</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setCart([]); setStep('order_type'); }}
              className="w-full px-8 py-3 text-white rounded-xl font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Nouvelle commande
            </button>
            <a
              href={confirmRestaurantSiteUrl}
              className="w-full px-8 py-3 rounded-xl font-semibold border-2 transition-colors text-gray-700 bg-white hover:bg-gray-50 block"
              style={{ borderColor: primaryColor }}
            >
              🏠 Retour au site du restaurant
            </a>
          </div>
        </div>
      </div>
      <HomeButton />
    </>);
  }

  const flash = profile?.web_ordering_flash_offer;
  const flashOfferActive = flash?.active && flash?.titre && (!flash?.expires_at || new Date(flash.expires_at) > new Date()) ? flash : null;
  const flashActive = !!flashOfferActive;

  const handleAddScratchToCart = (gain) => {
    if (gain.type === 'product') {
      setCart(prevCart => [...prevCart, {
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
      }]);
    } else if (gain.type === 'percentage_discount' || gain.type === 'fixed_discount') {
      const reductionLabel = gain.type === 'percentage_discount'
        ? `Réduction -${gain.reduction_value}%`
        : `Réduction -${gain.reduction_value}€`;
      setCart(prevCart => [...prevCart, {
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
        scratch_discount_value: gain.reduction_value
      }]);
    }
  };

  if (step === 'checkout') {
    return (
      <>
        <OnlineCheckout
          cart={cart}
          orderType={orderType}
          tenant={tenant}
          profile={profile}
          onBack={() => setStep('browse')}
          onSuccess={() => { setCart([]); setStep('confirmation'); }}
          onCartChange={setCart}
          offers={siteOffers}
          products={products}
        />
        <HomeButton />
      </>
    );
  }

  if (step === 'browse') {
    return (
      <>
        <OnlineProductBrowser
          products={products}
          menus={menus}
          categories={categories}
          profile={profile}
          orderType={orderType}
          cart={cart}
          onCartChange={setCart}
          onCheckout={() => setStep('checkout')}
          onBack={() => setStep('order_type')}
          flashOffer={flashOfferActive}
          ingredientsByProduct={ingredientsByProduct}
          optionGroups={optionGroups}
          optionItems={optionItems}
          allProductIngredients={productIngredients}
          allIngredients={ingredientsList}
          tenantId={tenant?.id}
          onAddScratchToCart={handleAddScratchToCart}
          offers={siteOffers}
        />
        <HomeButton />
      </>
    );
  }

  // Step: order_type
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bloc offre flash en grand */}
      {flashActive && (
        <div
          className="relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #b45309 100%)` }}
        >
          {/* Décorations de fond */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white transform translate-x-20 -translate-y-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white transform -translate-x-16 translate-y-16"></div>
          </div>
          <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="w-7 h-7 text-yellow-300 animate-bounce" />
              <span className="text-yellow-300 font-bold text-lg uppercase tracking-widest">Offre Flash</span>
              <Zap className="w-7 h-7 text-yellow-300 animate-bounce" />
            </div>
            <h2 className="text-white font-extrabold text-3xl md:text-4xl mb-2 drop-shadow">
              {flashOfferActive.titre}
            </h2>
            {flashOfferActive.description && (
              <p className="text-white text-opacity-90 text-lg mb-1">{flashOfferActive.description}</p>
            )}
            {flashOfferActive.expires_at && <FlashCountdown expiresAt={flashOfferActive.expires_at} primaryColor={primaryColor} />}
          </div>
        </div>
      )}
      {/* Codes promo & offres */}
      <WebPromoBanner tenantId={tenant?.id} primaryColor={primaryColor} />

      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          {profile.logo_url && (
            <img src={profile.logo_url} alt={profile.nom_etablissement} className="w-16 h-16 object-contain rounded-full border" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.nom_etablissement}</h1>
            {profile.adresse && (
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 flex-shrink-0" /> {profile.adresse}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Comment souhaitez-vous commander ?</h2>
        <p className="text-gray-400 text-sm text-center mb-8">Choisissez votre mode de commande</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
          <button
            onClick={() => { setOrderType('emporter'); setStep('browse'); }}
            className="bg-white rounded-2xl p-8 shadow-sm border-2 border-transparent hover:shadow-md transition-all text-left group"
            style={{ borderColor: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = primaryColor}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div className="text-4xl mb-4">🥡</div>
            <h3 className="text-lg font-bold text-gray-900">À emporter</h3>
            <p className="text-gray-500 text-sm mt-1">Venez récupérer votre commande au restaurant</p>
          </button>

          {profile.manages_deliveries !== false && (
            <button
              onClick={() => { setOrderType('livraison'); setStep('browse'); }}
              className="bg-white rounded-2xl p-8 shadow-sm border-2 border-transparent hover:shadow-md transition-all text-left group"
              onMouseEnter={e => e.currentTarget.style.borderColor = primaryColor}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div className="text-4xl mb-4">🛵</div>
              <h3 className="text-lg font-bold text-gray-900">Livraison</h3>
              <p className="text-gray-500 text-sm mt-1">
                {(() => {
                  const fee = profile.web_frais_livraison_enabled !== false
                    ? (profile.web_frais_livraison ?? profile.frais_livraison ?? 0)
                    : 0;
                  return fee > 0 ? `Frais : ${fee}€` : 'Livraison gratuite';
                })()}
                {profile.montant_minimum_livraison > 0 ? ` · Min. ${profile.montant_minimum_livraison}€` : ''}
              </p>
            </button>
          )}
        </div>

        {profile.telephone && (
          <div className="mt-10 text-center text-gray-400 text-sm">
            <Phone className="w-4 h-4 inline mr-1" />
            Nous contacter : <a href={`tel:${profile.telephone}`} className="font-medium" style={{ color: primaryColor }}>{profile.telephone}</a>
          </div>
        )}
      </div>
      <HomeButton />
    </div>
  );
}
