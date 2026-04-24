import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, Flame, Play } from 'lucide-react';
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

function HeroSlideshow({ images, messages }) {
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
    <div className="relative w-full h-56 md:h-72 overflow-hidden">
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain bg-gray-900" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
      ))}
      <div className="absolute bottom-6 left-6 right-6 z-10 transition-all duration-500" style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(10px)' }}>
        <p className="text-white font-black text-xl md:text-2xl drop-shadow-lg">{msg.titre}</p>
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

export default function TemplateStreetFood({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile.logo_url
            ? <img src={profile.logo_url} alt="" className="h-10 w-10 rounded-full object-contain border-2" style={{ borderColor: primaryColor }} />
            : <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}><Flame className="w-5 h-5 text-white" /></div>
          }
          <div>
            <p className="font-black text-white leading-none">{profile.nom_etablissement}</p>
            <p className="text-xs opacity-50">{profile.site_subtitle || 'Street Food'}</p>
          </div>
        </div>
        <a href={orderUrl} className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition" style={{ backgroundColor: primaryColor }}>
          <ShoppingBag className="w-4 h-4" /> Commander
        </a>
      </header>

      <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />

      <HeroSlideshow images={heroImages} messages={profile.site_hero_messages} />

      {profile.site_video_url && (
        <div className="py-8 px-4 bg-gray-900">
          <div className="max-w-2xl mx-auto text-center">
            {profile.site_video_titre && (
              <div className="flex items-center gap-2 justify-center mb-6">
                <Play className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="text-2xl font-bold text-white">{profile.site_video_titre}</h2>
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

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* LEFT: Products grid */}
        <main className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-white mb-6">⭐ Nos incontournables</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <a href={orderUrl} key={product.id} className="group bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all hover:scale-[1.02]">
                  <div className="h-44 overflow-hidden relative bg-white">
                    {product.featured && <div className="absolute top-2 left-2 z-10 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Vedette</div>}
                    {product.image_url
                      ? <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-110 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                      : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: product.color || '#1f2937' }}>🍔</div>
                    }
                    {price != null && <span className="absolute bottom-3 right-3 text-sm font-black text-white px-3 py-1 rounded-full" style={{ backgroundColor: primaryColor }}>{Number(price).toFixed(2)}€</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-white text-base flex-1">{product.nom}</p>
                      <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} darkMode />
                    </div>
                    {product.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>+ Ajouter</span>
                      <span className="text-xs text-gray-600">→</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
          <div className="text-center mt-6">
            <a href={orderUrl} className="px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 transition inline-block" style={{ backgroundColor: primaryColor, color: 'white' }}>
              Voir la carte complète ({products.length} produits)
            </a>
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden lg:block w-60 xl:w-72 flex-shrink-0">
          <div className="sticky top-24 space-y-5">
            <a href={orderUrl} className="block text-center font-black py-4 rounded-2xl text-white hover:opacity-90 transition text-sm uppercase tracking-wider" style={{ backgroundColor: primaryColor }}>
              🔥 Commander maintenant
            </a>

            {(profile.telephone || profile.adresse || horaires) && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3 text-sm">
                {profile.telephone && <a href={`tel:${profile.telephone}`} className="flex items-center gap-2 text-gray-400 hover:text-white"><Phone className="w-4 h-4" style={{ color: primaryColor }} />{profile.telephone}</a>}
                {(profile.adresse || profile.ville) && <p className="flex items-start gap-2 text-gray-400"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
                {horaires && (
                  <div>
                    <p className="text-xs font-bold mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" style={{ color: primaryColor }} /> Horaires</p>
                    {JOURS.map(j => horaires[j] && (
                      <div key={j} className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-600">{JOURS_LABELS[j]}</span>
                        <span className="text-gray-400">{horaires[j]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
