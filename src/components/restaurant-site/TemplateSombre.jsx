import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, Star, Play } from 'lucide-react';
import ProductIngredientsButton from './ProductIngredientsButton';
import { getWebPrice } from '../online/OnlineProductBrowser';
import WebPromoBanner from '../online/WebPromoBanner';

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

function HeroSlideshow({ images, primaryColor, profile, messages }) {
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

  const slideMessages = (messages && messages.length > 0) ? messages : DEFAULT_MESSAGES;
  const msg = slideMessages[current % slideMessages.length];

  if (!images || images.length === 0) {
    return (
      <div className="pt-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at 70% 50%, ${primaryColor}, transparent 70%)` }} />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 flex flex-col items-start">
          {profile.logo_url && <img src={profile.logo_url} alt="" className="w-20 h-20 rounded-full border-2 mb-6 object-contain" style={{ borderColor: primaryColor }} />}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-2 tracking-tight">{profile.nom_etablissement}</h1>
          {(profile.adresse || profile.ville) && <p className="text-white/40 text-sm flex items-center gap-1 mb-10"><MapPin className="w-3.5 h-3.5" />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
          <div className="flex flex-wrap gap-4">
            <a href="#" className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm transition hover:scale-105 hover:opacity-90" style={{ backgroundColor: primaryColor }}><ShoppingBag className="w-4 h-4" /> Commander</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 relative h-80 md:h-[420px] overflow-hidden">
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain bg-gray-900" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }} />
        </div>
      ))}
      <div className="absolute bottom-10 left-6 right-6 z-10 transition-all duration-500" style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(10px)' }}>
        <p className="text-white font-extrabold text-xl md:text-2xl drop-shadow-lg">{msg.titre}</p>
        <p className="text-white/70 text-sm mt-1 drop-shadow">{msg.sous_titre}</p>
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      )}
    </div>
  );
}

export default function TemplateSombre({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
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
    <div className="min-h-screen" style={{ backgroundColor: '#0f172a', color: 'white' }}>
      {/* Navbar dark */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10" style={{ backgroundColor: '#0f172a' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile.logo_url && <img src={profile.logo_url} alt="" className="h-8 w-8 rounded-full object-contain" />}
            <div>
            <span className="font-bold text-white tracking-wider">{profile.nom_etablissement}</span>
            {profile.site_subtitle && <p className="text-white/40 text-xs uppercase tracking-widest">{profile.site_subtitle}</p>}
          </div>
          </div>
          <a href={orderUrl} className="px-4 py-1.5 rounded-full text-sm font-bold border transition hover:text-white hover:bg-opacity-20" style={{ borderColor: primaryColor, color: primaryColor }}>
            Commander
          </a>
        </div>
      </nav>

      {/* Promo Banner - fond sombre */}
      <div style={{ backgroundColor: '#0f172a' }}>
        <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />
      </div>

      <HeroSlideshow images={heroImages} primaryColor={primaryColor} profile={profile} messages={profile.site_hero_messages} />

      {profile.site_video_url && (
        <div className="py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            {profile.site_video_titre && (
              <div className="flex items-center gap-2 mb-6">
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

      {/* Products dark */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-white mb-6">⭐ Nos incontournables</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <a
                href={orderUrl}
                key={product.id}
                className="group rounded-2xl overflow-hidden border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl"
                style={{ backgroundColor: '#1e293b' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primaryColor; e.currentTarget.style.boxShadow = `0 20px 40px ${primaryColor}30`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="h-44 overflow-hidden relative bg-white">
                 <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: primaryColor }} />
                 {product.featured && <div className="absolute top-3 left-2 z-20 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Vedette</div>}
                 {product.image_url
                   ? <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-105 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                   : <div className="w-full h-full flex items-center justify-center text-5xl opacity-40" style={{ backgroundColor: '#020617' }}>🍽️</div>
                 }
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-white text-sm truncate flex-1">{product.nom}</p>
                    <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} darkMode />
                  </div>
                  {product.description && <p className="text-xs text-gray-500 truncate mt-0.5">{product.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    {price != null && <span className="font-bold text-sm" style={{ color: primaryColor }}>{Number(price).toFixed(2)}€</span>}
                    <Star className="w-4 h-4 text-gray-600 group-hover:text-yellow-400 transition" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div className="text-center pb-10">
        <a href={orderUrl} className="px-8 py-3 rounded-full font-semibold hover:opacity-90 transition inline-block" style={{ backgroundColor: primaryColor, color: 'white' }}>
          Voir la carte complète ({products.length} produits)
        </a>
      </div>

      {/* Infos dark */}
      <div className="border-t border-white/10 py-14">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-xl font-bold mb-5 text-white">Contact</h3>
            <div className="space-y-3 text-gray-400">
              {profile.telephone && <a href={`tel:${profile.telephone}`} className="flex items-center gap-3 hover:text-white transition"><Phone className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />{profile.telephone}</a>}
              {(profile.adresse || profile.ville) && <p className="flex items-center gap-3"><MapPin className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
            </div>
          </div>
          {horaires && (
            <div>
              <h3 className="text-xl font-bold mb-5 text-white flex items-center gap-2"><Clock className="w-5 h-5" style={{ color: primaryColor }} />Horaires</h3>
              <div className="space-y-2 text-sm">
                {JOURS.map(j => horaires[j] && (
                  <div key={j} className="flex justify-between text-gray-400">
                    <span>{JOURS_LABELS[j]}</span>
                    <span className="text-white">{horaires[j]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer dark */}
      <footer className="border-t border-white/10 py-10 text-center" style={{ backgroundColor: '#020617' }}>
        <p className="text-2xl font-extrabold text-white mb-1">{profile.nom_etablissement}</p>
        {(profile.adresse || profile.ville) && <p className="text-gray-600 text-sm mb-5">{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
        <a href={orderUrl} className="inline-block px-8 py-3 rounded-full font-bold text-sm transition hover:scale-105 hover:opacity-90" style={{ backgroundColor: primaryColor }}>
          Commander maintenant
        </a>
      </footer>
    </div>
  );
}
