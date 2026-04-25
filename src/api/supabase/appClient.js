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

const createEntityApi = (entityName) => {
  const tableName = resolveTableName(entityName);

  return {
    async list(sort, limit) {
      const supabase = getSupabaseBrowserClient();
      const args = normalizeFilterArgs(sort, limit);
      let query = supabase.from(tableName).select('*');
      query = applySortAndLimit(query, args.sort, args.limit);
      const { data, error } = await query;
      const fallback = maybeReturnEmptyArray(error);
      if (fallback) return fallback;
      return data || [];
    },

    async filter(query = {}, sort, limit) {
      const supabase = getSupabaseBrowserClient();
      const args = normalizeFilterArgs(sort, limit);
      let request = supabase.from(tableName).select('*');
      request = applyQueryFilters(request, query);
      request = applySortAndLimit(request, args.sort, args.limit);
      const { data, error } = await request;
      const fallback = maybeReturnEmptyArray(error);
      if (fallback) return fallback;
      return data || [];
    },

    async create(data = {}) {
      const supabase = getSupabaseBrowserClient();
      const { data: created, error } = await supabase.from(tableName).insert(data).select().single();
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).insert(data);
        maybeReturnSuccess(fallback.error);
        return { ...data };
      }
      maybeReturnSuccess(error);
      return created;
    },

    async bulkCreate(records = []) {
      const supabase = getSupabaseBrowserClient();
      const { data: created, error } = await supabase.from(tableName).insert(records).select();
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).insert(records);
        maybeReturnSuccess(fallback.error);
        return records;
      }
      maybeReturnSuccess(error);
      return created || [];
    },

    async update(id, data = {}) {
      const supabase = getSupabaseBrowserClient();
      const { data: updated, error } = await supabase.from(tableName).update(data).eq('id', id).select().single();
      if (isPermissionError(error)) {
        const fallback = await supabase.from(tableName).update(data).eq('id', id);
        maybeReturnSuccess(fallback.error);
        return { id, ...data };
      }
      maybeReturnSuccess(error);
      return updated;
    },

    async delete(id) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      return maybeReturnSuccess(error);
    },

    subscribe() {
      return () => {};
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
