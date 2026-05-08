import { appClient } from '@/api/appClient';
import { fetchTenantSyncSnapshot, shouldRefreshKioskCatalog } from '@/lib/kioskCatalogCache';

const PUBLIC_SITE_CACHE_VERSION = 1;
const PUBLIC_SITE_CACHE_PREFIX = 'public_site_catalog_cache';

export const PUBLIC_SITE_TENANT_FIELDS = ['id', 'slug'];

export const PUBLIC_SITE_PROFILE_FIELDS = [
  'id',
  'tenant_id',
  'nom_etablissement',
  'adresse',
  'ville',
  'telephone',
  'logo_url',
  'horaires',
  'site_template',
  'site_primary_color',
  'site_subtitle',
  'site_hero_images',
  'site_hero_source',
  'site_hero_messages',
  'site_video_url',
  'site_video_titre',
  'custom_domain',
  'kiosk_primary_color',
  'web_ordering_flash_offer',
  'web_ordering_horaires',
  'updated_date',
  'created_date',
];

export const PUBLIC_SITE_CATALOG_FIELDS = {
  products: ['id', 'tenant_id', 'category_id', 'nom', 'description', 'image_url', 'image_display', 'disponible', 'prix', 'base_price', 'size_prices', 'prix_par_mode', 'size_prix_par_mode', 'web_price', 'web_size_prices', 'updated_date', 'created_date'],
  categories: ['id', 'tenant_id', 'parent_id', 'nom', 'disponible', 'color', 'image_url', 'image_display', 'updated_date', 'created_date'],
  productIngredients: ['id', 'tenant_id', 'product_id', 'ingredient_id', 'updated_date', 'created_date'],
  ingredients: ['id', 'tenant_id', 'nom', 'updated_date', 'created_date'],
};

const getCacheKey = (tenantId) => `${PUBLIC_SITE_CACHE_PREFIX}:${tenantId}:v${PUBLIC_SITE_CACHE_VERSION}`;

export const readPublicSiteCatalogCache = (tenantId) => {
  if (!tenantId) return null;
  try {
    const raw = window.localStorage.getItem(getCacheKey(tenantId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('[PublicSiteCache] Lecture cache impossible:', error);
    return null;
  }
};

export const writePublicSiteCatalogCache = (tenantId, payload) => {
  if (!tenantId) return;
  try {
    window.localStorage.setItem(getCacheKey(tenantId), JSON.stringify(payload));
  } catch (error) {
    console.error('[PublicSiteCache] Ecriture cache impossible:', error);
  }
};

export const createPublicSiteCachePayload = (tenantId, data, syncSnapshot) => ({
  version: PUBLIC_SITE_CACHE_VERSION,
  tenantId,
  savedAt: new Date().toISOString(),
  syncSnapshot,
  data,
});

export const fetchPublicSiteCatalog = async (tenantId) => {
  const [products, categories, productIngredients, ingredients] = await Promise.all([
    appClient.entities.Product.filter({ tenant_id: tenantId, disponible: true }, undefined, undefined, { fields: PUBLIC_SITE_CATALOG_FIELDS.products }),
    appClient.entities.Category.filter({ tenant_id: tenantId, disponible: true }, undefined, undefined, { fields: PUBLIC_SITE_CATALOG_FIELDS.categories }),
    appClient.entities.ProductIngredient.filter({ tenant_id: tenantId }, undefined, undefined, { fields: PUBLIC_SITE_CATALOG_FIELDS.productIngredients }),
    appClient.entities.Ingredient.filter({ tenant_id: tenantId }, undefined, undefined, { fields: PUBLIC_SITE_CATALOG_FIELDS.ingredients }),
  ]);

  return {
    products: products || [],
    categories: categories || [],
    productIngredients: productIngredients || [],
    ingredients: ingredients || [],
  };
};

export const fetchPublicSiteCatalogWithCache = async (tenantId) => {
  const cachedPayload = readPublicSiteCatalogCache(tenantId);
  const remoteSnapshot = await fetchTenantSyncSnapshot(tenantId);

  if (cachedPayload?.data && !shouldRefreshKioskCatalog(cachedPayload.syncSnapshot, remoteSnapshot)) {
    return cachedPayload.data;
  }

  const data = await fetchPublicSiteCatalog(tenantId);
  writePublicSiteCatalogCache(
    tenantId,
    createPublicSiteCachePayload(tenantId, data, remoteSnapshot)
  );

  return data;
};
