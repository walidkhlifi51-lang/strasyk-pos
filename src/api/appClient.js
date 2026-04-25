import { computeTaxSummaryFromArticles } from '@/components/utils/taxUtils';
import { APP_BACKEND_MODE } from '@/config/env';
import { supabaseAppClient } from '@/api/supabase/appClient';

const STORAGE_KEY = 'strasyk_local_database_v1';
const CURRENT_USER_KEY = 'strasyk_local_current_user_v1';

const nowIso = () => new Date().toISOString();

const createId = (prefix = 'rec') => {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const defaultUser = {
  id: 'local_user_owner',
  email: 'owner@local.test',
  full_name: 'Utilisateur local',
  role: 'user',
  tenant_id: 'local_tenant',
  created_date: nowIso(),
};

const defaultTenant = {
  id: 'local_tenant',
  nom_commercial: 'Restaurant local',
  slug: 'restaurant-local',
  owner_email: defaultUser.email,
  active: true,
  pos_suspended: false,
  created_date: nowIso(),
};

const defaultProfile = {
  id: 'local_profile',
  tenant_id: defaultTenant.id,
  nom_etablissement: 'Restaurant local',
  adresse: 'Adresse locale',
  ville: '',
  telephone: '0000000000',
  frais_livraison: 2.5,
  montant_minimum_livraison: 15,
  zone_livraison_km: 5,
  impression_auto: false,
  impression_bouton_visible: true,
  impression_double: false,
  page_pins: {},
  tva_rates: [
    { rate: 5.5, label: 'TVA reduite' },
    { rate: 10, label: 'TVA restauration' },
    { rate: 20, label: 'TVA normale' },
  ],
  manages_deliveries: true,
  manages_table_plan: true,
  table_plan_allowed: true,
  manages_kiosk: true,
  delivery_app_allowed: true,
  manages_delivery_app: true,
  manages_web_ordering: true,
  customer_display_enabled: false,
  web_ordering_closed: false,
  web_frais_livraison_enabled: true,
  web_frais_livraison: 2.5,
  site_template: 'moderne',
  site_primary_color: '#f97316',
  custom_domain: null,
  domain_verified: false,
  scratch_tickets_enabled: false,
  created_date: nowIso(),
};

const defaultDeliveryPerson = {
  id: 'local_delivery_1',
  tenant_id: defaultTenant.id,
  nom: 'Livreur',
  prenom: 'Demo',
  telephone: '0600000000',
  username: 'livreur',
  password: '1234',
  disponible: true,
  en_livraison: false,
  nb_livraisons_jour: 0,
  total_encaisse: 0,
  created_date: nowIso(),
};

const defaultPlatformAdminAccess = {
  id: 'local_platform_admin_1',
  user_email: defaultUser.email,
  is_active: true,
  created_date: nowIso(),
};

const defaultData = () => ({
  User: [defaultUser],
  Tenant: [defaultTenant],
  RestaurantProfile: [defaultProfile],
  Reseller: [],
  ResellerUser: [],
  ResellerBranding: [],
  ResellerPricingRule: [],
  ResellerTenant: [],
  ResellerCommission: [],
  ResellerPayout: [],
  Category: [],
  Product: [],
  Customer: [],
  Order: [],
  DeliveryPerson: [defaultDeliveryPerson],
  UserAccess: [],
  ClotureCaisse: [],
  OptionGroup: [],
  OptionItem: [],
  Ingredient: [],
  ProductIngredient: [],
  MenuFormula: [],
  MenuFormulaItem: [],
  Offer: [],
  LoyaltyRule: [],
  CagnotteRule: [],
  CagnotteHistory: [],
  Table: [],
  DrawerOpening: [],
  DeliveryVerificationLog: [],
  CustomerDisplayCart: [],
  InscriptionRequest: [],
  PlatformAdminAccess: [defaultPlatformAdminAccess],
  TenantInvoice: [],
  SiteConfig: [],
  PromoCode: [],
  ScratchTicketConfig: [],
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaultData(), ...parsed };
  } catch {
    return defaultData();
  }
};

const writeStore = (store) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

const listeners = new Map();

const emit = (entityName, event) => {
  const entityListeners = listeners.get(entityName);
  if (!entityListeners) return;
  entityListeners.forEach((listener) => listener(clone(event)));
};

const matchesValue = (recordValue, queryValue) => {
  if (queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)) {
    if ('$in' in queryValue) return queryValue.$in.includes(recordValue);
    if ('$ne' in queryValue) return recordValue !== queryValue.$ne;
    if ('$gt' in queryValue) return recordValue > queryValue.$gt;
    if ('$gte' in queryValue) return recordValue >= queryValue.$gte;
    if ('$lt' in queryValue) return recordValue < queryValue.$lt;
    if ('$lte' in queryValue) return recordValue <= queryValue.$lte;
  }
  return recordValue === queryValue;
};

const matchesQuery = (record, query = {}) => {
  if (!query || Object.keys(query).length === 0) return true;
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or' && Array.isArray(value)) {
      return value.some((condition) => matchesQuery(record, condition));
    }
    return matchesValue(record[key], value);
  });
};

const sortRecords = (records, sort) => {
  if (!sort || typeof sort !== 'string') return records;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...records].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
};

const normalizeFilterArgs = (sort, limit) => {
  if (typeof sort === 'number') return { sort: null, limit: sort };
  return { sort, limit };
};

const createEntityApi = (entityName) => ({
  async list(sort, limit) {
    const store = readStore();
    const args = normalizeFilterArgs(sort, limit);
    let records = sortRecords(store[entityName] || [], args.sort);
    if (args.limit) records = records.slice(0, args.limit);
    return clone(records);
  },

  async filter(query = {}, sort, limit) {
    const store = readStore();
    const args = normalizeFilterArgs(sort, limit);
    let records = (store[entityName] || []).filter((record) => matchesQuery(record, query));
    records = sortRecords(records, args.sort);
    if (args.limit) records = records.slice(0, args.limit);
    return clone(records);
  },

  async create(data = {}) {
    const store = readStore();
    const record = {
      id: data.id || createId(entityName.toLowerCase()),
      created_date: data.created_date || nowIso(),
      updated_date: nowIso(),
      ...data,
    };
    store[entityName] = [...(store[entityName] || []), record];
    writeStore(store);
    emit(entityName, { action: 'create', data: record });
    return clone(record);
  },

  async bulkCreate(records = []) {
    const created = [];
    for (const record of records) {
      created.push(await this.create(record));
    }
    return created;
  },

  async update(id, data = {}) {
    const store = readStore();
    const records = store[entityName] || [];
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) throw new Error(`${entityName} introuvable: ${id}`);
    const updated = { ...records[index], ...data, id, updated_date: nowIso() };
    records[index] = updated;
    store[entityName] = records;
    writeStore(store);
    emit(entityName, { action: 'update', data: updated });
    return clone(updated);
  },

  async delete(id) {
    const store = readStore();
    const records = store[entityName] || [];
    const deleted = records.find((record) => record.id === id);
    store[entityName] = records.filter((record) => record.id !== id);
    writeStore(store);
    if (deleted) emit(entityName, { action: 'delete', data: deleted });
    return { success: true };
  },

  subscribe(listener) {
    if (!listeners.has(entityName)) listeners.set(entityName, new Set());
    listeners.get(entityName).add(listener);
    return () => listeners.get(entityName)?.delete(listener);
  },
});

const entities = new Proxy({}, {
  get(target, entityName) {
    if (typeof entityName !== 'string') return target[entityName];
    if (!target[entityName]) target[entityName] = createEntityApi(entityName);
    return target[entityName];
  },
});

const getCurrentUser = () => {
  const storedUser = localStorage.getItem(CURRENT_USER_KEY);
  if (storedUser) return JSON.parse(storedUser);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
  const store = readStore();
  if (!store.User.some((user) => user.id === defaultUser.id)) {
    store.User.push(defaultUser);
    writeStore(store);
  }
  return defaultUser;
};

const getTodayParis = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

const toParisDateStr = (dateStr) => {
  if (!dateStr) return null;
  const normalized = dateStr.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') || normalized.includes('+') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
};

const functionHandlers = {
  async getCustomerCagnotte({ tenant_id, telephone }) {
    const customers = await entities.Customer.filter({ tenant_id, telephone });
    const customer = customers[0];
    if (!customer) return { found: false, cagnotte_balance: 0 };
    return {
      found: true,
      customer_id: customer.id,
      cagnotte_balance: customer.cagnotte_balance || 0,
      prenom: customer.prenom || '',
      nom: customer.nom || '',
    };
  },

  async createKioskOrder({ orderData, tenantId, dateStr, formattedDate }) {
    const allOrders = await entities.Order.filter({ tenant_id: tenantId });
    const todayOrders = allOrders.filter((order) => toParisDateStr(order.created_date) === dateStr);
    const nextNumero = todayOrders.reduce((max, order) => Math.max(max, order.numero_caisse || 0), 0) + 1;
    const order = await entities.Order.create({
      ...orderData,
      tenant_id: tenantId,
      numero_caisse: nextNumero,
      numero_commande: `${nextNumero}-${formattedDate}`,
      from_kiosk: true,
    });
    return { order, numero: nextNumero };
  },

  async createWebOrder(payload) {
    let customerId = null;
    const customerName = `${payload.customer_prenom || ''} ${payload.customer_nom || ''}`.trim();

    if (payload.customer_phone) {
      const existing = await entities.Customer.filter({
        tenant_id: payload.tenant_id,
        telephone: payload.customer_phone,
      });
      if (existing[0]) {
        customerId = existing[0].id;
        await entities.Customer.update(customerId, {
          email: payload.customer_email || existing[0].email,
          nom: payload.customer_nom || existing[0].nom,
          prenom: payload.customer_prenom || existing[0].prenom,
          adresse: payload.customer_adresse || existing[0].adresse,
        });
      } else {
        const customer = await entities.Customer.create({
          tenant_id: payload.tenant_id,
          nom: payload.customer_nom || '',
          prenom: payload.customer_prenom || '',
          telephone: payload.customer_phone,
          email: payload.customer_email || '',
          adresse: payload.customer_adresse || '',
        });
        customerId = customer.id;
      }
    }

    const allOrders = await entities.Order.filter({ tenant_id: payload.tenant_id });
    const todayParis = getTodayParis();
    const todayOrders = allOrders.filter((order) => toParisDateStr(order.created_date) === todayParis);
    const nextNumeroCaisse = todayOrders.reduce((max, order) => Math.max(max, Number(order.numero_caisse) || 0), 0) + 1;
    const formattedDate = todayParis.split('-').reverse().join('').slice(0, 6);
    const numeroCommande = `${nextNumeroCaisse}-${formattedDate}`;

    const taxSummary = computeTaxSummaryFromArticles(payload.articles || [], payload.total_ttc || 0);

    const order = await entities.Order.create({
      tenant_id: payload.tenant_id,
      numero_caisse: nextNumeroCaisse,
      numero_commande: numeroCommande,
      customer_id: customerId,
      customer_name: customerName || payload.customer_phone || 'Client web',
      type_commande: payload.type_commande,
      delivery_address: payload.customer_adresse,
      articles: payload.articles || [],
      total_ttc: payload.total_ttc || 0,
      total_ht: taxSummary.totalHt,
      total_tva: taxSummary.totalTva,
      statut: payload.payment_method === 'online' ? 'en_attente_paiement' : 'en_attente',
      payee: false,
      from_web: true,
      print_at_counter: true,
      cagnotte_spent: payload.cagnotte_amount || 0,
      scratch_reduction: payload.scratch_reduction || 0,
      notes: payload.notes || '',
    });
    return {
      order_id: order.id,
      numero_commande: numeroCommande,
      final_total: order.total_ttc,
      cagnotte_used: order.cagnotte_spent,
      scratch_discount: order.scratch_reduction,
    };
  },

  async assignDeliveryOrder(payload) {
    if (payload.action === 'list') {
      const orders = await entities.Order.filter({
        tenant_id: payload.tenant_id,
        delivery_person_id: payload.delivery_person_id,
      });
      return { orders: orders.filter((order) => toParisDateStr(order.created_date) === getTodayParis()) };
    }

    if (payload.action === 'getCustomer') {
      const customers = await entities.Customer.filter({
        id: payload.customer_id,
        tenant_id: payload.tenant_id,
      });
      return { customer: customers[0] || null };
    }

    if (payload.action === 'getDeliveryPerson') {
      const persons = await entities.DeliveryPerson.filter({ id: payload.delivery_person_id });
      return { person: persons[0] || null };
    }

    if (payload.action === 'confirmDelivery') {
      const orders = await entities.Order.filter({ id: payload.order_id });
      const order = orders[0];
      if (!order) throw new Error('Commande introuvable');
      const wasAlreadyPaid = !!order.payee;
      const isNowPaid = wasAlreadyPaid || !!payload.payment_method;
      const updatedPayments = payload.payment_method
        ? [{ methode: payload.payment_method, montant: payload.order_total || order.total_ttc || 0 }]
        : (order.mode_paiement || []);

      await entities.Order.update(order.id, {
        statut: 'livree',
        payee: isNowPaid,
        mode_paiement: updatedPayments,
      });

      if (payload.delivery_person_id) {
        const persons = await entities.DeliveryPerson.filter({ id: payload.delivery_person_id });
        const person = persons[0];
        if (person) {
          await entities.DeliveryPerson.update(person.id, {
            en_livraison: false,
            nb_livraisons_jour: (person.nb_livraisons_jour || 0) + 1,
            total_encaisse: (person.total_encaisse || 0) + (!wasAlreadyPaid && isNowPaid ? (payload.order_total || order.total_ttc || 0) : 0),
          });
        }
      }

      if (!wasAlreadyPaid && isNowPaid && order.customer_id) {
        const customerList = await entities.Customer.filter({ id: order.customer_id });
        const customer = customerList[0];
        if (customer) {
          const ruleList = await entities.CagnotteRule.filter({ tenant_id: order.tenant_id, active: true });
          const cagnotteRule = ruleList[0];
          if (cagnotteRule?.accumulation_rate > 0) {
            const amountEarned = (order.total_ttc || 0) * (cagnotteRule.accumulation_rate / 100);
            if (amountEarned > 0.01) {
              const balanceBefore = customer.cagnotte_balance || 0;
              const balanceAfter = balanceBefore + amountEarned;
              await entities.CagnotteHistory.create({
                tenant_id: order.tenant_id,
                customer_id: customer.id,
                order_id: order.id,
                type: 'earn',
                amount: amountEarned,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                created_date: nowIso(),
              });
              await entities.Customer.update(customer.id, { cagnotte_balance: balanceAfter });
            }
          }
        }
      }

      return { success: true };
    }

    const numero = parseInt(payload.numero_caisse, 10);
    const orders = await entities.Order.filter({ tenant_id: payload.tenant_id });
    const order = orders.find((candidate) => {
      return toParisDateStr(candidate.created_date) === getTodayParis()
        && Number(candidate.numero_caisse) === numero
        && !['livree', 'payé', 'annulee'].includes(candidate.statut);
    });
    if (!order) throw new Error(`Commande #${numero} introuvable aujourd'hui`);
    await entities.Order.update(order.id, {
      delivery_person_id: payload.delivery_person_id,
      statut: 'en_cours_de_livraison',
    });
    await entities.DeliveryPerson.update(payload.delivery_person_id, { en_livraison: true });
    return { success: true, order_id: order.id, numero_caisse: order.numero_caisse };
  },

  async createWebCheckout() {
    return { url: '#paiement-local-non-configure' };
  },

  async createInvoiceCheckout() {
    return { url: '#paiement-local-non-configure' };
  },

  async createSubscription() {
    return { url: '#abonnement-local-non-configure' };
  },
};

export const localAppClient = {
  entities,
  auth: {
    async isAuthenticated() {
      return true;
    },
    async signup({ email, full_name = '' }) {
      const current = {
        ...getCurrentUser(),
        email: email || getCurrentUser().email,
        full_name,
        updated_date: nowIso(),
      };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
      return { user: clone(current) };
    },
    async me() {
      return clone(getCurrentUser());
    },
    async requestPasswordReset() {
      return true;
    },
    async updatePassword() {
      return true;
    },
    onAuthStateChange() {
      return () => {};
    },
    async updateMe(data = {}) {
      const current = { ...getCurrentUser(), ...data, updated_date: nowIso() };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
      const store = readStore();
      const users = store.User || [];
      const index = users.findIndex((user) => user.id === current.id);
      if (index >= 0) users[index] = current;
      else users.push(current);
      store.User = users;
      writeStore(store);
      return clone(current);
    },
    async logout() {
      return true;
    },
    redirectToLogin() {
      return true;
    },
  },
  functions: {
    async invoke(name, payload = {}) {
      const handler = functionHandlers[name];
      if (!handler) throw new Error(`Fonction locale non implementee: ${name}`);
      return handler(payload);
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const fileUrl = file ? await fileToDataUrl(file) : '';
        return { file_url: fileUrl };
      },
    },
  },
  appLogs: {
    async logUserInApp() {
      return true;
    },
  },
};

export const appClient = APP_BACKEND_MODE === 'supabase' ? supabaseAppClient : localAppClient;

