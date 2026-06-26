import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, Euro } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { getSupabaseBrowserClient } from '@/api/supabase/client';

const PROFILE_FIELDS = [
  'id',
  'tenant_id',
  'nom_etablissement',
  'adresse',
  'telephone',
  'logo_url',
  'customer_display_enabled',
  'customer_display_images',
  'customer_display_color',
  'customer_display_info_message',
];

const CART_FIELDS = [
  'id',
  'tenant_id',
  'cart_data',
  'updated_at',
];

const DISPLAY_FALLBACK_MS = 60000;
const DISPLAY_HEARTBEAT_MS = 30000;
const DISPLAY_HEARTBEAT_PREFIX = 'customer_display_active';
const DISPLAY_LIVE_CART_PREFIX = 'customer_display_live_cart';

const getDisplayHeartbeatKey = (tenantId) => `${DISPLAY_HEARTBEAT_PREFIX}:${tenantId || 'global'}`;
const getDisplayLiveCartKey = (tenantId) => `${DISPLAY_LIVE_CART_PREFIX}:${tenantId || 'global'}`;

const toDisplaySettings = (profile) => ({
  images: Array.isArray(profile?.customer_display_images) ? profile.customer_display_images : [],
  enabled: profile?.customer_display_enabled ?? true,
  primary_color: profile?.customer_display_color || '#f97316',
  info_message: profile?.customer_display_info_message || '',
});

export default function CustomerDisplay() {
  const tenantId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tenant');
  }, []);

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
  const fallbackIntervalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();
    const heartbeatKey = getDisplayHeartbeatKey(tenantId);

    const writeHeartbeat = () => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(heartbeatKey, String(Date.now()));
    };

    const clearHeartbeat = () => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(heartbeatKey);
    };

    const applyProfile = (nextProfile) => {
      if (!isMounted || !nextProfile) return;
      setProfile(nextProfile);
      setDisplaySettings(toDisplaySettings(nextProfile));
    };

    const applyCart = (nextCart) => {
      if (!isMounted) return;
      setCartData(nextCart?.cart_data || null);
    };

    const applyLiveCartPayload = (payload) => {
      if (!isMounted || !payload) return;
      const payloadTenantId = payload.tenantId || null;
      if ((tenantId || null) !== payloadTenantId) return;
      setCartData(payload.cartData || null);
    };

    const loadProfile = async () => {
      const profiles = tenantId
        ? await appClient.entities.RestaurantProfile.filter(
            { tenant_id: tenantId },
            null,
            1,
            { fields: PROFILE_FIELDS }
          )
        : await appClient.entities.RestaurantProfile.list(null, 1, { fields: PROFILE_FIELDS });

      applyProfile(profiles?.[0] || null);
      return profiles?.[0] || null;
    };

    const loadCart = async () => {
      const carts = tenantId
        ? await appClient.entities.CustomerDisplayCart.filter(
            { tenant_id: tenantId },
            '-updated_at',
            1,
            { fields: CART_FIELDS }
          )
        : await appClient.entities.CustomerDisplayCart.list('-updated_at', 1, { fields: CART_FIELDS });

      applyCart(carts?.[0] || null);
      return carts?.[0] || null;
    };

    const loadInitialData = async () => {
      try {
        await Promise.all([loadProfile(), loadCart()]);
      } catch (error) {
        console.error('[CustomerDisplay] Error loading data:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const stopFallbackRefresh = () => {
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    const startFallbackRefresh = () => {
      if (fallbackIntervalRef.current) return;
      fallbackIntervalRef.current = window.setInterval(() => {
        loadProfile().catch((error) => {
          console.error('[CustomerDisplay] Profile fallback refresh failed:', error);
        });
        loadCart().catch((error) => {
          console.error('[CustomerDisplay] Cart fallback refresh failed:', error);
        });
      }, DISPLAY_FALLBACK_MS);
    };

    const handleVisibilityRefresh = () => {
      writeHeartbeat();
      if (document.visibilityState === 'visible') {
        loadProfile().catch((error) => {
          console.error('[CustomerDisplay] Profile refresh on visibility failed:', error);
        });
        loadCart().catch((error) => {
          console.error('[CustomerDisplay] Cart refresh on visibility failed:', error);
        });
      }
    };

    const handleStorageLiveUpdate = (event) => {
      if (event.key !== getDisplayLiveCartKey(tenantId)) return;
      if (!event.newValue) {
        applyLiveCartPayload({ tenantId, cartData: null });
        return;
      }

      try {
        applyLiveCartPayload(JSON.parse(event.newValue));
      } catch (error) {
        console.error('[CustomerDisplay] Invalid live cart payload:', error);
      }
    };

    loadInitialData();
    writeHeartbeat();
    const heartbeatIntervalId = window.setInterval(writeHeartbeat, DISPLAY_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    window.addEventListener('storage', handleStorageLiveUpdate);

    let liveChannel = null;
    if ('BroadcastChannel' in window) {
      liveChannel = new BroadcastChannel(`customer-display-live-${tenantId || 'global'}`);
      liveChannel.onmessage = (event) => applyLiveCartPayload(event.data);
    }

    const profileChannel = supabase
      .channel(`customer-display-profile-${tenantId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_profiles',
          ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (isMounted) {
              setProfile(null);
              setDisplaySettings(toDisplaySettings(null));
            }
            return;
          }

          applyProfile(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') stopFallbackRefresh();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startFallbackRefresh();
      });

    const cartChannel = supabase
      .channel(`customer-display-cart-${tenantId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_display_cart',
          ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (isMounted) setCartData(null);
            return;
          }

          applyCart(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') stopFallbackRefresh();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startFallbackRefresh();
      });

    return () => {
      isMounted = false;
      window.clearInterval(heartbeatIntervalId);
      stopFallbackRefresh();
      clearHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      window.removeEventListener('storage', handleStorageLiveUpdate);
      liveChannel?.close?.();
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(cartChannel);
    };
  }, [tenantId]);

  useEffect(() => {
    if (!displaySettings.images || displaySettings.images.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % displaySettings.images.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [displaySettings.images]);

  const hasItems = cartData?.articles?.length > 0;

  const calculateTotals = () => {
    if (!cartData?.articles) return { items: [], total: 0 };

    const items = cartData.articles.map((item) => ({
      ...item,
      total_ligne: (item.prix_final_unitaire || item.prix_unitaire || 0) * item.quantite,
      options: item.selected_options || item.options || [],
      exclusions: item.excluded_ingredients || item.exclusions || [],
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
          <p className="text-2xl font-semibold">Chargement de l'ecran client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col overflow-hidden">
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
              <p className="text-lg opacity-90">Telephone: {profile.telephone}</p>
            )}
          </div>
        </div>
        {profile?.adresse && (
          <div className="text-white text-right">
            <p className="text-lg">{profile.adresse}</p>
          </div>
        )}
      </div>

      {displaySettings.info_message && (
        <div className="w-full flex-shrink-0 bg-gradient-to-r from-yellow-50 to-orange-50 px-8 py-4 border-b-2 border-orange-200">
          <p className="text-xl font-semibold text-gray-800 text-center">
            {displaySettings.info_message}
          </p>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
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
                  />
                </div>
              ))}

              {displaySettings.images.length > 1 && (
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3">
                  {displaySettings.images.map((_, index) => (
                    <div
                      key={index}
                      className={`h-3 rounded-full transition-all shadow-lg ${
                        index === currentImageIndex ? 'w-12' : 'w-3 bg-gray-300'
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

        <div
          className="w-1/2 bg-white flex flex-col shadow-2xl border-l-4 min-h-0 overflow-hidden"
          style={{ borderLeftColor: displaySettings.primary_color }}
        >
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
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div
                          className="text-2xl font-bold text-white px-4 py-2 rounded-full shadow-lg"
                          style={{ backgroundColor: displaySettings.primary_color }}
                        >
                          x{item.quantite}
                        </div>
                      </div>
                    </div>

                    {item.options && item.options.length > 0 && (
                      <div className="mt-3 space-y-2 bg-green-50 p-3 rounded-lg">
                        {item.options.map((opt, i) => (
                          <div key={i} className="text-base text-green-800 flex items-center gap-2 font-medium">
                            <span className="text-green-600 text-xl">+</span>
                            <span>{opt.nom}</span>
                            {opt.price_surcharge > 0 && (
                              <span className="text-green-600 ml-auto">+{opt.price_surcharge.toFixed(2)}EUR</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.exclusions && item.exclusions.length > 0 && (
                      <div className="mt-3 space-y-2 bg-red-50 p-3 rounded-lg">
                        {item.exclusions.map((exc, i) => (
                          <div key={i} className="text-base text-red-700 flex items-center gap-2 font-medium">
                            <span className="text-xl">-</span>
                            <span>Sans {exc.nom}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t-2 border-gray-200 flex justify-end">
                      <span className="text-3xl font-bold" style={{ color: displaySettings.primary_color }}>
                        {item.total_ligne.toFixed(2)}EUR
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="flex-shrink-0 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden"
                style={{ backgroundColor: displaySettings.primary_color }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <div className="text-2xl font-semibold mb-2">Total a payer</div>
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
