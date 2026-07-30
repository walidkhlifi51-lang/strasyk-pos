import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { buildRuntimeConfig } from '../config.mjs';
import { ProvisioningError, serializeProvisioningError } from '../errors.mjs';
import { assertSafeEnvironment } from '../guards.mjs';
import { createLogger, redactSecrets } from '../logger.mjs';
import { inspectSupabaseSchema, assertSchemaCompatibleForStepOne } from '../schemaInspector.mjs';
import { buildDryRunReport } from '../dryRun.mjs';
import { buildStatusReport } from '../status.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { buildStage2DryRunPlan, buildStage2WriteOperations, simulateStage2FailureCompensation } from '../stage2Planner.mjs';
import {
  buildCanonicalPayloadsBySeedKey,
  CANONICAL_TENANT_SUBSCRIPTION_PLAN,
  validateCanonicalPayloads,
  validateTenantPayload,
} from '../canonicalPayloads.mjs';
import {
  buildSupabaseErrorDetails,
  describePayloadShape,
  getProvisioningReadbackFields,
  insertProvisioningBusinessRow,
} from '../provision.mjs';
import { resolveTargetsByTable } from '../stage2ReadModel.mjs';

const BASE_ENV = {
  SUPABASE_URL: 'https://testref1234567890.supabase.co',
  SUPABASE_PROJECT_REF: 'testref1234567890',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_verySensitiveValue',
  STRASYK_TEST_ENVIRONMENT_NAME: 'staging-demo',
  STRASYK_TEST_ENVIRONMENT_CONFIRMATION: 'staging-demo',
  STRASYK_TEST_ALLOWED_PROJECT_REFS: 'testref1234567890,qa9876543210',
};

const buildConfig = (overrides = {}) => buildRuntimeConfig({
  argv: ['status'],
  processEnv: {
    ...BASE_ENV,
    ...overrides,
  },
  cwd: process.cwd(),
});

const buildMetricsFixture = () => ({
  authUserCount: 12,
  tenantCount: 3,
  restaurantProfileCount: 3,
  tableCounts: [
    { tableName: 'tenants', status: 'ok', rowCount: 3, error: null },
    { tableName: 'restaurant_profiles', status: 'ok', rowCount: 3, error: null },
  ],
  provisioningRegistry: {
    tableName: 'provisioning_registry',
    status: 'missing',
    rowCount: null,
    error: null,
  },
});

const buildStage2ReadModelFixture = (overrides = {}) => ({
  baseline: {
    expected: {
      expectedAuthUserCount: 6,
      expectedTenantCount: 3,
      expectedRestaurantProfileCount: 3,
      metricsSnapshot: {},
    },
    actual: {
      authUserCount: 6,
      tenantCount: 3,
      restaurantProfileCount: 3,
    },
    matches: true,
    metricsSnapshot: {},
    metricsSnapshotMatchesBaseline: true,
  },
  registry: {
    visible: false,
    rowCount: 0,
    rows: [],
    status: 'missing',
  },
  protectedSnapshot: {
    capturedAt: '2026-07-29T10:00:00.000Z',
    authUsers: [
      { id: 'auth-1', email: 'owner-1@example.test', confirmed: true },
      { id: 'auth-2', email: 'owner-2@example.test', confirmed: true },
    ],
    tenants: [
      { id: 'tenant-a', slug: 'alpha', owner_email: 'owner-1@example.test', nom_commercial: 'Alpha', active: true },
      { id: 'tenant-b', slug: 'beta', owner_email: 'owner-2@example.test', nom_commercial: 'Beta', active: true },
    ],
    restaurantProfiles: [
      { id: 'profile-a', tenant_id: 'tenant-a', nom_etablissement: 'Alpha' },
      { id: 'profile-b', tenant_id: 'tenant-b', nom_etablissement: 'Beta' },
    ],
    userAccess: [
      { id: 'ua-a', tenant_id: 'tenant-a', user_email: 'owner-1@example.test', role: 'owner', is_active: true },
    ],
  },
  protectedSnapshotMatchesBaseline: true,
  resolvedTargets: buildStage2WriteOperations().map((operation) => ({
    seedKey: operation.seedKey,
    tableName: operation.tableName,
    expectedId: operation.targetIdentifiers.id || null,
    exists: false,
    resolvedId: null,
    tenantId: null,
    registryIdMatch: false,
    registryBackedUserExists: false,
  })),
  collisions: {
    authUser: null,
    tenantBySlug: { status: 'ok', rows: [], error: null },
    tenantById: { status: 'ok', rows: [], error: null },
    userAccessByEmail: { status: 'ok', rows: [], error: null },
    userAccessById: { status: 'ok', rows: [], error: null },
  },
  ...overrides,
});

const buildProvisionedReadModelFixture = () => {
  const operations = buildStage2WriteOperations();

  return buildStage2ReadModelFixture({
    baseline: {
      expected: {
        expectedAuthUserCount: 6,
        expectedTenantCount: 3,
        expectedRestaurantProfileCount: 3,
        metricsSnapshot: {},
      },
      actual: {
        authUserCount: 7,
        tenantCount: 4,
        restaurantProfileCount: 4,
        userAccessCount: 1,
        provisioningRegistryCount: 30,
      },
      matches: false,
      metricsSnapshot: {},
      metricsSnapshotMatchesBaseline: false,
    },
    registry: {
      visible: true,
      rowCount: operations.length,
      rows: operations.map((operation) => ({
        id: `registry-${operation.seedKey}`,
        project_ref: 'testref1234567890',
        tenant_id: operation.tableName === 'auth.users' ? null : '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e',
        entity_type: operation.entityType,
        seed_key: operation.seedKey,
        record_table: operation.tableName,
        record_id: operation.tableName === 'auth.users'
          ? 'auth-provisioned-user'
          : operation.targetIdentifiers.id,
        checksum: operation.checksum,
      })),
      status: 'ok',
    },
    protectedSnapshotMatchesBaseline: false,
    resolvedTargets: operations.map((operation) => ({
      seedKey: operation.seedKey,
      tableName: operation.tableName,
      expectedId: operation.tableName === 'auth.users'
        ? 'auth-provisioned-user'
        : operation.targetIdentifiers.id || null,
      exists: true,
      resolvedId: operation.tableName === 'auth.users'
        ? 'auth-provisioned-user'
        : operation.targetIdentifiers.id || null,
      tenantId: operation.targetIdentifiers.tenant_id || null,
      registryIdMatch: operation.tableName === 'auth.users' ? true : false,
      registryBackedUserExists: operation.tableName === 'auth.users' ? true : false,
    })),
    collisions: {
      authUser: { id: 'auth-provisioned-user', email: 'demo.owner+strasyk-pos@test.invalid' },
      tenantBySlug: { status: 'ok', rows: [{ id: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e', slug: 'strasyk-test-demo-restaurant' }], error: null },
      tenantById: { status: 'ok', rows: [{ id: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e' }], error: null },
      userAccessByEmail: { status: 'ok', rows: [{ id: 'f76cf1b6-8f75-4dc6-9f75-f6bfc1b8c5a0', tenant_id: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e' }], error: null },
      userAccessById: { status: 'ok', rows: [{ id: 'f76cf1b6-8f75-4dc6-9f75-f6bfc1b8c5a0', tenant_id: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e' }], error: null },
    },
  });
};

const buildFetchResponse = (body, status = 200) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return body;
  },
  async text() {
    return JSON.stringify(body);
  },
});

const OPENAPI_FIXTURE = {
  info: {
    title: 'STRASYK TEST',
    version: '1.0.0',
  },
  components: {
    schemas: {
      tenants: { properties: { id: {}, nom_commercial: {}, owner_email: {}, active: {}, subscription_plan: {}, pos_suspended: {}, slug: {}, created_date: {}, updated_date: {} } },
      restaurant_profiles: { properties: { id: {}, tenant_id: {}, nom_etablissement: {}, adresse: {}, telephone: {}, frais_livraison: {}, montant_minimum_livraison: {}, zone_livraison_km: {} } },
      categories: { properties: { id: {}, tenant_id: {}, nom: {}, disponible: {}, sort_order: {} } },
      products: { properties: { id: {}, tenant_id: {}, category_id: {}, nom: {}, prix: {}, base_price: {}, size_prices: {}, tva: {}, disponible: {} } },
      ingredients: { properties: { id: {}, tenant_id: {}, nom: {}, unite: {}, cout_unitaire: {}, quantite_stock: {} } },
      product_ingredients: { properties: { id: {}, tenant_id: {}, product_id: {}, ingredient_id: {}, quantite: {}, retirable: {} } },
      option_groups: { properties: { id: {}, tenant_id: {}, product_id: {}, nom: {}, selection_type: {}, min_selections: {}, max_selections: {}, required: {} } },
      option_items: { properties: { id: {}, tenant_id: {}, option_group_id: {}, nom: {}, price_surcharge: {}, size_surcharges: {} } },
      customers: { properties: { id: {}, tenant_id: {}, nom: {}, prenom: {}, telephone: {}, email: {}, cagnotte_balance: {} } },
      tables: { properties: { id: {}, tenant_id: {}, nom: {}, capacite: {}, forme: {}, statut: {} } },
      loyalty_rules: { properties: { id: {}, tenant_id: {}, nom: {}, active: {}, type_recompense: {}, valeur_recompense: {} } },
      cagnotte_rules: { properties: { id: {}, tenant_id: {}, nom: {}, active: {}, accumulation_rate: {} } },
      delivery_people: { properties: { id: {}, tenant_id: {}, nom: {}, prenom: {}, telephone: {}, user_email: {}, username: {}, disponible: {} } },
      orders: { properties: { id: {}, tenant_id: {}, numero_commande: {}, numero_caisse: {}, type_commande: {}, articles: {}, total_ht: {}, total_tva: {}, total_ttc: {}, statut: {}, mode_paiement: {}, payee: {}, customer_id: {}, table_id: {}, delivery_person_id: {} } },
      user_access: { properties: { id: {}, tenant_id: {}, user_email: {}, role: {}, is_active: {} } },
      platform_admin_access: { properties: { id: {}, user_email: {}, is_active: {} } },
    },
  },
};

const SWAGGER2_FIXTURE = {
  swagger: '2.0',
  info: {
    title: 'standard public schema',
    version: '14.5',
  },
  paths: {
    '/': { get: {} },
    '/tenants': { get: {} },
    '/restaurant_profiles': { get: {} },
    '/orders': { get: {} },
  },
  definitions: {
    tenants: { properties: { id: {}, nom_commercial: {}, owner_email: {}, active: {}, subscription_plan: {}, pos_suspended: {}, slug: {}, created_date: {}, updated_date: {} } },
    restaurant_profiles: { properties: { id: {}, tenant_id: {}, nom_etablissement: {}, adresse: {}, telephone: {}, frais_livraison: {}, montant_minimum_livraison: {}, zone_livraison_km: {} } },
    categories: { properties: { id: {}, tenant_id: {}, nom: {}, disponible: {}, sort_order: {} } },
    products: { properties: { id: {}, tenant_id: {}, category_id: {}, nom: {}, prix: {}, base_price: {}, size_prices: {}, tva: {}, disponible: {} } },
    ingredients: { properties: { id: {}, tenant_id: {}, nom: {}, unite: {}, cout_unitaire: {}, quantite_stock: {} } },
    product_ingredients: { properties: { id: {}, tenant_id: {}, product_id: {}, ingredient_id: {}, quantite: {}, retirable: {} } },
    option_groups: { properties: { id: {}, tenant_id: {}, product_id: {}, nom: {}, selection_type: {}, min_selections: {}, max_selections: {}, required: {} } },
    option_items: { properties: { id: {}, tenant_id: {}, option_group_id: {}, nom: {}, price_surcharge: {}, size_surcharges: {} } },
    customers: { properties: { id: {}, tenant_id: {}, nom: {}, prenom: {}, telephone: {}, email: {}, cagnotte_balance: {} } },
    tables: { properties: { id: {}, tenant_id: {}, nom: {}, capacite: {}, forme: {}, statut: {} } },
    loyalty_rules: { properties: { id: {}, tenant_id: {}, nom: {}, active: {}, type_recompense: {}, valeur_recompense: {} } },
    cagnotte_rules: { properties: { id: {}, tenant_id: {}, nom: {}, active: {}, accumulation_rate: {} } },
    delivery_people: { properties: { id: {}, tenant_id: {}, nom: {}, prenom: {}, telephone: {}, user_email: {}, username: {}, disponible: {} } },
    orders: { properties: { id: {}, tenant_id: {}, numero_commande: {}, numero_caisse: {}, type_commande: {}, articles: {}, total_ht: {}, total_tva: {}, total_ttc: {}, statut: {}, mode_paiement: {}, payee: {}, customer_id: {}, table_id: {}, delivery_person_id: {} } },
    user_access: { properties: { id: {}, tenant_id: {}, user_email: {}, role: {}, is_active: {} } },
    platform_admin_access: { properties: { id: {}, user_email: {}, is_active: {} } },
  },
};

const TEST_CASES = [
  {
    name: 'loads provisioning env from dedicated file only',
    run() {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-provisioning-env-'));
      const provisioningEnvPath = path.join(tempDir, '.env.test-provisioning.local');
      const frontEnvPath = path.join(tempDir, '.env.local');
      fs.writeFileSync(provisioningEnvPath, [
        'STRASYK_TEST_ENVIRONMENT_NAME=staging-demo',
        'STRASYK_TEST_ENVIRONMENT_CONFIRMATION=staging-demo',
        'SUPABASE_URL=https://testref1234567890.supabase.co',
        'SUPABASE_PROJECT_REF=testref1234567890',
        'SUPABASE_SERVICE_ROLE_KEY=sb_secret_verySensitiveValue',
        'STRASYK_TEST_ALLOWED_PROJECT_REFS=testref1234567890',
      ].join('\n'));
      fs.writeFileSync(frontEnvPath, 'SUPABASE_SERVICE_ROLE_KEY=should_not_be_loaded');

      const config = buildRuntimeConfig({
        argv: ['status'],
        processEnv: {},
        cwd: tempDir,
      });

      assert.equal(config.serviceRoleKey, 'sb_secret_verySensitiveValue');
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  },
  {
    name: 'parses swagger2 definitions from PostgREST openapi',
    async run() {
      const report = await inspectSupabaseSchema(buildConfig(), { fetchImpl: buildFetchResponse(SWAGGER2_FIXTURE) });
      assert.equal(report.availableTables.includes('tenants'), true);
      assert.equal(report.inspectedTables.find((table) => table.tableName === 'tenants')?.present, true);
      assert.equal(report.openApiVisibility.visibleTablesCount > 0, true);
    },
  },
  {
    name: 'fails when required environment variable is missing',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ STRASYK_TEST_ENVIRONMENT_NAME: '' })),
        /STRASYK_TEST_ENVIRONMENT_NAME is required/,
      );
    },
  },
  {
    name: 'fails when service role key is missing',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ SUPABASE_SERVICE_ROLE_KEY: '' })),
        /SUPABASE_SERVICE_ROLE_KEY is required/,
      );
    },
  },
  {
    name: 'blocks environments containing prod',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ STRASYK_TEST_ENVIRONMENT_NAME: 'prod-demo' })),
        /forbidden production-like markers/,
      );
    },
  },
  {
    name: 'blocks environments containing production',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ STRASYK_TEST_ENVIRONMENT_NAME: 'production-copy' })),
        /forbidden production-like markers/,
      );
    },
  },
  {
    name: 'blocks environments containing live',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ STRASYK_TEST_ENVIRONMENT_NAME: 'live-showroom' })),
        /forbidden production-like markers/,
      );
    },
  },
  {
    name: 'blocks incorrect project ref',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ SUPABASE_PROJECT_REF: 'unknownref000000' })),
        /project ref is not present in the authorized allowlist/,
      );
    },
  },
  {
    name: 'blocks project not present in allowlist',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ STRASYK_TEST_ALLOWED_PROJECT_REFS: 'qa-only-project' })),
        /project ref is not present in the authorized allowlist/,
      );
    },
  },
  {
    name: 'blocks url inconsistent with project ref',
    run() {
      assert.throws(
        () => assertSafeEnvironment(buildConfig({ SUPABASE_URL: 'https://anotherref123456.supabase.co' })),
        /SUPABASE_URL is inconsistent with SUPABASE_PROJECT_REF/,
      );
    },
  },
  {
    name: 'redacts secrets in logs',
    run() {
      const redacted = redactSecrets({
        serviceRoleKey: 'sb_secret_verySensitiveValue',
        nested: {
          password: 'DemoPassword123',
        },
        message: 'Authorization Bearer sb_secret_verySensitiveValue',
      });

      assert.equal(redacted.serviceRoleKey.includes('verySensitiveValue'), false);
      assert.equal(redacted.nested.password.includes('DemoPassword123'), false);
      assert.equal(redacted.message.includes('verySensitiveValue'), false);
    },
  },
  {
    name: 'detects missing critical table',
    async run() {
      const schema = structuredClone(OPENAPI_FIXTURE);
      delete schema.components.schemas.orders;
      const report = await inspectSupabaseSchema(buildConfig(), { fetchImpl: buildFetchResponse(schema) });
      assert.deepEqual(report.differences.missingCriticalTables, ['orders']);
    },
  },
  {
    name: 'detects missing critical column',
    async run() {
      const schema = structuredClone(OPENAPI_FIXTURE);
      delete schema.components.schemas.orders.properties.mode_paiement;
      const report = await inspectSupabaseSchema(buildConfig(), { fetchImpl: buildFetchResponse(schema) });
      assert.deepEqual(report.differences.missingCriticalColumns, ['orders.mode_paiement']);
    },
  },
  {
    name: 'dry-run report guarantees zero writes',
    async run() {
      const report = await inspectSupabaseSchema(buildConfig(), { fetchImpl: buildFetchResponse(OPENAPI_FIXTURE) });
      const metrics = buildMetricsFixture();
      const dryRunReport = buildDryRunReport({
        config: buildConfig(),
        schemaReport: report,
        beforeMetrics: metrics,
        afterMetrics: metrics,
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(dryRunReport.guarantees.writesPerformed, false);
      assert.equal(dryRunReport.guarantees.usersCreated, 0);
      assert.equal(dryRunReport.guarantees.rowsInserted, 0);
      assert.equal(dryRunReport.guarantees.rowsUpdated, 0);
      assert.equal(dryRunReport.guarantees.rowsDeleted, 0);
    },
  },
  {
    name: 'status and dry-run are stable across repeated runs',
    async run() {
      const config = buildConfig();
      const report = await inspectSupabaseSchema(config, { fetchImpl: buildFetchResponse(OPENAPI_FIXTURE) });
      const metrics = buildMetricsFixture();
      const statusA = buildStatusReport({ config, schemaReport: report, metrics });
      const statusB = buildStatusReport({ config, schemaReport: report, metrics });
      const readModel = buildStage2ReadModelFixture();
      const dryRunA = buildDryRunReport({ config, schemaReport: report, beforeMetrics: metrics, afterMetrics: metrics, readModel });
      const dryRunB = buildDryRunReport({ config, schemaReport: report, beforeMetrics: metrics, afterMetrics: metrics, readModel });
      assert.deepEqual(statusA, statusB);
      assert.deepEqual(dryRunA, dryRunB);
    },
  },
  {
    name: 'schema compatibility is false when a critical table is missing',
    async run() {
      const schema = structuredClone(OPENAPI_FIXTURE);
      delete schema.components.schemas.customers;
      const report = await inspectSupabaseSchema(buildConfig(), { fetchImpl: buildFetchResponse(schema) });
      const compatibility = assertSchemaCompatibleForStepOne(report);
      assert.equal(compatibility.compatible, false);
      assert.equal(compatibility.reason, 'missing_critical_tables');
    },
  },
  {
    name: 'does not interpret empty openapi visibility as an empty database',
    async run() {
      const report = await inspectSupabaseSchema(buildConfig(), {
        fetchImpl: buildFetchResponse({
          info: { title: 'standard public schema', version: '14.5' },
          paths: {
            '/': { get: {} },
          },
          definitions: {},
        }),
      });
      assert.equal(report.differences.noTablesVisibleViaOpenApi, true);
      assert.deepEqual(report.differences.missingCriticalTables, []);
      assert.equal(report.openApiVisibility.interpretation.includes('No tables are visible via the PostgREST OpenAPI document'), true);
    },
  },
  {
    name: 'stage2 dry-run blocks real execution when registry is missing',
    run() {
      const plan = buildStage2DryRunPlan({
        schemaReport: {},
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(plan.realExecutionAllowed, false);
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'registry_missing'), true);
    },
  },
  {
    name: 'stage2 dry-run blocks collisions with existing auth user or tenant',
    run() {
      const plan = buildStage2DryRunPlan({
        schemaReport: {},
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture({
          collisions: {
            authUser: { id: 'u1', email: 'demo.owner+strasyk-pos@test.invalid' },
            tenantBySlug: { status: 'ok', rows: [{ id: 't1', slug: 'strasyk-test-demo-restaurant' }], error: null },
            tenantById: { status: 'ok', rows: [], error: null },
            userAccessByEmail: { status: 'ok', rows: [], error: null },
            userAccessById: { status: 'ok', rows: [], error: null },
          },
        }),
      });
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'auth_user_collision'), true);
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'tenant_slug_collision'), true);
    },
  },
  {
    name: 'stage2 dry-run never includes delivery password in payloads',
    run() {
      const plan = buildStage2DryRunPlan({
        schemaReport: {},
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      const deliveryOperation = plan.wouldCreate.find((item) => item.tableName === 'delivery_people');
      assert.ok(deliveryOperation);
      assert.equal(Object.prototype.hasOwnProperty.call(deliveryOperation.payloadPreview, 'password'), false);
    },
  },
  {
    name: 'stage2 dry-run counts registry writes separately from business writes',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(plan.mutationSummary.creationsAuth, 1);
      assert.equal(plan.mutationSummary.insertionsMetier, 29);
      assert.equal(plan.mutationSummary.insertionsRegistre, 30);
      assert.equal(plan.mutationSummary.totalMutationsPrevues, 60);
    },
  },
  {
    name: 'stage2 dry-run recognizes an already provisioned identical environment as no-op',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildProvisionedReadModelFixture(),
      });
      assert.equal(plan.alreadyProvisioned, true);
      assert.equal(plan.noOp, true);
      assert.equal(plan.realExecutionAllowed, false);
      assert.equal(plan.executionState, 'already_provisioned');
      assert.equal(plan.plannedMutations, 0);
      assert.equal(plan.mutationSummary.totalMutationsPrevues, 0);
      assert.equal(plan.wouldRefuse.length, 0);
      assert.equal(plan.registryState.recognizedRegistryCount, 30);
    },
  },
  {
    name: 'stage2 read model re-reads tenants without projecting tenant_id',
    async run() {
      const selectCalls = [];
      const supabaseAdmin = {
        from(tableName) {
          return {
            select(columns) {
              selectCalls.push({ tableName, columns });
              return {
                in() {
                  return {
                    limit() {
                      return Promise.resolve({ data: [{ id: 'tenant-root-id' }], error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };

      const operations = [
        {
          tableName: 'tenants',
          targetIdentifiers: { id: 'tenant-root-id' },
        },
        {
          tableName: 'categories',
          targetIdentifiers: { id: 'category-child-id' },
        },
      ];

      const result = await resolveTargetsByTable(supabaseAdmin, operations);

      assert.equal(selectCalls.find((call) => call.tableName === 'tenants')?.columns, 'id');
      assert.equal(selectCalls.find((call) => call.tableName === 'categories')?.columns, 'id,tenant_id');
      assert.equal(result.tenants.rows[0].id, 'tenant-root-id');
    },
  },
  {
    name: 'stage2 dry-run blocks an incomplete registry state',
    run() {
      const provisioned = buildProvisionedReadModelFixture();
      const partialRows = provisioned.registry.rows.slice(0, 10);
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: {
          ...provisioned,
          registry: {
            ...provisioned.registry,
            rowCount: partialRows.length,
            rows: partialRows,
          },
        },
      });
      assert.equal(plan.alreadyProvisioned, false);
      assert.equal(plan.plannedMutations, 0);
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'partial_registry_state'), true);
    },
  },
  {
    name: 'stage2 dry-run blocks when a registry row exists but the object is missing',
    run() {
      const provisioned = buildProvisionedReadModelFixture();
      const readModel = {
        ...provisioned,
        resolvedTargets: provisioned.resolvedTargets.map((item) => (
          item.seedKey === 'strasyk-pos-test:product:tiramisu'
            ? { ...item, exists: false, resolvedId: null }
            : item
        )),
      };
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel,
      });
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'registry_present_but_object_absent'), true);
      assert.equal(plan.plannedMutations, 0);
    },
  },
  {
    name: 'stage2 dry-run blocks when a registry checksum differs from the canonical checksum',
    run() {
      const provisioned = buildProvisionedReadModelFixture();
      const rows = provisioned.registry.rows.map((row) => (
        row.seed_key === 'strasyk-pos-test:product:coca-cola'
          ? { ...row, checksum: 'drifted-checksum' }
          : row
      ));
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: {
          ...provisioned,
          registry: {
            ...provisioned.registry,
            rows,
          },
        },
      });
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'checksum_drift'), true);
      assert.equal(plan.plannedMutations, 0);
    },
  },
  {
    name: 'stage2 dry-run blocks when an object exists without a registry row',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture({
          registry: {
            visible: true,
            rowCount: 0,
            rows: [],
            status: 'ok',
          },
          resolvedTargets: buildStage2WriteOperations().map((operation) => ({
            seedKey: operation.seedKey,
            tableName: operation.tableName,
            expectedId: operation.targetIdentifiers.id || null,
            exists: operation.seedKey === 'strasyk-pos-test:product:pizza-margherita',
            resolvedId: operation.seedKey === 'strasyk-pos-test:product:pizza-margherita'
              ? operation.targetIdentifiers.id
              : null,
            tenantId: operation.targetIdentifiers.tenant_id || null,
            registryIdMatch: false,
            registryBackedUserExists: false,
          })),
        }),
      });
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'object_present_but_registry_absent'), true);
      assert.equal(plan.plannedMutations, 0);
    },
  },
  {
    name: 'stage2 dry-run remains total no-op on a simulated second execution',
    run() {
      const report = buildDryRunReport({
        config: buildConfig(),
        schemaReport: {
          differences: {
            missingCriticalTables: [],
            missingCriticalColumns: [],
          },
          optionalProvisioningRegistry: { present: true, tableName: 'provisioning_registry' },
        },
        beforeMetrics: buildMetricsFixture(),
        afterMetrics: buildMetricsFixture(),
        readModel: buildProvisionedReadModelFixture(),
      });
      assert.equal(report.alreadyProvisioned, true);
      assert.equal(report.noOp, true);
      assert.equal(report.plannedMutations, 0);
      assert.equal(report.plan.wouldRefuse.length, 0);
    },
  },
  {
    name: 'stage2 dry-run exposes checksum policy and per-entity checksums',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(plan.checksumPolicy.driftBehavior, 'refuse_with_diagnostic');
      assert.equal(typeof plan.futureWriteOrder[0].checksum, 'string');
      assert.equal(plan.futureWriteOrder[0].checksum.length, 64);
    },
  },
  {
    name: 'stage2 dry-run refuses protected id collisions even when counts match',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture({
          protectedSnapshot: {
            capturedAt: '2026-07-29T10:00:00.000Z',
            authUsers: [],
            tenants: [{ id: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e', slug: 'occupied', owner_email: 'x@test.invalid', nom_commercial: 'Protected', active: true }],
            restaurantProfiles: [],
            userAccess: [],
          },
        }),
      });
      assert.equal(plan.wouldRefuse.some((item) => item.reason === 'protected_tenant_id_collision'), true);
    },
  },
  {
    name: 'stage2 dry-run uses a strict rollback strategy bound to registry keys only',
    run() {
      const plan = buildStage2DryRunPlan({
        schemaReport: {},
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(plan.rollbackPlan.enabled, false);
      assert.equal(plan.rollbackPlan.blockedReason.includes('provisioning_registry'), true);
      assert.equal(plan.rollbackPlan.deleteOrder[0].tableName, 'provisioning_registry');
      assert.equal(plan.rollbackPlan.deleteOrder.some((item) => item.deleteStrategy === 'delete_tenant_last_among_business_rows_by_exact_record_id_only'), true);
    },
  },
  {
    name: 'stage2 dry-run documents targeted compensation for auth success then tenant failure',
    run() {
      const plan = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      });
      assert.equal(plan.failureCompensationPlan.scenarioAuthThenTenantFailure[2].deleteStrategy, 'delete_exact_auth_user_id_from_current_run_journal_only');
      assert.equal(plan.failureCompensationPlan.rollbackOrder[0], 'delete_registry_entries_for_current_run_in_reverse_order');
    },
  },
  {
    name: 'partial failure compensation restores baseline after tenant creation failure',
    run() {
      const result = simulateStage2FailureCompensation({
        protectedSnapshot: buildStage2ReadModelFixture().protectedSnapshot,
        failureAfterBusinessSeedKey: 'strasyk-pos-test:tenant:canonical',
      });
      assert.equal(result.failure?.seedKey, 'strasyk-pos-test:tenant:canonical');
      assert.equal(result.baselineRestored, true);
      assert.equal(result.failedCompensations.length, 0);
      assert.deepEqual(result.remainingCreatedEntriesAfterCompensation, []);
    },
  },
  {
    name: 'partial failure compensation restores baseline after restaurant profile creation failure',
    run() {
      const result = simulateStage2FailureCompensation({
        protectedSnapshot: buildStage2ReadModelFixture().protectedSnapshot,
        failureAfterBusinessSeedKey: 'strasyk-pos-test:profile:restaurant',
      });
      assert.equal(result.failure?.seedKey, 'strasyk-pos-test:profile:restaurant');
      assert.equal(result.baselineRestored, true);
      assert.equal(result.compensations.some((item) => item.tableName === 'tenants'), true);
      assert.equal(result.compensations.at(-1).tableName, 'auth.users');
    },
  },
  {
    name: 'partial failure compensation restores baseline in the middle of catalog writes',
    run() {
      const result = simulateStage2FailureCompensation({
        protectedSnapshot: buildStage2ReadModelFixture().protectedSnapshot,
        failureAfterBusinessSeedKey: 'strasyk-pos-test:product:coca-cola',
      });
      assert.equal(result.failure?.seedKey, 'strasyk-pos-test:product:coca-cola');
      assert.equal(result.baselineRestored, true);
      assert.equal(result.compensations.some((item) => item.tableName === 'products'), true);
      assert.deepEqual(result.remainingCreatedEntriesAfterCompensation, []);
    },
  },
  {
    name: 'partial failure compensation restores baseline when registry insert fails after a business create',
    run() {
      const result = simulateStage2FailureCompensation({
        protectedSnapshot: buildStage2ReadModelFixture().protectedSnapshot,
        failureAfterRegistrySeedKey: 'strasyk-pos-test:category:pizzas',
      });
      assert.equal(result.failure?.phase, 'register');
      assert.equal(result.failure?.seedKey, 'strasyk-pos-test:category:pizzas');
      assert.equal(result.baselineRestored, true);
      assert.equal(result.executionJournal.find((item) => item.seedKey === 'strasyk-pos-test:category:pizzas')?.registryRegistered, false);
    },
  },
  {
    name: 'partial failure compensation restores baseline after multiple business and registry writes',
    run() {
      const result = simulateStage2FailureCompensation({
        protectedSnapshot: buildStage2ReadModelFixture().protectedSnapshot,
        failureAfterRegistrySeedKey: 'strasyk-pos-test:product:tiramisu',
      });
      assert.equal(result.failure?.seedKey, 'strasyk-pos-test:product:tiramisu');
      assert.equal(result.baselineRestored, true);
      assert.equal(result.compensations.filter((item) => item.tableName === 'provisioning_registry').length > 0, true);
      assert.equal(result.compensations.at(-1).tableName, 'auth.users');
    },
  },
  {
    name: 'canonical tenant payload uses the application-supported subscription plan',
    run() {
      const provisionModule = fs.readFileSync(path.join(process.cwd(), 'scripts/test-provisioning/provision.mjs'), 'utf8');
      assert.equal(CANONICAL_TENANT_SUBSCRIPTION_PLAN, 'basic');
      assert.equal(provisionModule.includes("subscription_plan: CANONICAL_TENANT_SUBSCRIPTION_PLAN"), true);
    },
  },
  {
    name: 'tenant payload validation rejects the unsupported demo subscription plan',
    run() {
      const issues = validateTenantPayload({
        id: 'tenant-id',
        nom_commercial: 'STRASYK TEST DEMO RESTAURANT',
        slug: 'strasyk-test-demo-restaurant',
        owner_email: 'demo.owner+strasyk-pos@test.invalid',
        active: true,
        subscription_plan: 'demo',
        pos_suspended: false,
      });
      assert.equal(issues.length, 1);
      assert.equal(issues[0].code, 'UNSUPPORTED_SUBSCRIPTION_PLAN');
    },
  },
  {
    name: 'canonical payload validation rejects a sized product with prix null before writes',
    run() {
      const operations = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      }).futureWriteOrder;
      const payloads = buildCanonicalPayloadsBySeedKey();
      payloads['strasyk-pos-test:product:pizza-margherita'] = {
        ...payloads['strasyk-pos-test:product:pizza-margherita'],
        prix: null,
      };

      const validation = validateCanonicalPayloads(payloads, operations);
      assert.equal(validation.valid, false);
      assert.equal(validation.issues.some((issue) => issue.tableName === 'products' && issue.field === 'prix'), true);
    },
  },
  {
    name: 'canonical payload validation accepts a sized product with the smallest size price as prix',
    run() {
      const operations = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      }).futureWriteOrder;
      const payloads = buildCanonicalPayloadsBySeedKey();
      const validation = validateCanonicalPayloads(payloads, operations);
      assert.equal(validation.valid, true);
    },
  },
  {
    name: 'canonical sized product keeps prix, base_price and size_prices aligned with POS logic',
    run() {
      const payloads = buildCanonicalPayloadsBySeedKey();
      const pizza = payloads['strasyk-pos-test:product:pizza-margherita'];
      assert.equal(pizza.prix, 11.9);
      assert.equal(pizza.base_price, null);
      assert.deepEqual(pizza.size_prices, [
        { size: 'Petite', price: 11.9 },
        { size: 'Grande', price: 13.9 },
      ]);
    },
  },
  {
    name: 'canonical product payloads contain no forbidden nulls for known required fields',
    run() {
      const operations = buildStage2DryRunPlan({
        metrics: buildMetricsFixture(),
        readModel: buildStage2ReadModelFixture(),
      }).futureWriteOrder;
      const payloads = buildCanonicalPayloadsBySeedKey();
      const validation = validateCanonicalPayloads(payloads, operations);
      assert.deepEqual(validation.issues, []);
    },
  },
  {
    name: 'tenant insert diagnostics include sanitized payload shape and Supabase error fields',
    run() {
      const payload = {
        id: 'tenant-id',
        nom_commercial: 'STRASYK TEST DEMO RESTAURANT',
        slug: 'strasyk-test-demo-restaurant',
        owner_email: 'demo.owner+strasyk-pos@test.invalid',
        active: true,
        subscription_plan: 'basic',
        pos_suspended: false,
      };
      const details = buildSupabaseErrorDetails({
        operation: {
          tableName: 'tenants',
          seedKey: 'strasyk-pos-test:tenant:canonical',
        },
        payload,
        error: {
          message: 'new row violates check constraint',
          code: '23514',
          details: 'Failing row contains invalid subscription_plan.',
          hint: 'Use a supported plan value.',
          status: 400,
          statusText: 'Bad Request',
        },
      });

      assert.equal(details.table, 'tenants');
      assert.equal(details.code, '23514');
      assert.equal(details.payloadColumns.includes('subscription_plan'), true);
      assert.equal(details.payloadTypes.subscription_plan, 'string');
      assert.equal(details.nullFields.length, 0);
      assert.equal(details.absentExpectedFields.includes('owner_id'), true);
    },
  },
  {
    name: 'payload shape classifies nulls and absences without exposing values',
    run() {
      const shape = describePayloadShape({
        id: 'tenant-id',
        settings: null,
        active: true,
        tags: [],
      });

      assert.equal(shape.valueTypes.id, 'string');
      assert.equal(shape.valueTypes.settings, 'null');
      assert.equal(shape.valueTypes.tags, 'array');
      assert.equal(shape.nullFields.includes('settings'), true);
      assert.equal(shape.absentOptionalFields.includes('owner_id'), true);
    },
  },
  {
    name: 'tenants readback fields exclude tenant_id for the root table',
    run() {
      assert.deepEqual(getProvisioningReadbackFields('tenants'), ['id']);
    },
  },
  {
    name: 'child table readback fields keep tenant_id when the column exists',
    run() {
      assert.deepEqual(getProvisioningReadbackFields('categories'), ['id', 'tenant_id']);
    },
  },
  {
    name: 'provisioning insert uses id-only readback for tenants',
    async run() {
      const calls = [];
      const supabaseAdmin = {
        from(tableName) {
          return {
            insert(payload) {
              calls.push({ step: 'insert', tableName, payload });
              return Promise.resolve({ error: null });
            },
            select(fields) {
              calls.push({ step: 'select', tableName, fields });
              return {
                eq(column, value) {
                  calls.push({ step: 'eq', tableName, column, value });
                  return {
                    single() {
                      return Promise.resolve({ data: { id: value }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };

      const data = await insertProvisioningBusinessRow({
        supabaseAdmin,
        operation: {
          seedKey: 'strasyk-pos-test:tenant:canonical',
          tableName: 'tenants',
          targetIdentifiers: { id: 'tenant-root-id' },
        },
        payload: {
          id: 'tenant-root-id',
          nom_commercial: 'Root Tenant',
          slug: 'root-tenant',
          owner_email: 'root@test.invalid',
          active: true,
          subscription_plan: 'basic',
          pos_suspended: false,
        },
      });

      assert.equal(data.id, 'tenant-root-id');
      assert.equal(calls.find((call) => call.step === 'select')?.fields, 'id');
      assert.deepEqual(calls.find((call) => call.step === 'eq'), { step: 'eq', tableName: 'tenants', column: 'id', value: 'tenant-root-id' });
    },
  },
  {
    name: 'provisioning insert keeps tenant_id readback for child tables',
    async run() {
      const calls = [];
      const supabaseAdmin = {
        from(tableName) {
          return {
            insert(payload) {
              calls.push({ step: 'insert', tableName, payload });
              return Promise.resolve({ error: null });
            },
            select(fields) {
              calls.push({ step: 'select', tableName, fields });
              return {
                eq(column, value) {
                  calls.push({ step: 'eq', tableName, column, value });
                  return {
                    single() {
                      return Promise.resolve({ data: { id: value, tenant_id: 'tenant-1' }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };

      const data = await insertProvisioningBusinessRow({
        supabaseAdmin,
        operation: {
          seedKey: 'strasyk-pos-test:category:pizzas',
          tableName: 'categories',
          targetIdentifiers: { id: 'category-id' },
        },
        payload: {
          id: 'category-id',
          tenant_id: 'tenant-1',
          nom: 'Pizzas',
        },
      });

      assert.equal(data.tenant_id, 'tenant-1');
      assert.equal(calls.find((call) => call.step === 'select')?.fields, 'id,tenant_id');
    },
  },
  {
    name: 'true insert errors remain distinct from readback errors',
    async run() {
      const insertErrorSupabase = {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        details: 'Key (slug) already exists.',
        hint: null,
        status: 409,
        statusText: 'Conflict',
      };
      const readbackErrorSupabase = {
        message: 'column tenants.tenant_id does not exist',
        code: '42703',
        details: null,
        hint: null,
        status: null,
        statusText: null,
      };

      await assert.rejects(
        () => insertProvisioningBusinessRow({
          supabaseAdmin: {
            from() {
              return {
                insert() {
                  return Promise.resolve({ error: insertErrorSupabase });
                },
              };
            },
          },
          operation: {
            seedKey: 'strasyk-pos-test:tenant:canonical',
            tableName: 'tenants',
            targetIdentifiers: { id: 'tenant-id' },
          },
          payload: {
            id: 'tenant-id',
            nom_commercial: 'Tenant',
            slug: 'tenant',
            owner_email: 'tenant@test.invalid',
            active: true,
            subscription_plan: 'basic',
            pos_suspended: false,
          },
        }),
        (error) => {
          assert.equal(error.code, 'BUSINESS_INSERT_FAILED');
          assert.equal(error.cause?.code, '23505');
          return true;
        },
      );

      await assert.rejects(
        () => insertProvisioningBusinessRow({
          supabaseAdmin: {
            from() {
              return {
                insert() {
                  return Promise.resolve({ error: null });
                },
                select() {
                  return {
                    eq() {
                      return {
                        single() {
                          return Promise.resolve({ data: null, error: readbackErrorSupabase });
                        },
                      };
                    },
                  };
                },
              };
            },
          },
          operation: {
            seedKey: 'strasyk-pos-test:tenant:canonical',
            tableName: 'tenants',
            targetIdentifiers: { id: 'tenant-id' },
          },
          payload: {
            id: 'tenant-id',
            nom_commercial: 'Tenant',
            slug: 'tenant',
            owner_email: 'tenant@test.invalid',
            active: true,
            subscription_plan: 'basic',
            pos_suspended: false,
          },
        }),
        (error) => {
          assert.equal(error.code, 'BUSINESS_READBACK_FAILED');
          assert.equal(error.cause?.code, '42703');
          return true;
        },
      );
    },
  },
  ...[
    {
      label: 'check constraint',
      supabaseError: {
        message: 'new row violates check constraint',
        code: '23514',
        details: 'Failing row contains invalid subscription_plan.',
        hint: null,
        status: 400,
        statusText: 'Bad Request',
      },
    },
    {
      label: 'RLS violation',
      supabaseError: {
        message: 'new row violates row-level security policy',
        code: '42501',
        details: 'Permission denied for table tenants.',
        hint: 'Check policy for INSERT.',
        status: 403,
        statusText: 'Forbidden',
      },
    },
    {
      label: 'unique violation',
      supabaseError: {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        details: 'Key (slug)=(strasyk-test-demo-restaurant) already exists.',
        hint: null,
        status: 409,
        statusText: 'Conflict',
      },
    },
    {
      label: 'foreign key violation',
      supabaseError: {
        message: 'insert or update on table "tenants" violates foreign key constraint',
        code: '23503',
        details: 'Key (owner_id)=(missing-user-id) is not present in table "users".',
        hint: null,
        status: 409,
        statusText: 'Conflict',
      },
    },
    {
      label: 'error without details or hint',
      supabaseError: {
        message: 'unexpected insert failure',
        code: 'XX000',
        details: null,
        hint: null,
        status: 500,
        statusText: 'Internal Server Error',
      },
    },
  ].map(({ label, supabaseError }) => ({
    name: `final provisioning error preserves original Supabase diagnostics for ${label}`,
    run() {
      const payload = {
        id: 'tenant-id',
        nom_commercial: 'STRASYK TEST DEMO RESTAURANT',
        slug: 'strasyk-test-demo-restaurant',
        owner_email: 'demo.owner+strasyk-pos@test.invalid',
        active: true,
        subscription_plan: 'basic',
        pos_suspended: false,
      };

      const businessError = new ProvisioningError('Insert failed for tenants.', {
        code: 'BUSINESS_INSERT_FAILED',
        details: buildSupabaseErrorDetails({
          operation: { tableName: 'tenants', seedKey: 'strasyk-pos-test:tenant:canonical' },
          payload,
          error: supabaseError,
        }),
        cause: supabaseError,
      });

      const finalError = new ProvisioningError('Provisioning failed and compensation was triggered.', {
        code: 'PROVISIONING_FAILED_WITH_COMPENSATION',
        details: {
          compensation: {
            failure: { message: 'Insert failed for tenants.', code: 'BUSINESS_INSERT_FAILED' },
            compensations: [],
            blockedCompensations: [],
            baselineRestored: true,
          },
          baselineRestored: true,
          journal: [{ tableName: 'tenants', seedKey: 'strasyk-pos-test:tenant:canonical', createdId: 'tenant-id' }],
          createdRecords: [{ tableName: 'tenants', seedKey: 'strasyk-pos-test:tenant:canonical', createdId: 'tenant-id' }],
          deletedRecords: [],
          blockedCompensations: [],
        },
        cause: businessError,
      });

      const serialized = serializeProvisioningError(finalError);

      assert.equal(serialized.code, 'PROVISIONING_FAILED_WITH_COMPENSATION');
      assert.equal(serialized.operation, 'strasyk-pos-test:tenant:canonical');
      assert.equal(serialized.table, 'tenants');
      assert.equal(serialized.supabaseMessage, supabaseError.message);
      assert.equal(serialized.supabaseCode, supabaseError.code);
      assert.equal(serialized.details, supabaseError.details);
      assert.equal(serialized.hint, supabaseError.hint);
      assert.equal(serialized.status, supabaseError.status);
      assert.equal(serialized.statusText, supabaseError.statusText);
      assert.deepEqual(serialized.payloadColumns, Object.keys(payload));
      assert.equal(serialized.payloadTypes.subscription_plan, 'string');
      assert.equal(serialized.nullFields.length, 0);
      assert.equal(serialized.absentExpectedFields.includes('owner_id'), true);
      assert.equal(serialized.baselineRestored, true);
      assert.equal(Array.isArray(serialized.compensation?.compensations), true);
      assert.equal(serialized.journal.length, 1);
      assert.equal(serialized.createdRecords.length, 1);
      assert.equal(serialized.deletedRecords.length, 0);
      assert.equal(serialized.blockedCompensations.length, 0);
      assert.equal(serialized.cause?.message, 'Insert failed for tenants.');
      assert.equal(serialized.cause?.code, 'BUSINESS_INSERT_FAILED');
      assert.equal(serialized.cause?.cause?.message, supabaseError.message);
      assert.equal(serialized.cause?.cause?.code, supabaseError.code);
      assert.equal(serialized.cause?.cause?.details, supabaseError.details);
      assert.equal(serialized.cause?.cause?.hint, supabaseError.hint);

      const logger = createLogger();
      const captured = [];
      const originalError = console.error;
      console.error = (line) => captured.push(line);
      try {
        logger.error(finalError.message, redactSecrets(serialized));
      } finally {
        console.error = originalError;
      }

      assert.equal(captured.length, 1);
      assert.equal(captured[0].includes('"operation":"strasyk-pos-test:tenant:canonical"'), true);
      assert.equal(captured[0].includes('"table":"tenants"'), true);
      assert.equal(captured[0].includes(`"supabaseCode":"${supabaseError.code}"`), true);
      assert.equal(captured[0].includes('"payloadColumns"'), true);
      assert.equal(captured[0].includes('"baselineRestored":true'), true);
      assert.equal(captured[0].includes('"createdRecords"'), true);
    },
  })),
];

export const runProvisioningTests = async () => {
  let passed = 0;

  for (const testCase of TEST_CASES) {
    await testCase.run();
    passed += 1;
  }

  return {
    total: TEST_CASES.length,
    passed,
    failed: 0,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await runProvisioningTests();
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  }
}
