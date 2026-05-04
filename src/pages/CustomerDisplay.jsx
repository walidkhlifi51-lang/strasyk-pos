import React, { useState, useEffect } from 'react';
import { ShoppingCart, Euro } from 'lucide-react';
import { appClient } from '@/api/appClient';

export default function CustomerDisplay() {
  console.log('🎯🎯🎯 CUSTOMER DISPLAY COMPONENT LOADED 🎯🎯🎯');
  
  const [cartData, setCartData] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState({
    images: [],
    enabled: true,
    primary_color: '#f97316',
    info_message: '',
  });
  const [profile, setProfile] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  
  console.log('🎯 État initial:', { cartData, isLoading, displaySettings });

  useEffect(() => {
    console.log('📺 [CustomerDisplay] Initialisation...');
    
    // Charger le tenant_id depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const tenant = urlParams.get('tenant');
    if (tenant) {
      setTenantId(tenant);
      console.log('📺 [CustomerDisplay] Tenant ID:', tenant);
    }
    
    // Charger les paramètres et le panier initial
    const loadData = async () => {
      try {
        console.log('📺 [CustomerDisplay] Loading data...');
        
        // Récupérer le profil du bon tenant
        const profiles = tenant 
          ? await appClient.entities.RestaurantProfile.filter({ tenant_id: tenant })
          : await appClient.entities.RestaurantProfile.list();
        
        console.log('📺 [CustomerDisplay] Profiles récupérés:', profiles.length);
        const profile = profiles?.[0];
        console.log('📺 [CustomerDisplay] Profil sélectionné - ID:', profile?.id);
        console.log('📺 [CustomerDisplay] customer_display_enabled:', profile?.customer_display_enabled);
        console.log('📺 [CustomerDisplay] customer_display_images TYPE:', typeof profile?.customer_display_images, 'IS_ARRAY:', Array.isArray(profile?.customer_display_images));
        console.log('📺 [CustomerDisplay] customer_display_images VALUE:', profile?.customer_display_images);
        
        if (profile) {
          const images = Array.isArray(profile.customer_display_images) ? profile.customer_display_images : [];
          const settings = {
            images: images,
            enabled: profile.customer_display_enabled || false,
            primary_color: profile.customer_display_color || '#f97316',
            info_message: profile.customer_display_info_message || '',
          };
          setDisplaySettings(settings);
          setProfile(profile);
          console.log('📺 [CustomerDisplay] Settings loaded:', {
            enabled: settings.enabled,
            images_count: settings.images.length,
            images: settings.images,
            primary_color: settings.primary_color
          });
          
          // Charger le panier initial
          const carts = tenant 
            ? await appClient.entities.CustomerDisplayCart.filter({ tenant_id: tenant })
            : await appClient.entities.CustomerDisplayCart.list();
          
          const currentCart = carts?.[0];
          if (currentCart?.cart_data) {
            console.log('📺 [CustomerDisplay] Panier initial chargé:', currentCart.cart_data.articles?.length || 0, 'articles');
            setCartData(currentCart.cart_data);
          } else {
            console.log('📺 [CustomerDisplay] Aucun panier initial');
          }
        } else {
          console.log('⚠️ [CustomerDisplay] Aucun profil trouvé');
        }
      } catch (error) {
        console.error('❌ [CustomerDisplay] Error loading data:', error);
      }
      setIsLoading(false);
    };

    loadData();
    
    // Recharger les settings périodiquement
    const dataInterval = setInterval(loadData, 30000);
    
    // S'abonner aux changements du panier en temps réel
    const unsubscribe = appClient.entities.CustomerDisplayCart.subscribe((event) => {
      console.log('📡 [CustomerDisplay] Event reçu:', event.type);
      if (event.type === 'create' || event.type === 'update') {
        const newCart = event.data?.cart_data;
        console.log('📺 [CustomerDisplay] Mise à jour panier:', newCart?.articles?.length || 0, 'articles');
        setCartData(newCart);
      }
    });
    
    return () => {
      clearInterval(dataInterval);
      unsubscribe();
    };
  }, []);

  // Carrousel d'images
  useEffect(() => {
    if (!displaySettings.images || displaySettings.images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % displaySettings.images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [displaySettings.images]);

  const hasItems = cartData?.articles?.length > 0;

  // Calculer les totaux si nécessaire
  const calculateTotals = () => {
    if (!cartData?.articles) return { items: [], total: 0 };
    
    const items = cartData.articles.map(item => ({
      ...item,
      total_ligne: (item.prix_final_unitaire || item.prix_unitaire || 0) * item.quantite,
      options: item.selected_options || item.options || [],
      exclusions: item.excluded_ingredients || item.exclusions || []
    }));

    const total = items.reduce((sum, item) => sum + item.total_ligne, 0);
    return { items, total };
  };

  const { items: displayItems, total: totalAmount } = hasItems ? calculateTotals() : { items: [], total: 0 };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-2xl font-semibold">Chargement de l'écran client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col overflow-hidden">
      {/* Header avec infos restaurant */}
      <div 
        className="w-full h-24 flex-shrink-0 flex items-center justify-between px-8 shadow-lg"
        style={{ backgroundColor: displaySettings.primary_color }}
      >
        <div className="flex items-center gap-6">
          {profile?.logo_url && (
            <img 
              src={profile.logo_url} 
              alt="Logo" 
              className="h-16 w-16 object-contain bg-white rounded-lg p-1"
            />
          )}
          <div className="text-white">
            <h1 className="text-3xl font-bold">{profile?.nom_etablissement || 'Restaurant'}</h1>
            {profile?.telephone && (
              <p className="text-lg opacity-90">📞 {profile.telephone}</p>
            )}
          </div>
        </div>
        {profile?.adresse && (
          <div className="text-white text-right">
            <p className="text-lg">{profile.adresse}</p>
          </div>
        )}
      </div>

      {/* Message informatif */}
      {displaySettings.info_message && (
        <div className="w-full flex-shrink-0 bg-gradient-to-r from-yellow-50 to-orange-50 px-8 py-4 border-b-2 border-orange-200">
          <p className="text-xl font-semibold text-gray-800 text-center">
            {displaySettings.info_message}
          </p>
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Images promotionnelles - Côté gauche */}
      <div className="w-1/2 relative bg-white flex items-center justify-center overflow-hidden">
        {displaySettings.images && displaySettings.images.length > 0 ? (
          <div className="w-full h-full relative">
            {displaySettings.images.map((img, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={img}
                  alt={`Promo ${index + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.error('❌ Image load error:', img);
                  }}
                  onLoad={() => {
                    console.log('✅ Image loaded:', img);
                  }}
                />
              </div>
            ))}

            {displaySettings.images.length > 1 && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3">
                {displaySettings.images.map((_, index) => (
                  <div
                    key={index}
                    className={`h-3 rounded-full transition-all shadow-lg ${
                      index === currentImageIndex
                        ? 'w-12'
                        : 'w-3 bg-gray-300'
                    }`}
                    style={index === currentImageIndex ? { backgroundColor: displaySettings.primary_color } : {}}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-300">
            <ShoppingCart className="w-32 h-32 mx-auto mb-6 opacity-20" />
            <p className="text-2xl font-semibold">Bienvenue</p>
            <p className="text-lg mt-2 opacity-60">En attente de commande...</p>
          </div>
        )}
      </div>

      {/* Panier - Côté droit */}
      <div className="w-1/2 bg-white flex flex-col shadow-2xl border-l-4 min-h-0 overflow-hidden" style={{ borderLeftColor: displaySettings.primary_color }}>
          <div 
            className="h-24 flex-shrink-0 flex items-center justify-center text-white shadow-lg relative"
            style={{ backgroundColor: displaySettings.primary_color }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <ShoppingCart className="w-9 h-9 mr-4 relative z-10" />
            <h2 className="text-4xl font-bold relative z-10">Votre commande</h2>
          </div>

          {hasItems ? (
            <div className="flex-1 flex flex-col p-6 min-h-0">
              {/* Liste des articles */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {displayItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-white to-gray-50 rounded-2xl p-5 shadow-lg border-l-4 hover:shadow-xl transition-shadow"
                    style={{ borderLeftColor: displaySettings.primary_color }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">
                          {item.nom_produit}
                        </h3>
                        {item.notes && (
                          <p className="text-base text-gray-600 bg-yellow-50 px-3 py-1 rounded-lg inline-block mt-1">
                            💬 {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div 
                          className="text-2xl font-bold text-white px-4 py-2 rounded-full shadow-lg"
                          style={{ backgroundColor: displaySettings.primary_color }}
                        >
                          ×{item.quantite}
                        </div>
                      </div>
                    </div>

                    {/* Options */}
                    {item.options && item.options.length > 0 && (
                      <div className="mt-3 space-y-2 bg-green-50 p-3 rounded-lg">
                        {item.options.map((opt, i) => (
                          <div key={i} className="text-base text-green-800 flex items-center gap-2 font-medium">
                            <span className="text-green-600 text-xl">✓</span>
                            <span>{opt.nom}</span>
                            {opt.price_surcharge > 0 && (
                              <span className="text-green-600 ml-auto">+{opt.price_surcharge.toFixed(2)}€</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Exclusions */}
                    {item.exclusions && item.exclusions.length > 0 && (
                      <div className="mt-3 space-y-2 bg-red-50 p-3 rounded-lg">
                        {item.exclusions.map((exc, i) => (
                          <div key={i} className="text-base text-red-700 flex items-center gap-2 font-medium">
                            <span className="text-xl">✗</span>
                            <span>Sans {exc.nom}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prix ligne */}
                    <div className="mt-4 pt-3 border-t-2 border-gray-200 flex justify-end">
                      <span className="text-3xl font-bold" style={{ color: displaySettings.primary_color }}>
                        {item.total_ligne.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div 
                className="flex-shrink-0 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden"
                style={{ backgroundColor: displaySettings.primary_color }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <div className="text-2xl font-semibold mb-2">Total à payer</div>
                    <div className="text-base opacity-90 bg-white/20 px-3 py-1 rounded-full inline-block">
                      {displayItems.reduce((sum, item) => sum + item.quantite, 0)} article(s)
                    </div>
                  </div>
                  <div className="text-7xl font-bold flex items-center drop-shadow-lg">
                    {totalAmount.toFixed(2)}
                    <Euro className="w-14 h-14 ml-3" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
              <div className="text-center text-gray-400">
                <div className="bg-gray-100 rounded-full w-40 h-40 flex items-center justify-center mx-auto mb-6">
                  <ShoppingCart className="w-24 h-24 opacity-30" />
                </div>
                <p className="text-4xl font-bold mb-3">Panier vide</p>
                <p className="text-2xl opacity-60">En attente de commande...</p>
              </div>
            </div>
          )}
      </div>
      </div>
    </div>
  );
}
