import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, Play } from 'lucide-react';
import WebPromoBanner from '../online/WebPromoBanner';
import ProductIngredientsButton from './ProductIngredientsButton';
import { getWebPrice } from '../online/OnlineProductBrowser';

// Convertit une URL YouTube en URL embed
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
    <div className="relative w-full h-56 md:h-72 overflow-hidden">
      {images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain bg-amber-50" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        </div>
      ))}
      <div className="absolute bottom-6 left-6 right-6 z-10 transition-all duration-500" style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(10px)' }}>
        <p className="text-white font-extrabold text-lg md:text-xl drop-shadow-lg">{msg.titre}</p>
        <p className="text-white/80 text-sm mt-0.5 drop-shadow">{msg.sous_titre}</p>
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
        </div>
      )}
    </div>
  );
}

export default function TemplateChaleureux({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
  const allSorted = sortByFeaturedThenOrder(products);
  const featuredProducts = allSorted.filter(p => p.featured);
  const displayProducts = featuredProducts.slice(0, MAX_PRODUCTS);
  const horaires = profile.web_ordering_horaires || profile.horaires;

  const customHeroImages = profile.site_hero_images?.filter(Boolean) || [];
  const heroSource = profile.site_hero_source || (customHeroImages.length > 0 ? 'custom' : 'products');
  const featuredProductImages = products.filter(p => p.featured && p.image_url).slice(0, 5).map(p => p.image_url);
  const heroImages = heroSource === 'products'
    ? (featuredProductImages.length > 0 ? featuredProductImages : customHeroImages)
    : (customHeroImages.length > 0 ? customHeroImages : featuredProductImages);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fdf6ec', fontFamily: "'Georgia', serif" }}>
      {/* Header centré */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center">
          {profile.logo_url && (
            <img src={profile.logo_url} alt="" className="w-24 h-24 rounded-full object-contain border-4 mx-auto mb-4 shadow-md" style={{ borderColor: primaryColor }} />
          )}
          {profile.site_subtitle && <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">{profile.site_subtitle}</p>}
          <h1 className="text-4xl font-bold text-gray-900 mb-1">{profile.nom_etablissement}</h1>
          {(profile.adresse || profile.ville) && (
            <p className="text-gray-400 text-sm flex items-center justify-center gap-1 mb-5"><MapPin className="w-3.5 h-3.5" />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>
          )}
          <a href={orderUrl} className="inline-flex items-center gap-2 px-10 py-3.5 rounded-full text-white font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition" style={{ backgroundColor: primaryColor }}>
            <ShoppingBag className="w-5 h-5" /> Commander en ligne
          </a>
        </div>
      </header>

      <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />

      <HeroSlideshow images={heroImages} primaryColor={primaryColor} messages={profile.site_hero_messages} />

      {/* Vidéo */}
      {profile.site_video_url && (
        <div className="py-8 px-4 bg-white">
          <div className="max-w-2xl mx-auto text-center">
            {profile.site_video_titre && (
              <div className="flex items-center gap-2 justify-center mb-6">
                <Play className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="text-2xl font-bold text-gray-900 text-center">{profile.site_video_titre}</h2>
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

      {/* Séparateur décoratif */}
      <div className="flex items-center justify-center py-4">
        <div className="h-px w-16 bg-amber-200"></div>
        <div className="mx-3 text-2xl">🍴</div>
        <div className="h-px w-16 bg-amber-200"></div>
      </div>

      {/* Products - style magazine */}
      <div className="max-w-5xl mx-auto px-6 py-6 pb-16">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900">⭐ Nos incontournables</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
           {displayProducts.map((product, index) => {
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
               <a href={orderUrl} key={product.id} className="group rounded-3xl overflow-hidden bg-white shadow-md hover:shadow-2xl transition-all hover:-translate-y-1">
                <div className="relative overflow-hidden bg-white h-48">
                  {product.featured && <div className="absolute top-2 left-2 z-10 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Vedette</div>}
                  {product.image_url
                    ? <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-105 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                    : <div className="w-full h-full flex items-center justify-center text-6xl" style={{ backgroundColor: product.color || '#fde8cc' }}>🍽️</div>
                  }
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xl font-bold text-gray-900 flex-1">{product.nom}</h4>
                    <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} />
                  </div>
                  {product.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
                  <div className="flex items-center justify-between mt-4">
                    {price != null && <span className="text-2xl font-bold" style={{ color: primaryColor }}>{Number(price).toFixed(2)}€</span>}
                    <span className="text-sm px-4 py-1.5 rounded-full text-white font-medium" style={{ backgroundColor: primaryColor }}>Voir →</span>
                  </div>
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
      </div>

      {/* Infos */}
      <div className="bg-white border-t border-amber-100 py-14">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-10">
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold mb-5 text-gray-900">Nous trouver</h3>
            <div className="space-y-3 text-gray-600">
              {profile.telephone && <a href={`tel:${profile.telephone}`} className="flex items-center gap-3 justify-center md:justify-start hover:text-gray-900 transition"><Phone className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />{profile.telephone}</a>}
              {(profile.adresse || profile.ville) && <p className="flex items-center gap-3 justify-center md:justify-start"><MapPin className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
            </div>
          </div>
          {horaires && (
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-5 text-gray-900 flex items-center gap-2 justify-center md:justify-start">
                <Clock className="w-6 h-6" style={{ color: primaryColor }} />Horaires
              </h3>
              <div className="space-y-2 text-sm">
                {JOURS.map(j => horaires[j] && (
                  <div key={j} className="flex justify-between max-w-xs mx-auto md:mx-0">
                    <span className="text-gray-500">{JOURS_LABELS[j]}</span>
                    <span className="font-medium text-gray-800">{horaires[j]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-10 border-t border-amber-100" style={{ backgroundColor: '#fff8f0' }}>
        <p className="text-2xl font-bold text-gray-900 mb-1">{profile.nom_etablissement}</p>
        {(profile.adresse || profile.ville) && <p className="text-gray-400 text-sm mb-5">{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
        <a href={orderUrl} className="inline-block px-10 py-3.5 rounded-full text-white font-semibold hover:scale-105 transition" style={{ backgroundColor: primaryColor }}>
          Commander maintenant
        </a>
      </footer>
    </div>
  );
}
