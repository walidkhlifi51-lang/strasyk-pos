import { appClient } from '@/api/appClient';

const KIOSK_CACHE_VERSION = 1;
const KIOSK_CACHE_PREFIX = 'kiosk_catalog_cache';

export const KIOSK_PROFILE_FIELDS = [
  'id',
  'tenant_id',
  'manages_kiosk',
  'nom_etablissement',
  'adresse',
  'telephone',
  'logo_url',
  'page_pins',
  'prix_differencies_par_mode',
  'kiosk_primary_color',
  'kiosk_secondary_color',
  'kiosk_welcome_images',
  'kiosk_terminal_welcome_images',
  'kiosk_welcome_message',
  'kiosk_welcome_title_size',
  'kiosk_welcome_title_style',
  'kiosk_card_payment_enabled',
  'updated_date',
  'created_date',
];

const KIOSK_CATALOG_FIELDS = {
  products: ['id', 'tenant_id', 'category_id', 'nom', 'description', 'base_price', 'prix', 'tva', 'disponible', 'image_url', 'image_display', 'prix_par_mode', 'size_prices', 'size_prix_par_mode', 'updated_date', 'created_date'],
  categories: ['id', 'tenant_id', 'parent_id', 'nom', 'disponible', 'color', 'image_url', 'image_display', 'manages_sizes', 'size_template', 'updated_date', 'created_date'],
  menus: ['id', 'tenant_id', 'category_id', 'nom', 'description', 'prix', 'disponible', 'updated_date', 'created_date'],
  optionGroups: ['id', 'tenant_id', 'product_id', 'nom', 'selection_type', 'required', 'min_selections', 'max_selections', 'manages_sizes', 'updated_date', 'created_date'],
  optionItems: ['id', 'tenant_id', 'option_group_id', 'nom', 'price_surcharge', 'size_surcharges', 'updated_date', 'created_date'],
  ingredients: ['id', 'tenant_id', 'nom', 'updated_date', 'created_date'],
  productIngredients: ['id', 'tenant_id', 'product_id', 'ingredient_id', 'retirable', 'updated_date', 'created_date'],
  menuItems: ['id', 'tenant_id', 'menu_formula_id', 'nom_affichage', 'quantite', 'taille_fixe', 'produits_inclus', 'updated_date', 'created_date'],
  offers: ['id', 'tenant_id', 'nom', 'active', 'canaux', 'modes_commande', 'type_condition', 'condition_ids', 'condition_sizes', 'condition_excluded_product_ids', 'quantite_requise', 'type_recompense', 'recompense_ids', 'recompense_sizes', 'recompense_excluded_product_ids', 'quantite_offerte', 'updated_date', 'created_date'],
};

const getCacheKey = (tenantId) => `${KIOSK_CACHE_PREFIX}:${tenantId}:v${KIOSK_CACHE_VERSION}`;

const getLatestTimestamp = (records = []) => {
  return (records || []).reduce((latest, record) => {
    const candidate = record?.updated_date || record?.created_date || null;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return candidate > latest ? candidate : latest;
  }, null);
};

export const readKioskCatalogCache = (tenantId) => {
  if (!tenantId) return null;
  try {
    const raw = window.localStorage.getItem(getCacheKey(tenantId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('[KioskCache] Lecture cache impossible:', error);
    return null;
  }
};

export const writeKioskCatalogCache = (tenantId, payload) => {
  if (!tenantId) return;
  try {
    window.localStorage.setItem(getCacheKey(tenantId), JSON.stringify(payload));
  } catch (error) {
    console.error('[KioskCache] Ecriture cache impossible:', error);
  }
};

const readLatestRecord = async (entityName, tenantId) => {
  try {
    const records = await appClient.entities[entityName].filter(
      { tenant_id: tenantId },
      '-updated_date',
      1,
      { fields: ['updated_date', 'created_date'] }
    );
    return records?.[0]?.updated_date || records?.[0]?.created_date || null;
  } catch (error) {
    const fallbackRecords = await appClient.entities[entityName].filter(
      { tenant_id: tenantId },
      '-created_date',
      1,
      { fields: ['created_date'] }
    );
    return fallbackRecords?.[0]?.created_date || null;
  }
};

export const fetchTenantSyncSnapshot = async (tenantId) => {
  if (!tenantId) return null;

  const versions = await appClient.entities.TenantSyncVersion.filter(
    { tenant_id: tenantId },
    undefined,
    1,
    { fields: ['tenant_id', 'products_version', 'menu_version', 'settings_version', 'updated_at'] }
  );

  if (versions?.[0]) {
    return versions[0];
  }

  const [
    latestProduct,
    latestCategory,
    latestMenu,
    latestOptionGroup,
    latestOptionItem,
    latestIngredient,
    latestProductIngredient,
    latestMenuItem,
    latestOffer,
    latestProfile,
  ] = await Promise.all([
    readLatestRecord('Product', tenantId),
    readLatestRecord('Category', tenantId),
    readLatestRecord('MenuFormula', tenantId),
    readLatestRecord('OptionGroup', tenantId),
    readLatestRecord('OptionItem', tenantId),
    readLatestRecord('Ingredient', tenantId),
    readLatestRecord('ProductIngredient', tenantId),
    readLatestRecord('MenuFormulaItem', tenantId),
    readLatestRecord('Offer', tenantId),
    readLatestRecord('RestaurantProfile', tenantId),
  ]);

  const productsVersion = [latestProduct, latestCategory, latestIngredient, latestProductIngredient].filter(Boolean).sort().slice(-1)[0] || null;
  const menuVersion = [latestMenu, latestMenuItem, latestOptionGroup, latestOptionItem, latestOffer].filter(Boolean).sort().slice(-1)[0] || null;
  const settingsVersion = latestProfile || null;

  return {
    tenant_id: tenantId,
    products_version: productsVersion,
    menu_version: menuVersion,
    settings_version: settingsVersion,
    updated_at: [productsVersion, menuVersion, settingsVersion].filter(Boolean).sort().slice(-1)[0] || null,
  };
};

export const shouldRefreshKioskCatalog = (cachedSnapshot, remoteSnapshot) => {
  if (!cachedSnapshot) return true;
  if (!remoteSnapshot) return false;

  return cachedSnapshot.products_version !== remoteSnapshot.products_version
    || cachedSnapshot.menu_version !== remoteSnapshot.menu_version
    || cachedSnapshot.settings_version !== remoteSnapshot.settings_version;
};

export const fetchKioskCatalog = async (tenantId) => {
  const [
    profiles,
    products,
    categories,
    menus,
    optionGroups,
    optionItems,
    ingredients,
    productIngredients,
    menuItems,
    offers,
  ] = await Promise.all([
    appClient.entities.RestaurantProfile.filter({ tenant_id: tenantId }, undefined, 1, { fields: KIOSK_PROFILE_FIELDS }),
    appClient.entities.Product.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.products }),
    appClient.entities.Category.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.categories }),
    appClient.entities.MenuFormula.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.menus }),
    appClient.entities.OptionGroup.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.optionGroups }),
    appClient.entities.OptionItem.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.optionItems }),
    appClient.entities.Ingredient.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.ingredients }),
    appClient.entities.ProductIngredient.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.productIngredients }),
    appClient.entities.MenuFormulaItem.filter({ tenant_id: tenantId }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.menuItems }),
    appClient.entities.Offer.filter({ tenant_id: tenantId, active: true }, undefined, undefined, { fields: KIOSK_CATALOG_FIELDS.offers }),
  ]);

  return {
    profile: profiles?.[0] || null,
    products: products || [],
    categories: categories || [],
    menus: menus || [],
    optionGroups: optionGroups || [],
    optionItems: optionItems || [],
    ingredients: ingredients || [],
    productIngredients: productIngredients || [],
    menuItems: menuItems || [],
    offersRaw: offers || [],
    syncSnapshot: {
      products_version: getLatestTimestamp([...products, ...categories, ...ingredients, ...productIngredients]),
      menu_version: getLatestTimestamp([...menus, ...menuItems, ...optionGroups, ...optionItems, ...offers]),
      settings_version: profiles?.[0]?.updated_date || profiles?.[0]?.created_date || null,
      updated_at: getLatestTimestamp([
        ...(products || []),
        ...(categories || []),
        ...(ingredients || []),
        ...(productIngredients || []),
        ...(menus || []),
        ...(menuItems || []),
        ...(optionGroups || []),
        ...(optionItems || []),
        ...(offers || []),
        ...(profiles || []),
      ]),
    },
  };
};

export const createKioskCachePayload = (tenantId, data, syncSnapshot) => ({
  version: KIOSK_CACHE_VERSION,
  tenantId,
  savedAt: new Date().toISOString(),
  syncSnapshot,
  data,
});
