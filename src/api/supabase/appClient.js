import { getSupabaseBrowserClient } from '@/api/supabase/client';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';

const ENTITY_TABLE_MAP = {
  Tenant: 'tenants',
  RestaurantProfile: 'restaurant_profiles',
  Reseller: 'resellers',
  ResellerUser: 'reseller_users',
  ResellerBranding: 'reseller_branding',
  ResellerPricingRule: 'reseller_pricing_rules',
  ResellerTenant: 'reseller_tenants',
  ResellerCommission: 'reseller_commissions',
  ResellerPayout: 'reseller_payouts',
  UserAccess: 'user_access',
  PlatformAdminAccess: 'platform_admin_access',
  DeliveryPerson: 'delivery_people',
  Category: 'categories',
  Product: 'products',
  Table: 'tables',
  Customer: 'customers',
  Order: 'orders',
  Offer: 'offers',
  LoyaltyRule: 'loyalty_rules',
  CagnotteRule: 'cagnotte_rules',
  CagnotteHistory: 'cagnotte_history',
  PromoCode: 'promo_codes',
  MenuFormula: 'menu_formulas',
  MenuFormulaItem: 'menu_formula_items',
  ClotureCaisse: 'cloture_caisse',
  DrawerOpening: 'drawer_openings',
  CustomerDisplayCart: 'customer_display_cart',
  SiteConfig: 'site_config',
  ScratchTicketConfig: 'scratch_ticket_config',
  InscriptionRequest: 'inscription_requests',
  TenantInvoice: 'tenant_invoices',
};

const notReady = (scope) => {
  throw new Error(`Mode Supabase non finalise pour ${scope}.`);
};

const toSnakeCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[\s-]+/g, '_')
  .toLowerCase();

const resolveTableName = (entityName) => {
  if (ENTITY_TABLE_MAP[entityName]) return ENTITY_TABLE_MAP[entityName];
  const snake = toSnakeCase(entityName);
  return snake.endsWith('s') ? snake : `${snake}s`;
};

const normalizeFilterArgs = (sort, limit) => {
  if (typeof sort === 'number') return { sort: null, limit: sort };
  return { sort, limit };
};

const missingFieldsWarnings = new Set();
const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const LEGACY_ENTITY_FIELDS = {
  Tenant: ['id', 'nom_commercial', 'owner_email', 'active', 'subscription_plan', 'pos_suspended', 'slug', 'created_date', 'updated_date'],
  RestaurantProfile: [
    'id', 'tenant_id', 'nom_etablissement', 'adresse', 'ville', 'telephone', 'logo_url', 'horaires',
    'custom_domain', 'site_template', 'site_primary_color', 'site_subtitle', 'site_hero_images',
    'site_hero_source', 'site_hero_messages', 'site_video_url', 'site_video_titre', 'kiosk_primary_color',
    'customer_display_enabled', 'customer_display_images', 'customer_display_color', 'customer_display_info_message',
    'delivery_app_allowed', 'manages_delivery_app', 'manages_kiosk', 'manages_table_plan', 'table_plan_allowed',
    'manages_web_ordering', 'impression_auto', 'impression_bouton_visible', 'impression_double', 'page_pins',
    'tva_rates', 'prix_differencies_par_mode', 'kiosk_welcome_images', 'kiosk_terminal_welcome_images',
    'kiosk_welcome_message', 'kiosk_welcome_title_size', 'kiosk_welcome_title_style', 'kiosk_card_payment_enabled',
    'web_ordering_flash_offer', 'web_ordering_horaires', 'scratch_tickets_enabled', 'updated_date', 'created_date',
  ],
  DeliveryPerson: ['id', 'tenant_id', 'user_email', 'username', 'password', 'nom', 'prenom', 'telephone', 'vehicule', 'disponible', 'app_access_enabled', 'en_livraison', 'nb_livraisons_jour', 'total_encaisse', 'created_date', 'updated_date'],
  Category: ['id', 'tenant_id', 'parent_id', 'nom', 'disponible', 'color', 'image_url', 'image_display', 'manages_sizes', 'size_template', 'sort_order', 'created_date', 'updated_date'],
  Product: ['id', 'tenant_id', 'category_id', 'nom', 'description', 'disponible', 'temps_preparation', 'tva', 'image_url', 'image_display', 'color', 'featured', 'sort_order', 'prix', 'base_price', 'size_prices', 'prix_par_mode', 'size_prix_par_mode', 'web_price', 'web_size_prices', 'created_date', 'updated_date'],
  Table: ['id', 'tenant_id', 'nom', 'capacite', 'forme', 'statut', 'order_id', 'position_x', 'position_y', 'zone', 'created_date', 'updated_date'],
  Customer: ['id', 'tenant_id', 'nom', 'prenom', 'telephone', 'email', 'adresse', 'code_postal', 'ville', 'etage', 'interphone', 'adresses', 'cagnotte_balance', 'created_date', 'updated_date'],
  Order: ['id', 'tenant_id', 'numero_commande', 'numero_caisse', 'type_commande', 'customer_id', 'customer_name', 'table_id', 'delivery_person_id', 'delivery_address', 'articles', 'total_ht', 'total_tva', 'total_ttc', 'statut', 'mode_paiement', 'mode_paiement_prevu', 'numero_bipeur', 'numero_table', 'payee', 'notes', 'cagnotte_spent', 'scratch_reduction', 'print_at_counter', 'from_kiosk', 'from_web', 'created_date', 'updated_date'],
  Offer: ['id', 'tenant_id', 'nom', 'type', 'active', 'condition_type', 'condition_product_ids', 'condition_category_ids', 'condition_quantity', 'condition_sizes', 'reward_type', 'reward_product_ids', 'reward_category_ids', 'reward_quantity', 'reward_sizes', 'reduction_value', 'canaux', 'modes_commande', 'updated_date', 'created_date'],
  LoyaltyRule: ['id', 'tenant_id', 'nom', 'active', 'type', 'points_required', 'discount_amount', 'discount_percent', 'product_ids', 'category_ids', 'canaux', 'created_date', 'updated_date'],
  CagnotteRule: ['id', 'tenant_id', 'nom', 'active', 'type', 'value', 'min_order_total', 'canaux', 'accumulation_rate', 'created_date', 'updated_date'],
  CagnotteHistory: ['id', 'tenant_id', 'customer_id', 'order_id', 'type', 'amount', 'balance_before', 'balance_after', 'created_date', 'updated_date'],
  PromoCode: ['id', 'tenant_id', 'code', 'active', 'type', 'value', 'description', 'expires_at', 'usage_limit', 'usage_count', 'canaux', 'modes_commande', 'created_date', 'updated_date'],
  MenuFormula: ['id', 'tenant_id', 'category_id', 'nom', 'description', 'prix', 'tva', 'disponible', 'created_date', 'updated_date'],
  MenuFormulaItem: ['id', 'tenant_id', 'menu_formula_id', 'nom_affichage', 'quantite', 'taille_fixe', 'produits_inclus', 'created_date', 'updated_date'],
  ClotureCaisse: ['id', 'tenant_id', 'date_cloture', 'statut', 'montant_theorique', 'montant_reel', 'ecarts', 'created_by', 'notes', 'created_date', 'updated_date'],
  DrawerOpening: ['id', 'tenant_id', 'amount', 'reason', 'created_by', 'created_date', 'updated_date'],
  CustomerDisplayCart: ['id', 'tenant_id', 'cart_data', 'updated_at', 'created_date', 'updated_date'],
  SiteConfig: ['id', 'tenant_id', 'key', 'value', 'created_date', 'updated_date'],
  ScratchTicketConfig: ['id', 'tenant_id', 'active', 'display_on', 'winning_mode', 'winning_product_id', 'winning_product_nom', 'reduction_value', 'updated_date', 'created_date'],
  InscriptionRequest: ['id', 'nom_commercial', 'prenom_contact', 'nom_contact', 'email', 'adresse', 'telephone', 'formule_choisie', 'statut', 'message', 'created_date', 'updated_date'],
  TenantInvoice: ['id', 'tenant_id', 'numero_facture', 'montant', 'tva_taux', 'type', 'description', 'date_facturation', 'date_paiement', 'statut', 'metadata', 'is_devis', 'materiel', 'lignes_materiel', 'periode_debut', 'periode_fin', 'monthly_payments', 'created_date', 'updated_date'],
  UserAccess: ['id', 'tenant_id', 'user_email', 'role', 'is_active', 'created_date', 'updated_date'],
  PlatformAdminAccess: ['id', 'user_email', 'is_active', 'created_date', 'updated_date'],
  Reseller: ['id', 'nom', 'email', 'telephone', 'status', 'created_date', 'updated_date'],
  ResellerUser: ['id', 'reseller_id', 'user_email', 'role', 'is_active', 'created_date', 'updated_date'],
  ResellerBranding: ['id', 'reseller_id', 'name', 'logo_url', 'created_date', 'updated_date'],
  ResellerPricingRule: ['id', 'reseller_id', 'type', 'value', 'created_date', 'updated_date'],
  ResellerTenant: ['id', 'reseller_id', 'tenant_id', 'status', 'created_date', 'updated_date'],
  ResellerCommission: ['id', 'reseller_id', 'tenant_id', 'status', 'montant', 'created_date', 'updated_date'],
  ResellerPayout: ['id', 'reseller_id', 'status', 'montant', 'created_date', 'updated_date'],
};

const UNIQUE_SELECT_FIELDS = (fields = []) => [...new Set(fields.filter(Boolean))];
const MINIMAL_WRITE_RETURN_FIELDS = ['id', 'tenant_id', 'created_date', 'updated_date'];
const MINIMAL_BULK_WRITE_RETURN_FIELDS = ['id', 'tenant_id', 'created_date', 'updated_date'];
const resolveLegacyFields = (entityName) => UNIQUE_SELECT_FIELDS([
  ...(LEGACY_ENTITY_FIELDS[entityName] || []),
  'id',
  'tenant_id',
  'created_date',
  'updated_date',
]);

const normalizeSelectFields = (fields, contextKey = 'unknown', entityName = 'unknown') => {
  if (!fields) {
    if (!missingFieldsWarnings.has(contextKey) && typeof console !== 'undefined') {
      missingFieldsWarnings.add(contextKey);
      const fallbackFields = resolveLegacyFields(entityName);
      const warning = `[appClient] Missing fields for ${contextKey}; using legacy projection (${fallbackFields.join(', ')}).`;
      if (isDev) console.warn(warning);
      else console.info?.(warning);
    }
    return resolveLegacyFields(entityName).join(',');
  }
  if (Array.isArray(fields)) return fields.join(',');
  return typeof fields === 'string' ? fields : resolveLegacyFields(entityName).join(',');
};

const applyQueryFilters = (queryBuilder, query = {}) => {
  let builder = queryBuilder;

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === '$or' && Array.isArray(value)) return;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$in' in value) builder = builder.in(key, value.$in);
      else if ('$ne' in value) builder = builder.neq(key, value.$ne);
      else if ('$gt' in value) builder = builder.gt(key, value.$gt);
      else if ('$gte' in value) builder = builder.gte(key, value.$gte);
      else if ('$lt' in value) builder = builder.lt(key, value.$lt);
      else if ('$lte' in value) builder = builder.lte(key, value.$lte);
      else builder = builder.match({ [key]: value });
      return;
    }

    builder = builder.eq(key, value);
  });

  return builder;
};

const applySortAndLimit = (queryBuilder, sort, limit) => {
  let builder = queryBuilder;
  if (sort && typeof sort === 'string') {
    const ascending = !sort.startsWith('-');
    const field = ascending ? sort : sort.slice(1);
    builder = builder.order(field, { ascending });
  }
  if (limit) builder = builder.limit(limit);
  return builder;
};

const maybeReturnEmptyArray = (error) => {
  if (!error) return null;
  if (error.code === '42P01') return [];
  throw error;
};

const maybeReturnSuccess = (error) => {
  if (!error) return { success: true };
  if (error.code === '42P01') throw new Error('La table Supabase n existe pas encore.');
  throw error;
};

const isPermissionError = (error) => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return error.code === '42501'
    || message.includes('permission denied')
    || message.includes('row-level security')
    || message.includes('not allowed');
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible'));
  reader.readAsDataURL(file);
});

const mergeWriteResult = (payload, record) => ({ ...(payload || {}), ...(record || {}) });

const createEntityApi = (entityName) => {
  const tableName = resolveTableName(entityName);

  return {
    async list(sort, limit, options = {}) {
      const supabase = getSupabaseBrowserClient();
      const args = normalizeFilterArgs(sort, limit);
      let query = supabase.from(tableName).select(normalizeSelectFields(options.fields, `${tableName}.list`, entityName));
      query = applySortAndLimit(query, args.sort, args.limit);
      const { data, error } = await query;
      const fallback = maybeReturnEmptyArray(error);
      if (fallback) return fallback;
      return data || [];
    },

    async filter(query = {}, sort, limit, options = {}) {
      const supabase = getSupabaseBrowserClient();
      const args = normalizeFilterArgs(sort, limit);
      let request = supabase.from(tableName).select(normalizeSelectFields(options.fields, `${tableName}.filter`, entityName));
      request = applyQueryFilters(request, query);
      request = applySortAndLimit(request, args.sort, args.limit);
      const { data, error } = await request;
      const fallback = maybeReturnEmptyArray(error);
      if (fallback) return fallback;
      return data || [];
    },

    async create(data = {}) {
      const supabase = getSupabaseBrowserClient();
      const { data: created, error } = await supabase
        .from(tableName)
        .insert(data)
        .select(MINIMAL_WRITE_RETURN_FIELDS.join(','))
        .single();
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).insert(data);
        maybeReturnSuccess(fallback.error);
        return { ...data };
      }
      maybeReturnSuccess(error);
      return mergeWriteResult(data, created);
    },

    async bulkCreate(records = []) {
      const supabase = getSupabaseBrowserClient();
      const { data: created, error } = await supabase
        .from(tableName)
        .insert(records)
        .select(MINIMAL_BULK_WRITE_RETURN_FIELDS.join(','));
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).insert(records);
        maybeReturnSuccess(fallback.error);
        return records;
      }
      maybeReturnSuccess(error);
      if (!Array.isArray(created) || created.length === 0) return records;
      return records.map((record, index) => mergeWriteResult(record, created[index]));
    },

    async update(id, data = {}) {
      const supabase = getSupabaseBrowserClient();
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select(MINIMAL_WRITE_RETURN_FIELDS.join(','))
        .single();
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).update(data).eq('id', id);
        maybeReturnSuccess(fallback.error);
        return { id, ...data };
      }
      maybeReturnSuccess(error);
      return mergeWriteResult({ id, ...data }, updated);
    },

    async delete(id) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      return maybeReturnSuccess(error);
    },

    subscribe(listener) {
      const supabase = getSupabaseBrowserClient();
      const channelName = `entity-${tableName}-${Math.random().toString(36).slice(2, 10)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => {
            const eventTypeMap = {
              INSERT: 'create',
              UPDATE: 'update',
              DELETE: 'delete',
            };

            const normalizedType = eventTypeMap[payload.eventType] || payload.eventType?.toLowerCase?.() || 'update';
            const data = normalizedType === 'delete' ? payload.old : payload.new;
            listener?.({
              type: normalizedType,
              action: normalizedType,
              data,
              raw: payload,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
};

const entities = new Proxy({}, {
  get(target, entityName) {
    if (typeof entityName !== 'string') return target[entityName];
    if (!target[entityName]) target[entityName] = createEntityApi(entityName);
    return target[entityName];
  },
});

export const supabaseAppClient = {
  entities,
  auth: {
    async isAuthenticated() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return Boolean(data.session);
    },
    async login({ email, password }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async requestPasswordReset({ email, redirectTo }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || buildAbsoluteAppUrl('/Auth'),
      });
      if (error) throw error;
      return data;
    },
    async exchangeCodeForSession(code) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data;
    },
    async verifyOtp({ tokenHash, type = 'recovery' }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) throw error;
      return data;
    },
    async setSession({ accessToken, refreshToken }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data;
    },
    async getSession() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session || null;
    },
    async updatePassword({ password }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return data;
    },
    onAuthStateChange(callback) {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback?.(event, session);
      });
      return () => data.subscription.unsubscribe();
    },
    async signup({ email, password, full_name = '', redirectTo }) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name,
          },
        },
      });
      if (error) throw error;
      return data;
    },
    async me() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) return null;

      return {
        id: data.user.id,
        email: data.user.email || '',
        full_name: data.user.user_metadata?.full_name || '',
        role: data.user.app_metadata?.role || 'user',
        tenant_id: data.user.user_metadata?.tenant_id || null,
      };
    },
    async updateMe(data = {}) {
      const supabase = getSupabaseBrowserClient();
      const current = await this.me();
      const mergedMetadata = {
        full_name: current?.full_name || '',
        tenant_id: current?.tenant_id || null,
        ...data,
      };
      const { data: updated, error } = await supabase.auth.updateUser({
        data: mergedMetadata,
      });
      if (error) throw error;
      return {
        id: updated.user.id,
        email: updated.user.email || '',
        full_name: updated.user.user_metadata?.full_name || '',
        role: updated.user.app_metadata?.role || 'user',
        tenant_id: updated.user.user_metadata?.tenant_id || null,
      };
    },
    async logout() {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    },
    redirectToLogin(redirectTo = window.location.href) {
      const targetUrl = new URL(redirectTo, window.location.origin);
      const redirectParam = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      window.location.href = `/Auth?redirect=${encodeURIComponent(redirectParam)}`;
      return true;
    },
  },
  functions: {
    async invoke(name) {
      notReady(`functions.${name}`);
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const fileUrl = file ? await fileToDataUrl(file) : '';
        return { file_url: fileUrl };
      },
      async InvokeLLM() {
        notReady('integrations.Core.InvokeLLM');
      },
      async GenerateImage() {
        notReady('integrations.Core.GenerateImage');
      },
    },
  },
  appLogs: {
    async logUserInApp() {
      return true;
    },
  },
};
