import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, Play } from 'lucide-react';
import WebPromoBanner from '../online/WebPromoBanner';
import ProductIngredientsButton from './ProductIngredientsButton';
import { getWebPrice } from '../online/OnlineProductBrowser';

function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let videoId = null;
    if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v');
      if (!videoId && u.pathname.includes('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1]?.split('?')[0];
      }
    } else if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.split('/')[1]?.split('?')[0];
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=1`;
    }
  } catch (e) {
    console.warn('Invalid video URL:', url, e);
  }
  return null;
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' };

const MAX_PRODUCTS = 12;

function sortByFeaturedThenOrder(list) {
  return [...list].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
  });
}

const DEFAULT_MESSAGES = [
  { titre: "Bienvenue chez nous 👋", sous_titre: "Découvrez nos spécialités du moment" },
  { titre: "Commandez en ligne 🛵", sous_titre: "Livraison rapide à domicile ou à emporter" },
  { titre: "Nos incontournables ⭐", sous_titre: "Les plats préférés de nos clients" },
];

function HeroSlideshow({ images, primaryColor, nom, messages }) {
  const [current, setCurrent] = useState(0);
  const [textVisible, setTextVisible] = useState(true);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % images.length);
        setTextVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  if (!images || images.length === 0) return null;

  const slideMessages = (messages && messages.length > 0) ? messages : DEFAULT_MESSAGES;
  const msg = slideMessages[current % slideMessages.length];

  return (
    <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-2xl mb-6 bg-gray-100">
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      ))}

      {/* Texte animé */}
      <div
        className="absolute bottom-8 left-6 right-6 z-10 transition-all duration-500"
        style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <p className="text-white font-extrabold text-xl md:text-2xl drop-shadow-lg">{msg.titre}</p>
        <p className="text-white/80 text-sm mt-1 drop-shadow">{msg.sous_titre}</p>
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplateBrasserie({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
  const allSorted = sortByFeaturedThenOrder(products);
  const filtered = allSorted.filter(p => p.featured).slice(0, MAX_PRODUCTS);
  const horaires = profile.web_ordering_horaires || profile.horaires;

  const customHeroImages = profile.site_hero_images?.filter(Boolean) || [];
  const heroSource = profile.site_hero_source || (customHeroImages.length > 0 ? 'custom' : 'products');
  const featuredProductImages = products.filter(p => p.featured && p.image_url).slice(0, 5).map(p => p.image_url);
  const heroImages = heroSource === 'products'
    ? (featuredProductImages.length > 0 ? featuredProductImages : customHeroImages)
    : (customHeroImages.length > 0 ? customHeroImages : featuredProductImages);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b shadow-sm px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {profile.logo_url && <img src={profile.logo_url} alt="" className="h-9 w-9 rounded-full object-contain" />}
          <span className="font-bold text-gray-900">{profile.nom_etablissement}</span>
        </div>
        <a href={orderUrl} className="px-4 py-1.5 rounded-full text-white text-sm font-semibold" style={{ backgroundColor: primaryColor }}>Commander</a>
      </header>

      <div className="flex flex-1">
        {/* LEFT SIDEBAR desktop */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 bg-white border-r border-stone-200 sticky top-0 h-screen overflow-y-auto p-8">
          <div className="mb-8 text-center">
            {profile.logo_url && <img src={profile.logo_url} alt="" className="w-24 h-24 rounded-full object-contain border-4 mx-auto mb-4 shadow" style={{ borderColor: primaryColor }} />}
            {profile.site_subtitle && <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-0.5">{profile.site_subtitle}</p>}
            <h1 className="text-xl font-bold text-gray-900">{profile.nom_etablissement}</h1>
            {(profile.adresse || profile.ville) && <p className="text-gray-400 text-xs flex items-center justify-center gap-1 mt-1"><MapPin className="w-3 h-3" />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
          </div>
          <a href={orderUrl} className="block text-center py-3 rounded-xl text-white font-semibold mb-6 hover:opacity-90 transition text-sm" style={{ backgroundColor: primaryColor }}>
            <ShoppingBag className="w-4 h-4 inline mr-2" />Commander
          </a>
          <div className="space-y-3 text-sm text-gray-600">
            {profile.telephone && <a href={`tel:${profile.telephone}`} className="flex items-center gap-2 hover:text-gray-900"><Phone className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />{profile.telephone}</a>}
          </div>
          {horaires && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horaires</p>
              <div className="space-y-1.5 text-xs">
                {JOURS.map(j => horaires[j] && (
                  <div key={j} className="flex justify-between">
                    <span className="text-gray-400">{JOURS_LABELS[j]}</span>
                    <span className="font-medium text-gray-800">{horaires[j]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />

          <div className="p-6 lg:p-10">
            <HeroSlideshow images={heroImages} primaryColor={primaryColor} nom={profile.nom_etablissement} messages={profile.site_hero_messages} />

            {profile.site_video_url && (
              <div className="mb-10 max-w-2xl mx-auto">
                {getYoutubeEmbedUrl(profile.site_video_url) ? (
                  <div className="relative w-full rounded-2xl shadow-2xl bg-black" style={{ paddingBottom: '56.25%', overflow: 'hidden' }}>
                    <iframe
                      src={getYoutubeEmbedUrl(profile.site_video_url)}
                      className="absolute inset-0 w-full h-full border-0"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={profile.site_video_titre || 'Vidéo'}
                      style={{ display: 'block' }}
                    />
                  </div>
                ) : (
                  <video src={profile.site_video_url} className="w-full rounded-2xl shadow-2xl" controls playsInline />
                )}
              </div>
            )}

            <h2 className="text-2xl font-bold text-gray-900 mb-6">⭐ Nos incontournables</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map(product => {
                const hasSizes = product.size_prices?.length > 0 || product.size_prix_par_mode?.length > 0;
                let price;
                if (getWebPrice) {
                  const sizes = product.size_prices?.length > 0 ? product.size_prices.map(s => s.size)
                              : product.size_prix_par_mode?.length > 0 ? product.size_prix_par_mode.map(s => s.size)
                              : null;
                  if (sizes?.length > 0) {
                    const prices = sizes.map(size => getWebPrice(product, flashOffer, size)).filter(p => p > 0);
                    price = prices.length > 0 ? Math.min(...prices) : 0;
                  } else {
                    price = getWebPrice(product, flashOffer);
                  }
                } else {
                  price = (product.web_price ?? product.base_price) || product.size_prices?.[0]?.price;
                }
                return (
                  <a href={orderUrl} key={product.id} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-stone-100 transition-all hover:-translate-y-1 flex flex-col">
                    <div className="h-48 overflow-hidden relative bg-white">
                      {product.featured && <div className="absolute top-2 left-2 z-10 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Vedette</div>}
                      {product.image_url
                        ? <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-105 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                        : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: product.color || '#f5f5f4' }}>🍽️</div>
                      }
                      {price != null && <span className="absolute top-3 right-3 text-sm font-bold text-white px-3 py-1 rounded-full shadow" style={{ backgroundColor: primaryColor }}>{Number(price).toFixed(2)}€</span>}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="font-bold text-gray-900 flex-1">{product.nom}</p>
                        <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} />
                      </div>
                      {product.description && <p className="text-xs text-gray-500 flex-1 line-clamp-2">{product.description}</p>}
                      <div className="mt-3 text-xs font-semibold text-center py-2 rounded-xl transition hover:opacity-80" style={{ color: primaryColor, border: `1.5px solid ${primaryColor}` }}>
                        Ajouter au panier →
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="text-center mt-6 pb-4">
            <a href={orderUrl} className="px-8 py-3 rounded-full text-white font-semibold hover:opacity-90 transition inline-block" style={{ backgroundColor: primaryColor }}>
              Voir la carte complète ({products.length} produits)
            </a>
          </div>

          <footer className="text-white text-center py-10 mt-4" style={{ backgroundColor: primaryColor }}>
            <p className="font-extrabold text-2xl mb-1">{profile.nom_etablissement}</p>
            {(profile.adresse || profile.ville) && <p className="text-white/70 text-sm mb-5">{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
            <a href={orderUrl} className="inline-block px-8 py-3 bg-white rounded-full font-bold hover:scale-105 transition" style={{ color: primaryColor }}>Commander maintenant</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
