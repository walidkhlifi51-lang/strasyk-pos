import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, Clock, ChefHat, Play } from 'lucide-react';
import ProductIngredientsButton from './ProductIngredientsButton';
import { getWebPrice } from '../online/OnlineProductBrowser';
import WebPromoBanner from '../online/WebPromoBanner';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };

const MAX_PRODUCTS = 12;

function sortByFeaturedThenOrder(list) {
  return [...list].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
  });
}

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
    
    console.log('🎥 YouTube ID extracted:', videoId);
    if (videoId) {
      // URL embed YouTube standard avec options
      return `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=1`;
    }
  } catch (e) {
    console.warn('Invalid video URL:', url, e);
  }
  return null;
}

// Vérifie si l'URL est une vidéo directe (mp4, webm, etc.)
function isDirectVideo(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

const DEFAULT_MESSAGES = [
  { titre: "Bienvenue chez nous 👋", sous_titre: "Découvrez nos spécialités du moment" },
  { titre: "Commandez en ligne 🛵", sous_titre: "Livraison rapide à domicile ou à emporter" },
  { titre: "Nos incontournables ⭐", sous_titre: "Les plats préférés de nos clients" },
];

// Slideshow Hero - layout 2 colonnes : image gauche, infos + message droite
function HeroSlideshow({ images, primaryColor, profile, orderUrl, messages }) {
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

  const noImages = !images || images.length === 0;

  return (
    <div className="relative h-80 md:h-[420px] overflow-hidden" style={{ background: 'linear-gradient(160deg, #e5e7eb 0%, #9ca3af 100%)' }}>
      {/* Images slideshow */}
      {!noImages && images.map((img, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === current ? 1 : 0 }}>
          <img src={img} alt="" className="w-full h-full object-contain" />
        </div>
      ))}

      {/* Dots */}
      {images && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
          ))}
        </div>
      )}

      {/* Logo + nom + boutons en bas à gauche */}
      <div className="absolute bottom-8 left-6 z-10">
        {profile.logo_url && (
          <img src={profile.logo_url} alt="" className="w-14 h-14 rounded-full border-4 border-white shadow-xl object-contain mb-2" />
        )}
        {profile.site_subtitle && <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1 drop-shadow">{profile.site_subtitle}</p>}
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1 drop-shadow">{profile.nom_etablissement}</h1>
        {(profile.adresse || profile.ville) && (
          <p className="text-white/80 text-xs flex items-center gap-1 mb-4 drop-shadow"><MapPin className="w-3 h-3" /> {[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <a href={orderUrl} className="flex items-center gap-2 px-6 py-2.5 bg-white rounded-full font-bold text-sm shadow-lg hover:scale-105 transition" style={{ color: primaryColor }}>
            <ShoppingBag className="w-4 h-4" /> Commander maintenant
          </a>
          <a href={orderUrl} className="flex items-center gap-2 px-6 py-2.5 border-2 border-white text-white rounded-full font-bold text-sm hover:bg-white/10 transition">
            <ChefHat className="w-4 h-4" /> Voir la carte
          </a>
        </div>
      </div>

      {/* Message animé en bas à droite */}
      <div
        className="absolute bottom-10 right-6 z-10 text-right transition-all duration-500 max-w-xs"
        style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(6px)' }}
      >
        <p className="text-white font-bold text-lg drop-shadow">{msg.titre}</p>
        {msg.sous_titre && <p className="text-white/80 text-sm mt-0.5 drop-shadow">{msg.sous_titre}</p>}
      </div>
    </div>
  );
}

// Section vidéo
function VideoSection({ videoUrl, titre, primaryColor }) {
  if (!videoUrl) return null;
  const embedUrl = getYoutubeEmbedUrl(videoUrl);
  const directVideo = isDirectVideo(videoUrl);

  console.log('📺 VideoSection Debug:', { 
    videoUrl, 
    embedUrl, 
    directVideo,
    hasEmbedUrl: !!embedUrl,
    hasDirectVideo: !!directVideo
  });

  return (
    <div className="py-8 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto text-center">
        {titre && (
          <div className="flex items-center gap-2 justify-center mb-6">
            <Play className="w-5 h-5" style={{ color: primaryColor }} />
            <h2 className="text-2xl font-bold text-gray-900 text-center">{titre}</h2>
          </div>
        )}
        {/* Affiche la vidéo */}
        {embedUrl ? (
          <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-black" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full border-0"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={titre || 'Vidéo'}
            />
          </div>
        ) : directVideo ? (
          <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl">
            <video
              src={videoUrl}
              className="w-full h-auto"
              controls
              playsInline
            />
          </div>
        ) : (
          <div className="bg-red-100 border border-red-400 p-4 rounded text-red-700 text-center">
            ❌ URL vidéo invalide: {videoUrl}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplateModerne({ profile, products, categories, orderUrl, primaryColor, ingredientsByProduct = {}, flashOffer = null, tenantId }) {
  const [activeCat, setActiveCat] = useState('all');

  // Slideshow : photos personnalisées OU photos des produits vedettes
  const customHeroImages = profile.site_hero_images?.filter(Boolean) || [];
  const heroSource = profile.site_hero_source || (customHeroImages.length > 0 ? 'custom' : 'products');
  const featuredProductImages = products.filter(p => p.featured && p.image_url).slice(0, 5).map(p => p.image_url);
  // Fallback: si products sans images vedettes, utiliser les images custom, et vice versa
  const heroImages = heroSource === 'products'
    ? (featuredProductImages.length > 0 ? featuredProductImages : customHeroImages)
    : (customHeroImages.length > 0 ? customHeroImages : featuredProductImages);
  const videoUrl = profile.site_video_url;
  const videoTitre = profile.site_video_titre || 'Découvrez notre cuisine';

  const allProducts = sortByFeaturedThenOrder(products);
  const featuredProducts = allProducts.filter(p => p.featured);
  // Sur la page vitrine : on affiche UNIQUEMENT les produits vedettes (max 12)
  const displayProducts = featuredProducts.slice(0, MAX_PRODUCTS);
  const horaires = profile.web_ordering_horaires || profile.horaires;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile.logo_url && <img src={profile.logo_url} alt="" className="h-9 w-9 rounded-full object-contain border" />}
            <span className="font-bold text-gray-900">{profile.nom_etablissement}</span>
          </div>
          <a href={orderUrl} className="px-4 py-1.5 rounded-full text-white text-sm font-semibold hover:opacity-90 transition" style={{ backgroundColor: primaryColor }}>
            Commander
          </a>
        </div>
      </nav>

      {/* Promo Banner - juste sous la navbar */}
      <div className="pt-14">
        <WebPromoBanner tenantId={tenantId} primaryColor={primaryColor} />
      </div>

      {/* Hero avec Slideshow */}
      <HeroSlideshow
        images={heroImages}
        primaryColor={primaryColor}
        profile={profile}
        orderUrl={orderUrl}
        messages={profile.site_hero_messages}
      />

      {/* Vidéo (si configurée) */}
      {videoUrl && <VideoSection videoUrl={videoUrl} titre={videoTitre} primaryColor={primaryColor} />}



      {/* Titre section produits */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {featuredProducts.length > 0 ? '⭐ Nos incontournables' : 'Notre carte'}
            </h2>
            {featuredProducts.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">Les produits préférés de nos clients</p>
            )}
          </div>
          <span className="text-sm text-gray-400">{products.length} produits au total</span>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayProducts.map(product => {
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
              <a href={orderUrl} key={product.id} className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all bg-white">
                <div className="h-44 relative overflow-hidden bg-white">
                  {product.featured && <div className="absolute top-2 left-2 z-10 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Vedette</div>}
                  {product.image_url
                    ? <img src={product.image_url} alt={product.nom} className="w-full h-full object-contain group-hover:scale-110 transition duration-500" style={{ mixBlendMode: 'multiply' }} />
                    : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ backgroundColor: product.color || '#f8f8f8' }}>🍽️</div>
                  }
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-gray-900 text-sm truncate flex-1">{product.nom}</p>
                    <ProductIngredientsButton ingredients={ingredientsByProduct[product.id]} />
                  </div>
                  {product.description && <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    {price > 0 && <span className="font-bold text-sm" style={{ color: primaryColor }}>{hasSizes ? 'Dès ' : ''}{Number(price).toFixed(2)}€</span>}
                    <span className="text-xs text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: primaryColor }}>Commander →</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <a href={orderUrl} className="px-8 py-3 rounded-full text-white font-semibold hover:opacity-90 transition inline-block" style={{ backgroundColor: primaryColor }}>
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Voir la carte complète & commander
          </a>
        </div>
      </div>

      {/* Infos */}
      <div className="bg-gray-50 py-14 mt-4">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-2xl font-bold mb-5">Contact</h3>
            <div className="space-y-3 text-gray-600">
              {profile.telephone && <a href={`tel:${profile.telephone}`} className="flex items-center gap-3 hover:text-gray-900 transition"><Phone className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />{profile.telephone}</a>}
              {(profile.adresse || profile.ville) && <p className="flex items-center gap-3"><MapPin className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
            </div>
          </div>
          {horaires && (
            <div>
              <h3 className="text-2xl font-bold mb-5 flex items-center gap-2"><Clock className="w-6 h-6" style={{ color: primaryColor }} />Horaires</h3>
              <div className="space-y-1.5 text-sm">
                {JOURS.map(j => horaires[j] && (
                  <div key={j} className="flex justify-between"><span className="text-gray-500">{JOURS_LABELS[j]}</span><span className="font-medium text-gray-800">{horaires[j]}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-white text-center py-10" style={{ backgroundColor: primaryColor }}>
        <p className="font-extrabold text-2xl mb-1">{profile.nom_etablissement}</p>
        {(profile.adresse || profile.ville) && <p className="text-white/70 text-sm mb-5">{[profile.adresse, profile.ville].filter(Boolean).join(', ')}</p>}
        <a href={orderUrl} className="inline-block px-8 py-3 bg-white rounded-full font-bold hover:scale-105 transition" style={{ color: primaryColor }}>Commander maintenant</a>
      </footer>
    </div>
  );
}
