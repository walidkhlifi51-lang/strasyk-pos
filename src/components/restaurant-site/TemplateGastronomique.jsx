import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, ChefHat, Play } from 'lucide-react';
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
const JOURS_LABELS = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };

const MAX_PRODUCTS = 12;
const DEFAULT_MESSAGES = [
  { titre: "Bienvenue chez nous 👋", sous_titre: "Découvrez nos spécialités du moment" },
  { titre: "Commandez en ligne 🛵", sous_titre: "Livraison rapide à domicile ou à emporter" },
  { titre: "Nos incontournables ⭐", sous_titre: "Les plats préférés de nos clients" },
];

function sortByFeaturedThenOrder(list) {
  return [...list].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
  });
}

function HeroSlideshow({ images, primaryColor, messages }) {
  const [current, setCurrent] = useState(0);
  const [textVisible, setTextVisible] = useState(true);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => { setCurrent(prev => (prev + 1) % images.length); setTextVisible(true); }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  if (!images || images.length === 0) return null;

  const slideMessages = (messages && messages.length > 0) ? messages : DEFAULT_MESSAGES;
  const msg = slideMessages[current % slideMessages.length];

  return (
    <div className="relative w-full h-56 md:h-64 overflow-hidden">
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain bg-gray-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        </div>
      ))}
      <div className="absolute bottom-6 left-6 right-6 z-10 transition-all duration-500" style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(10px)' }}>
        <p className="text-white font-light text-xl md:text-2xl tracking-wide drop-shadow-lg">{msg.titre}</p>
        <p className="text-white/70 text-sm mt-0.5 drop-shadow">{msg.sous_titre}</p>
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      )}
    </div>
  );
}

export default function TemplateGastronomique({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
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
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header style={{ background: `linear-gradient(135deg, #1a1a1a 0%, ${primaryColor} 100%)` }} className="py-16 px-6 text-center text-white">
        {profile.logo_url && (
          <img src={profile.logo_url} alt="" className="w-20 h-20 rounded-full border-4 border-white/30 object-contain mx-auto mb-4" />
        )}
        <p className="text-sm font-light uppercase tracking-[0.3em] opacity-70 mb-2">{profile.site_subtitle || 'Restaurant'}</p>
        <h1 className="text-4xl md:text-6xl font-thin tracking-widest mb-3">{profile.nom_etablissement}</h1>
        {(profile.adresse || profile.ville) && (
          <p className="text-sm opacity-60 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}
          </p>
        )}
        <a href={orderUrl} className="mt-6 inline-flex items-center gap-2 px-8 py-3 border border-white/60 rounded-full text-sm font-light hover:bg-white/10 transition">
          <ChefHat className="w-4 h-4" /> Voir la carte & Commander
        </a>
      </header>

      <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />

      <HeroSlideshow images={heroImages} primaryColor={primaryColor} messages={profile.site_hero_messages} />

      {profile.site_video_url && (
        <div className="py-8 px-4 bg-gray-50">
          <div className="max-w-2xl mx-auto text-center">
            {profile.site_video_titre && (
              <div className="flex items-center gap-2 justify-center mb-6">
                <Play className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="text-2xl font-bold text-gray-900">{profile.site_video_titre}</h2>
              </div>
            )}
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
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12 flex gap-10">
        {/* LEFT: Products list */}
        <main className="flex-1 min-w-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-wide">⭐ Nos incontournables</h2>
          <div className="space-y-4">
            {filtered.map(product => {
              let price;
              if (getWebPrice) {
                const sizes = product.size_prices?.length > 0 ? product.size_prices.map(s => s.size)
                            : product.size_prix_par_mode?.length > 0 ? product.size_prix_par_mode.map(s => s.size)
                            : null;
                if (sizes && sizes.length > 0) {
                  const prices = sizes.map(size => getWebPrice(product, flashOffer, size)).filter(p => p > 0);
                  price = prices.length > 0 ? Math.min(...prices) : 0;
                } else {
                  price = getWebPrice(product, flashOffer);
                }
              } else {
                price = (product.web_price ?? product.base_price) || product.size_prices?.[0]?.price;
              }
              return (
                <a href={orderUrl} key={product.id} className="group flex gap-5 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all p-4">
                  {product.image_url ? (
                    <div className="w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-white">
                      <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-110 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                    </div>
                  ) : (
                    <div className="w-28 h-28 flex-shrink-0 rounded-xl flex items-center justify-center text-4xl" style={{ backgroundColor: product.color || '#f3f4f6' }}>🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">
                        {product.featured && <span className="text-amber-400 mr-1">⭐</span>}
                        {product.nom}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} />
                        {price != null && <span className="text-lg font-bold" style={{ color: primaryColor }}>{Number(price).toFixed(2)}€</span>}
                      </div>
                    </div>
                    {product.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
                    <span className="mt-3 inline-block text-xs font-semibold px-4 py-1.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>
                      Commander →
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <a href={orderUrl} className="px-8 py-3 rounded-full text-white font-semibold hover:opacity-90 transition inline-block" style={{ backgroundColor: primaryColor }}>
              Voir la carte complète ({products.length} produits)
            </a>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
          <div className="sticky top-8 space-y-5">
            <a href={orderUrl} className="block text-center text-white font-semibold py-4 rounded-2xl shadow-lg hover:opacity-90 transition" style={{ backgroundColor: primaryColor }}>
              <ShoppingBag className="w-5 h-5 inline mr-2" />Commander maintenant
            </a>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Informations</p>
              {profile.telephone && (
                <a href={`tel:${profile.telephone}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                  <Phone className="w-4 h-4" style={{ color: primaryColor }} />{profile.telephone}
                </a>
              )}
              {(profile.adresse || profile.ville) && (
                <p className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            {horaires && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Horaires
                </p>
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
          </div>
        </aside>
      </div>

      <footer className="border-t py-10 text-center text-gray-500 text-sm">
        <p className="font-light tracking-widest text-2xl text-gray-900 mb-1">{profile.nom_etablissement}</p>
        {(profile.adresse || profile.ville) && <p className="text-xs mb-5">{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
        <a href={orderUrl} className="text-white px-8 py-3 rounded-full inline-block text-sm font-semibold hover:opacity-90" style={{ backgroundColor: primaryColor }}>Commander</a>
      </footer>
    </div>
  );
}
