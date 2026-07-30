import { createSupabaseAdminClient, countAuthUsers } from './supabaseAdmin.mjs';
import { SCHEMA_EXPECTATIONS } from './schemaExpectations.mjs';

const countTableRows = async (supabaseAdmin, tableName) => {
  const { count, error } = await supabaseAdmin
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    return {
      tableName,
      status: 'error',
      rowCount: null,
      error: error.message,
    };
  }

  return {
    tableName,
    status: 'ok',
    rowCount: count ?? 0,
    error: null,
  };
};

export const collectReadOnlyMetrics = async ({ config, schemaReport }) => {
  const supabaseAdmin = createSupabaseAdminClient(config);
  const tableNames = Object.keys(SCHEMA_EXPECTATIONS.requiredTables);
  const presentTableNames = new Set(
    (schemaReport.inspectedTables || [])
      .filter((table) => table.present)
      .map((table) => table.tableName),
  );

  const authUserCount = await countAuthUsers(supabaseAdmin);
  const tableCounts = await Promise.all(
    tableNames.map(async (tableName) => {
      if (!presentTableNames.has(tableName)) {
        return {
          tableName,
          status: 'missing',
          rowCount: null,
          error: null,
        };
      }

      return await countTableRows(supabaseAdmin, tableName);
    }),
  );

  const tenantCount = tableCounts.find((item) => item.tableName === 'tenants')?.rowCount ?? null;
  const restaurantProfileCount = tableCounts.find((item) => item.tableName === 'restaurant_profiles')?.rowCount ?? null;
  const provisioningRegistry = schemaReport.optionalProvisioningRegistry?.present
    ? await countTableRows(supabaseAdmin, schemaReport.optionalProvisioningRegistry.tableName)
    : {
      tableName: schemaReport.optionalProvisioningRegistry?.tableName || 'provisioning_registry',
      status: 'missing',
      rowCount: null,
      error: null,
    };

  return {
    authUserCount,
    tenantCount,
    restaurantProfileCount,
    tableCounts,
    provisioningRegistry,
  };
};
