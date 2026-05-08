import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Zap, Clock, Gift } from 'lucide-react';
import { getWebPrice } from '../components/online/OnlineProductBrowser';
import TemplateModerne from '../components/restaurant-site/TemplateModerne';
import WebPromoBanner from '../components/online/WebPromoBanner';
import TemplateChaleureux from '../components/restaurant-site/TemplateChaleureux';
import TemplateSombre from '../components/restaurant-site/TemplateSombre';
import TemplateBrasserie from '../components/restaurant-site/TemplateBrasserie';
import TemplateGastronomique from '../components/restaurant-site/TemplateGastronomique';
import TemplateStreetFood from '../components/restaurant-site/TemplateStreetFood';
import CagnotteModal from '../components/restaurant-site/CagnotteModal';
import ScratchTicketDisplay from '../components/scratch/ScratchTicketDisplay';
import { buildPublicPageUrl, getPublicHostname, resolvePublicTenantContext } from '@/lib/publicSiteTenant';
import { fetchPublicSiteCatalogWithCache } from '@/lib/publicSiteCatalogCache';

function FlashBanner({ flash, primaryColor }) {
  const [timeLeft, setTimeLeft] = React.useState(null);

  React.useEffect(() => {
    if (!flash?.expires_at) return;
    const calc = () => {
      const diff = new Date(flash.expires_at) - new Date();
      if (diff <= 0) return setTimeLeft(null);
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [flash?.expires_at]);

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="text-white text-center py-3 px-4" style={{ background: `linear-gradient(90deg, ${primaryColor}, #92400e)` }}>
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
          <span className="font-bold">{flash.titre}</span>
          {flash.description && <span className="text-white/80 text-sm hidden sm:inline">- {flash.description}</span>}
        </div>
        {timeLeft && (
          <div className="flex items-center gap-1 text-sm font-mono">
            <Clock className="w-4 h-4" />
            <span className="bg-white/20 px-1.5 py-0.5 rounded">{pad(timeLeft.h)}h</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded">{pad(timeLeft.m)}m</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded">{pad(timeLeft.s)}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RestaurantSite() {
  const [showCagnotteModal, setShowCagnotteModal] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const currentHostname = getPublicHostname();

  const { data: siteContext, isLoading: loadingTenant } = useQuery({
    queryKey: ['site-tenant-context', slug, currentHostname],
    queryFn: () => resolvePublicTenantContext({ slug, hostname: currentHostname }),
    staleTime: 5 * 60 * 1000,
  });

  const tenant = siteContext?.tenant;
  const profile = siteContext?.profile;

  const { data: siteCatalog } = useQuery({
    queryKey: ['site-catalog', tenant?.id],
    queryFn: () => fetchPublicSiteCatalogWithCache(tenant?.id),
    enabled: !!tenant?.id,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
    staleTime: 110000,
  });

  const products = siteCatalog?.products || [];
  const categories = siteCatalog?.categories || [];
  const productIngredients = siteCatalog?.productIngredients || [];
  const ingredients = siteCatalog?.ingredients || [];

  if (loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!slug && !tenant && !loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Restaurant introuvable pour ce domaine.</p>
      </div>
    );
  }

  if (!tenant || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Restaurant introuvable.</p>
      </div>
    );
  }

  const primaryColor = profile.site_primary_color || profile.kiosk_primary_color || '#f97316';
  const orderUrl = buildPublicPageUrl('OrderOnline', {
    slug: tenant?.slug,
    customDomain: siteContext?.resolvedBy === 'domain' ? siteContext?.customDomain : null,
  });
  const flash = profile.web_ordering_flash_offer;
  const flashActive = flash?.active && flash?.titre && (!flash?.expires_at || new Date(flash.expires_at) > new Date());

  const ingredientsByProduct = productIngredients.reduce((acc, pi) => {
    const ing = ingredients.find((i) => i.id === pi.ingredient_id);
    if (ing) {
      if (!acc[pi.product_id]) acc[pi.product_id] = [];
      acc[pi.product_id].push(ing.nom);
    }
    return acc;
  }, {});

  const templateProps = {
    profile,
    products,
    categories,
    orderUrl,
    primaryColor,
    ingredientsByProduct,
    flashOffer: flash,
    getWebPrice,
    tenantId: tenant?.id,
  };

  const renderTemplate = () => {
    switch (profile.site_template) {
      case 'chaleureux': return <TemplateChaleureux {...templateProps} />;
      case 'sombre': return <TemplateSombre {...templateProps} />;
      case 'brasserie': return <TemplateBrasserie {...templateProps} />;
      case 'gastronomique': return <TemplateGastronomique {...templateProps} />;
      case 'streetfood': return <TemplateStreetFood {...templateProps} />;
      default: return <TemplateModerne {...templateProps} />;
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowCagnotteModal(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full text-white font-bold shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center gap-2"
        style={{ backgroundColor: primaryColor }}
        title="Consulter ma cagnotte"
      >
        <Gift className="w-6 h-6" />
      </button>

      {flashActive && <FlashBanner flash={flash} primaryColor={primaryColor} />}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <ScratchTicketDisplay
          tenantId={tenant?.id}
          displayOn="site_home"
          onAddToCart={(gain) => {
            if (gain.type === 'product') {
              const scratchGift = {
                product_id: gain.product_id,
                product_nom: gain.product_nom,
                quantite: gain.quantite || 1,
                timestamp: Date.now(),
              };
              sessionStorage.setItem('scratch_gift_pending', JSON.stringify(scratchGift));
              alert(`Felicitation ! Vous avez gagne : ${gain.product_nom}\n\nCe cadeau sera automatiquement ajoute a votre panier lors de votre prochaine commande.`);
            } else if (gain.type === 'percentage_discount' || gain.type === 'fixed_discount') {
              const scratchDiscount = {
                type: gain.type,
                reduction_value: gain.reduction_value,
                timestamp: Date.now(),
              };
              sessionStorage.setItem('scratch_discount_pending', JSON.stringify(scratchDiscount));
              const reductionLabel = gain.type === 'percentage_discount'
                ? `${gain.reduction_value}% de reduction`
                : `${gain.reduction_value}EUR de reduction`;
              alert(`Felicitation ! Vous avez gagne : ${reductionLabel}\n\nCette reduction sera automatiquement appliquee lors de votre prochaine commande.`);
            }
          }}
          primaryColor={primaryColor}
          profile={profile}
        />
      </div>

      {renderTemplate()}

      <CagnotteModal
        isOpen={showCagnotteModal}
        onClose={() => setShowCagnotteModal(false)}
        tenantSlug={tenant?.id}
        primaryColor={primaryColor}
      />
    </div>
  );
}
