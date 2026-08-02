import { expect } from '@playwright/test';
import { assertSafeTarget } from './env.js';
import { createAdminSupabaseClient, demoTenantId } from './supabase.js';

export const LOT2_NAME_PREFIX = 'E2E_LOT2_';

export const LOT2_SCENARIOS = [
  {
    id: 'LOT2-001',
    title: 'commande sur place avec table',
    writesExpected: true,
  },
  {
    id: 'LOT2-004',
    title: 'produit simple',
    writesExpected: true,
  },
  {
    id: 'LOT2-005',
    title: 'pizza avec taille',
    writesExpected: true,
  },
  {
    id: 'LOT2-008',
    title: 'changement de quantité',
    writesExpected: true,
  },
  {
    id: 'LOT2-011',
    title: 'mise en attente et reprise',
    writesExpected: true,
  },
  {
    id: 'LOT2-012',
    title: 'paiement espèces',
    writesExpected: true,
  },
  {
    id: 'LOT2-014',
    title: 'protection double validation',
    writesExpected: true,
  },
  {
    id: 'LOT2-015',
    title: 'persistance après rafraîchissement',
    writesExpected: true,
  },
  {
    id: 'LOT2-016',
    title: 'isolation tenant',
    writesExpected: false,
  },
];

export const POS_REAL_DATA_MODEL = {
  rootTable: 'orders',
  orderFields: [
    'id',
    'tenant_id',
    'numero_commande',
    'numero_caisse',
    'type_commande',
    'customer_id',
    'table_id',
    'delivery_person_id',
    'delivery_address',
    'articles',
    'total_ht',
    'total_tva',
    'total_ttc',
    'statut',
    'mode_paiement',
    'mode_paiement_prevu',
    'numero_bipeur',
    'numero_table',
    'payee',
    'notes',
    'cagnotte_spent',
    'scratch_reduction',
    'print_at_counter',
    'from_kiosk',
    'from_web',
    'created_date',
    'updated_date',
  ],
  articleShape: [
    'product_id',
    'menu_id',
    'nom_produit',
    'quantite',
    'prix_unitaire',
    'total_ligne',
    'tva',
    'options',
    'exclusions',
    'notes',
    'isMenu',
    'menuDetails',
    'size',
  ],
  optionShape: ['id', 'nom', 'price_surcharge'],
  exclusionShape: ['id', 'nom'],
  paymentShape: ['methode', 'montant', 'monnaie_recue', 'monnaie_a_rendre'],
  holdState: {
    orderStatus: 'en_attente',
    paid: false,
  },
  unpaidState: {
    orderStatus: 'en_attente_paiement',
    paid: false,
  },
  paidState: {
    orderStatus: 'payé',
    paid: true,
  },
  surPlaceLinkage: {
    orderField: 'table_id',
    tableBackReference: 'tables.order_id',
  },
};

export const assertLot2SafeTarget = ({ baseURL, expectedTenantId, branch }) => {
  assertSafeTarget({ baseURL, expectedTenantId, branch });
  if (expectedTenantId !== demoTenantId) {
    throw new Error(`LOT2 is restricted to demo tenant ${demoTenantId}. Received ${expectedTenantId}.`);
  }
};

export const createNetworkCollectors = (page) => {
  const requests = [];
  const responses = [];
  const consoleErrors = [];

  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/rest/v1/')) return;

    requests.push({
      method: request.method(),
      url,
      postData: request.postData() || null,
    });
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/rest/v1/')) return;

    let body = null;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }

    responses.push({
      method: response.request().method(),
      url,
      status: response.status(),
      body,
    });
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  return { requests, responses, consoleErrors };
};

export const waitForPosReadModel = async ({ page, responses }) => {
  const requiredMatchers = [
    '/rest/v1/products',
    '/rest/v1/categories',
    '/rest/v1/orders',
    '/rest/v1/tables',
  ];

  await expect.poll(() => {
    const seen = new Set(
      (responses || [])
        .filter((entry) => entry.method === 'GET' && entry.status < 400)
        .map((entry) => requiredMatchers.find((matcher) => entry.url.includes(matcher)))
        .filter(Boolean)
    );

    return seen.size;
  }, {
    timeout: 30_000,
    message: 'Expected the POS read model to load products, categories, orders, and tables.',
  }).toBe(requiredMatchers.length);
};

export const extractPosReadModelSummary = ({ requests, responses }) => {
  const findFirst = (segment) => responses.find((entry) => entry.url.includes(segment) && entry.method === 'GET');
  const findOrderResponses = () => responses.filter((entry) => entry.url.includes('/rest/v1/orders') && entry.method === 'GET');
  const firstOrders = findFirst('/rest/v1/orders');
  const orderResponses = findOrderResponses();
  const firstTables = findFirst('/rest/v1/tables');
  const firstProducts = findFirst('/rest/v1/products');
  const firstCategories = findFirst('/rest/v1/categories');
  const firstOptions = findFirst('/rest/v1/option_groups');
  const firstOptionItems = findFirst('/rest/v1/option_items');
  const firstIngredients = findFirst('/rest/v1/ingredients');
  const firstProductIngredients = findFirst('/rest/v1/product_ingredients');

  const firstOrder = Array.isArray(firstOrders?.body) ? firstOrders.body[0] : null;
  let orderSelectFields = [];

  const orderUrlForSelect = orderResponses.find((entry) => entry.url.includes('articles') || entry.url.includes('mode_paiement'))?.url || firstOrders?.url;

  if (orderUrlForSelect) {
    try {
      const parsed = new URL(orderUrlForSelect);
      orderSelectFields = (parsed.searchParams.get('select') || '')
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
        .sort();
    } catch {
      orderSelectFields = [];
    }
  }

  return {
    orderReadUrl: orderUrlForSelect || null,
    orderSelectFields,
    ordersFieldsObserved: firstOrder ? Object.keys(firstOrder).sort() : [],
    firstOrderArticlesShape: Array.isArray(firstOrder?.articles) && firstOrder.articles[0]
      ? Object.keys(firstOrder.articles[0]).sort()
      : [],
    firstOrderPaymentShape: Array.isArray(firstOrder?.mode_paiement) && firstOrder.mode_paiement[0]
      ? Object.keys(firstOrder.mode_paiement[0]).sort()
      : [],
    supportingReads: {
      tables: firstTables?.url || null,
      products: firstProducts?.url || null,
      categories: firstCategories?.url || null,
      optionGroups: firstOptions?.url || null,
      optionItems: firstOptionItems?.url || null,
      ingredients: firstIngredients?.url || null,
      productIngredients: firstProductIngredients?.url || null,
    },
    writeRequestsObserved: requests.filter((entry) => ['POST', 'PATCH', 'DELETE'].includes(entry.method)).length,
  };
};

export const fetchLot2ReadonlySnapshot = async () => {
  const supabaseAdmin = createAdminSupabaseClient();

  const read = async (table, select) => {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .eq('tenant_id', demoTenantId);

    if (error) {
      throw new Error(`[lot2-snapshot] ${table}: ${error.message}`);
    }

    return data || [];
  };

  const [orders, tables, customers, products, categories] = await Promise.all([
    read('orders', 'id,tenant_id,numero_commande,numero_caisse,type_commande,table_id,customer_id,articles,mode_paiement,statut,payee,notes,created_date'),
    read('tables', 'id,tenant_id,nom,statut,order_id'),
    read('customers', 'id,tenant_id,nom,prenom,telephone,email,adresse,updated_date'),
    read('products', 'id,tenant_id,nom,prix,base_price,size_prices,disponible,category_id'),
    read('categories', 'id,tenant_id,nom,manages_sizes,size_template'),
  ]);

  return {
    orders,
    tables,
    customers,
    products,
    categories,
  };
};

export const fetchAvailableDemoTable = async () => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from('tables')
    .select('id,tenant_id,nom,statut,order_id,capacite,forme')
    .eq('tenant_id', demoTenantId)
    .eq('statut', 'disponible')
    .order('nom', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`[lot2-available-table] ${error.message}`);
  }

  return data?.[0] || null;
};

export const fetchCanonicalProductForLot2 = async (productName) => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,tenant_id,nom,prix,base_price,size_prices,category_id,disponible')
    .eq('tenant_id', demoTenantId)
    .eq('nom', productName)
    .limit(1);

  if (error) {
    throw new Error(`[lot2-product] ${productName}: ${error.message}`);
  }

  return data?.[0] || null;
};

export const fetchOrderById = async (orderId) => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,tenant_id,numero_commande,numero_caisse,type_commande,customer_id,table_id,delivery_person_id,delivery_address,articles,total_ht,total_tva,total_ttc,statut,mode_paiement,mode_paiement_prevu,numero_bipeur,numero_table,payee,notes,cagnotte_spent,scratch_reduction,print_at_counter,from_kiosk,from_web,created_date,updated_date')
    .eq('tenant_id', demoTenantId)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`[lot2-order] ${orderId}: ${error.message}`);
  }

  return data || null;
};

export const fetchTableById = async (tableId) => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from('tables')
    .select('id,tenant_id,nom,statut,order_id,capacite,forme,updated_date')
    .eq('tenant_id', demoTenantId)
    .eq('id', tableId)
    .maybeSingle();

  if (error) {
    throw new Error(`[lot2-table] ${tableId}: ${error.message}`);
  }

  return data || null;
};

export const assertNoActiveLot2HoldOrder = async () => {
  const supabaseAdmin = createAdminSupabaseClient();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,tenant_id,notes,statut,payee')
    .eq('tenant_id', demoTenantId)
    .like('notes', `${LOT2_NAME_PREFIX}%`);

  if (error) {
    throw new Error(`[lot2-preflight-orders] ${error.message}`);
  }

  if ((data || []).length > 0) {
    throw new Error(`Refusing LOT2-A because ${(data || []).length} E2E_LOT2 order(s) already exist.`);
  }
};

export const cleanupHeldOrderById = async ({ orderId, tableBefore }) => {
  const supabaseAdmin = createAdminSupabaseClient();

  if (!orderId) {
    throw new Error('cleanupHeldOrderById requires orderId.');
  }

  const beforeDeleteOrder = await fetchOrderById(orderId);
  if (!beforeDeleteOrder) {
    throw new Error(`cleanupHeldOrderById could not find order ${orderId}.`);
  }

  if (beforeDeleteOrder.tenant_id !== demoTenantId) {
    throw new Error(`cleanupHeldOrderById refused non-demo order ${orderId}.`);
  }

  const { data: deletedRows, error: deleteError } = await supabaseAdmin
    .from('orders')
    .delete()
    .eq('tenant_id', demoTenantId)
    .eq('id', orderId)
    .select('id,tenant_id');

  if (deleteError) {
    throw new Error(`[lot2-cleanup-order] ${deleteError.message}`);
  }

  if ((deletedRows || []).length !== 1) {
    throw new Error(`cleanupHeldOrderById expected 1 deleted order, received ${(deletedRows || []).length}.`);
  }

  let restoredTable = null;
  if (tableBefore?.id) {
    const { data: updatedTableRows, error: tableError } = await supabaseAdmin
      .from('tables')
      .update({
        statut: tableBefore.statut,
        order_id: tableBefore.order_id,
      })
      .eq('tenant_id', demoTenantId)
      .eq('id', tableBefore.id)
      .select('id,tenant_id,nom,statut,order_id');

    if (tableError) {
      throw new Error(`[lot2-cleanup-table] ${tableError.message}`);
    }

    if ((updatedTableRows || []).length !== 1) {
      throw new Error(`cleanupHeldOrderById expected 1 updated table, received ${(updatedTableRows || []).length}.`);
    }

    restoredTable = updatedTableRows[0];
  }

  return {
    deletedOrder: deletedRows[0],
    restoredTable,
  };
};

export const buildLot2CleanupProtection = ({ createdOrderIds = [], createdCustomerIds = [], createdTableBindings = [] }) => ({
  tenantId: demoTenantId,
  orderIds: [...new Set(createdOrderIds.filter(Boolean))],
  customerIds: [...new Set(createdCustomerIds.filter(Boolean))],
  tableBindings: [...new Set(createdTableBindings.filter(Boolean))],
  markerPrefix: LOT2_NAME_PREFIX,
  rules: [
    'delete only by exact id + tenant_id',
    'never delete canonical orders or all orders for tenant',
    'refuse if an id was not collected by the running scenario',
    'refuse if a row tenant_id differs from the demo tenant',
  ],
});

export const assertNoPosWritesObserved = async ({ requests }) => {
  await expect(requests.filter((entry) => ['POST', 'PATCH', 'DELETE'].includes(entry.method))).toHaveLength(0);
};
