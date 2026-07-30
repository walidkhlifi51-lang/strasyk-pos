import { createSupabaseAdminClient } from './supabaseAdmin.mjs';
import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { STAGE2_BASELINE } from './stage2Baseline.mjs';
import { PROVISIONING_REGISTRY_TABLE } from './stage2Registry.mjs';
import { buildStage2WriteOperations } from './stage2Planner.mjs';

const listAllAuthUsers = async (supabaseAdmin) => {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    users.push(...(data?.users || []));
    if ((data?.users || []).length < perPage) return users;
    page += 1;
  }
};

const selectRows = async (supabaseAdmin, tableName, queryBuilder) => {
  const { data, error } = await queryBuilder(supabaseAdmin.from(tableName));
  if (error) {
    return {
      status: error.code === 'PGRST205' || error.code === '42P01' ? 'missing' : 'error',
      rows: [],
      error: error.message,
    };
  }

  return {
    status: 'ok',
    rows: data || [],
    error: null,
  };
};

const normalizeProtectedSnapshot = (snapshot) => ({
  authUsers: (snapshot.authUsers || [])
    .map((item) => ({ id: item.id }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  tenants: (snapshot.tenants || [])
    .map((item) => ({ id: item.id, slug: item.slug || null }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  restaurantProfiles: (snapshot.restaurantProfiles || [])
    .map((item) => ({ id: item.id, tenant_id: item.tenant_id || null }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  userAccess: (snapshot.userAccess || [])
    .map((item) => ({ id: item.id }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

const snapshotsMatch = (actualSnapshot) => {
  const normalizedActual = JSON.stringify(normalizeProtectedSnapshot(actualSnapshot));
  const normalizedExpected = JSON.stringify(normalizeProtectedSnapshot(STAGE2_BASELINE.protectedSnapshot));
  return normalizedActual === normalizedExpected;
};

const buildMetricsSnapshot = (metrics) => {
  const tableCounts = Object.fromEntries(
    (metrics.tableCounts || []).map((item) => [item.tableName, item.rowCount]),
  );

  return {
    categories: tableCounts.categories ?? null,
    products: tableCounts.products ?? null,
    ingredients: tableCounts.ingredients ?? null,
    product_ingredients: tableCounts.product_ingredients ?? null,
    option_groups: tableCounts.option_groups ?? null,
    option_items: tableCounts.option_items ?? null,
    customers: tableCounts.customers ?? null,
    tables: tableCounts.tables ?? null,
    loyalty_rules: tableCounts.loyalty_rules ?? null,
    cagnotte_rules: tableCounts.cagnotte_rules ?? null,
    delivery_people: tableCounts.delivery_people ?? null,
    orders: tableCounts.orders ?? null,
    user_access: tableCounts.user_access ?? null,
    platform_admin_access: tableCounts.platform_admin_access ?? null,
    provisioning_registry: metrics.provisioningRegistry?.rowCount ?? null,
  };
};

const metricsSnapshotMatchesBaseline = (metricsSnapshot) => JSON.stringify(metricsSnapshot) === JSON.stringify(STAGE2_BASELINE.metricsSnapshot);

const READBACK_COLUMNS_BY_TABLE = {
  tenants: 'id',
};

export const resolveTargetsByTable = async (supabaseAdmin, operations) => {
  const grouped = new Map();

  for (const operation of operations) {
    if (operation.tableName === 'auth.users') continue;
    const id = operation.targetIdentifiers.id;
    if (!id) continue;

    const current = grouped.get(operation.tableName) || [];
    current.push(id);
    grouped.set(operation.tableName, current);
  }

  const resolved = {};
  for (const [tableName, ids] of grouped.entries()) {
    const uniqueIds = [...new Set(ids)];
    const selectColumns = READBACK_COLUMNS_BY_TABLE[tableName] || 'id,tenant_id';
    const result = await selectRows(supabaseAdmin, tableName, (query) => query
      .select(selectColumns)
      .in('id', uniqueIds)
      .limit(uniqueIds.length));
    resolved[tableName] = result;
  }

  return resolved;
};

export const collectStage2ReadModel = async ({ config, schemaReport, metrics }) => {
  const supabaseAdmin = createSupabaseAdminClient(config);
  const operations = buildStage2WriteOperations();
  const registryVisible = Boolean(schemaReport.optionalProvisioningRegistry?.present);
  const authUsers = await listAllAuthUsers(supabaseAdmin);
  const resolvedTargetsByTable = await resolveTargetsByTable(supabaseAdmin, operations);
  const authUser = authUsers.find((user) => (user.email || '').toLowerCase() === CANONICAL_DATASET.identity.ownerEmail.toLowerCase()) || null;

  const tenantBySlug = await selectRows(supabaseAdmin, 'tenants', (query) => query
    .select('id,slug,owner_email,nom_commercial')
    .eq('slug', CANONICAL_DATASET.tenant.slug)
    .limit(5));
  const tenantById = await selectRows(supabaseAdmin, 'tenants', (query) => query
    .select('id,slug,owner_email,nom_commercial')
    .eq('id', CANONICAL_DATASET.tenant.targetId)
    .limit(5));
  const userAccessByEmail = await selectRows(supabaseAdmin, 'user_access', (query) => query
    .select('id,tenant_id,user_email,role,is_active')
    .eq('user_email', CANONICAL_DATASET.identity.ownerEmail)
    .limit(5));
  const userAccessById = await selectRows(supabaseAdmin, 'user_access', (query) => query
    .select('id,tenant_id,user_email,role,is_active')
    .eq('id', CANONICAL_DATASET.userAccess.targetId)
    .limit(5));
  const registryRows = registryVisible
    ? await selectRows(supabaseAdmin, PROVISIONING_REGISTRY_TABLE, (query) => query
      .select('id,project_ref,tenant_id,entity_type,seed_key,record_table,record_id,checksum')
      .in('seed_key', operations.map((operation) => operation.seedKey))
      .limit(100))
    : { status: 'missing', rows: [], error: null };
  const protectedTenants = await selectRows(supabaseAdmin, 'tenants', (query) => query
    .select('id,slug,owner_email,nom_commercial,active')
    .order('created_date', { ascending: true })
    .limit(200));
  const protectedProfiles = await selectRows(supabaseAdmin, 'restaurant_profiles', (query) => query
    .select('id,tenant_id,nom_etablissement')
    .order('created_date', { ascending: true })
    .limit(200));
  const protectedUserAccess = await selectRows(supabaseAdmin, 'user_access', (query) => query
    .select('id,tenant_id,user_email,role,is_active')
    .order('created_date', { ascending: true })
    .limit(200));

  const protectedSnapshot = {
    capturedAt: new Date().toISOString(),
    authUsers: authUsers.map((user) => ({
      id: user.id,
      email: user.email || null,
      confirmed: Boolean(user.email_confirmed_at),
    })),
    tenants: protectedTenants.rows,
    restaurantProfiles: protectedProfiles.rows,
    userAccess: protectedUserAccess.rows,
  };

  const registryRowsBySeedKey = new Map((registryRows.rows || []).map((row) => [row.seed_key, row]));
  const resolvedTargets = operations.map((operation) => {
    if (operation.tableName === 'auth.users') {
      const registryRow = registryRowsBySeedKey.get(operation.seedKey) || null;
      const authByRegistryId = registryRow
        ? authUsers.find((candidate) => candidate.id === registryRow.record_id) || null
        : null;

      return {
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        expectedId: registryRow?.record_id || null,
        exists: Boolean(authUser),
        resolvedId: authUser?.id || null,
        registryIdMatch: registryRow ? registryRow.record_id === authUser?.id : false,
        registryBackedUserExists: Boolean(authByRegistryId),
      };
    }

    const rows = resolvedTargetsByTable[operation.tableName]?.rows || [];
    const matchingRow = rows.find((row) => row.id === operation.targetIdentifiers.id) || null;

    return {
      seedKey: operation.seedKey,
      tableName: operation.tableName,
      expectedId: operation.targetIdentifiers.id || null,
      exists: Boolean(matchingRow),
      resolvedId: matchingRow?.id || null,
      tenantId: matchingRow?.tenant_id || null,
    };
  });

  const metricsSnapshot = buildMetricsSnapshot(metrics);

  return {
    operations,
    baseline: {
      expected: STAGE2_BASELINE,
      actual: {
        authUserCount: metrics.authUserCount,
        tenantCount: metrics.tenantCount,
        restaurantProfileCount: metrics.restaurantProfileCount,
        userAccessCount: metricsSnapshot.user_access,
        provisioningRegistryCount: metricsSnapshot.provisioning_registry,
      },
      matches: metrics.authUserCount === STAGE2_BASELINE.expectedAuthUserCount
        && metrics.tenantCount === STAGE2_BASELINE.expectedTenantCount
        && metrics.restaurantProfileCount === STAGE2_BASELINE.expectedRestaurantProfileCount
        && metricsSnapshot.user_access === STAGE2_BASELINE.expectedUserAccessCount
        && metricsSnapshot.provisioning_registry === STAGE2_BASELINE.expectedProvisioningRegistryCount,
      metricsSnapshot,
      metricsSnapshotMatchesBaseline: metricsSnapshotMatchesBaseline(metricsSnapshot),
    },
    registry: {
      visible: registryVisible,
      rowCount: metrics.provisioningRegistry?.rowCount ?? null,
      rows: registryRows.rows,
      rowsBySeedKey: Object.fromEntries(registryRowsBySeedKey.entries()),
      status: registryRows.status,
    },
    protectedSnapshot,
    protectedSnapshotMatchesBaseline: snapshotsMatch(protectedSnapshot),
    resolvedTargets,
    collisions: {
      authUser: authUser ? {
        id: authUser.id,
        email: authUser.email || '',
      } : null,
      tenantBySlug,
      tenantById,
      userAccessByEmail,
      userAccessById,
    },
  };
};
