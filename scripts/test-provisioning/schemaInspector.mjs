import { fetchPostgrestOpenApi } from './supabaseAdmin.mjs';
import { SCHEMA_EXPECTATIONS } from './schemaExpectations.mjs';

const normalizeProperties = (schemaNode) => Object.keys(schemaNode?.properties || {});

const ROOT_PATHS = new Set(['/']);

const extractVisibleTableNames = (openApiDocument) => {
  const pathNames = Object.keys(openApiDocument?.paths || {})
    .filter((pathName) => !ROOT_PATHS.has(pathName))
    .map((pathName) => pathName.replace(/^\/+/u, ''))
    .filter(Boolean);

  const definitionNames = Object.keys(openApiDocument?.definitions || {});
  const componentSchemaNames = Object.keys(openApiDocument?.components?.schemas || {});

  return [...new Set([...pathNames, ...definitionNames, ...componentSchemaNames])].sort();
};

const buildOpenApiTableIndex = (openApiDocument) => {
  const schemas = {
    ...(openApiDocument?.definitions || {}),
    ...(openApiDocument?.components?.schemas || {}),
  };

  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, normalizeProperties(schema)]),
  );
};

const compareExpectedColumns = (actualColumns, expectedColumns) => {
  const actualSet = new Set(actualColumns);
  const missingColumns = expectedColumns.filter((column) => !actualSet.has(column));
  const extraColumns = actualColumns.filter((column) => !expectedColumns.includes(column));
  return {
    missingColumns,
    extraColumns,
  };
};

const inferRelationStatus = (tableName, tableColumns, relations) => relations.map((relation) => {
  if (relation.fromTable !== tableName) return { ...relation, status: 'not_applicable' };
  const relationMissing = !tableColumns.includes(relation.fromColumn);
  return {
    ...relation,
    status: relationMissing ? 'column_missing' : 'column_present_relation_unverified',
  };
});

export const inspectSupabaseSchema = async (config, { fetchImpl = fetch } = {}) => {
  const openApiDocument = await fetchPostgrestOpenApi(config, fetchImpl);
  const openApiTables = buildOpenApiTableIndex(openApiDocument);
  const tableNames = extractVisibleTableNames(openApiDocument);
  const expectedTables = Object.keys(SCHEMA_EXPECTATIONS.requiredTables);
  const noTablesVisibleViaOpenApi = tableNames.length === 0;

  const tables = expectedTables.map((tableName) => {
    const actualColumns = openApiTables[tableName] || [];
    const present = actualColumns.length > 0;
    const expectedColumns = SCHEMA_EXPECTATIONS.requiredTables[tableName];
    const diff = compareExpectedColumns(actualColumns, expectedColumns);
    return {
      tableName,
      present,
      visibilityStatus: noTablesVisibleViaOpenApi
        ? 'not_visible_via_openapi'
        : (present ? 'visible_via_openapi' : 'not_listed_in_openapi'),
      actualColumns,
      expectedColumns,
      ...diff,
      relations: inferRelationStatus(tableName, actualColumns, SCHEMA_EXPECTATIONS.requiredRelations)
        .filter((relation) => relation.status !== 'not_applicable'),
    };
  });

  const missingCriticalTables = noTablesVisibleViaOpenApi
    ? []
    : tables
    .filter((table) => !table.present)
    .map((table) => table.tableName);

  const missingCriticalColumns = noTablesVisibleViaOpenApi
    ? []
    : tables
    .flatMap((table) => table.missingColumns.map((column) => `${table.tableName}.${column}`));

  const registryColumns = openApiTables[SCHEMA_EXPECTATIONS.optionalProvisioningRegistry.tableName] || [];
  const registryDiff = compareExpectedColumns(
    registryColumns,
    SCHEMA_EXPECTATIONS.optionalProvisioningRegistry.requiredColumns,
  );

  return {
    generatedAt: new Date().toISOString(),
    inspectedProjectRef: config.projectRef,
    docsSources: SCHEMA_EXPECTATIONS.docsSources,
    openApiInfo: {
      title: openApiDocument?.info?.title || '',
      version: openApiDocument?.info?.version || '',
    },
    openApiVisibility: {
      visibleTablesCount: tableNames.length,
      interpretation: noTablesVisibleViaOpenApi
        ? 'No tables are visible via the PostgREST OpenAPI document for the queried role and exposed schemas.'
        : 'Tables listed here are visible via the PostgREST OpenAPI document.',
    },
    availableTables: tableNames,
    inspectedTables: tables,
    optionalProvisioningRegistry: {
      tableName: SCHEMA_EXPECTATIONS.optionalProvisioningRegistry.tableName,
      present: registryColumns.length > 0,
      visibilityStatus: noTablesVisibleViaOpenApi
        ? 'not_visible_via_openapi'
        : (registryColumns.length > 0 ? 'visible_via_openapi' : 'not_listed_in_openapi'),
      actualColumns: registryColumns,
      missingColumns: registryDiff.missingColumns,
      extraColumns: registryDiff.extraColumns,
    },
    requiredRelations: SCHEMA_EXPECTATIONS.requiredRelations,
    differences: {
      noTablesVisibleViaOpenApi,
      missingCriticalTables,
      missingCriticalColumns,
      relationVerificationMode: 'read_only_openapi_column_check',
      relationVerificationLimitations: 'Live foreign key verification is not performed in step 1 because only read-only PostgREST schema discovery is allowed.',
    },
  };
};

export const assertSchemaCompatibleForStepOne = (schemaReport) => {
  if (schemaReport.differences.missingCriticalTables.length > 0) {
    return {
      compatible: false,
      reason: 'missing_critical_tables',
      details: schemaReport.differences.missingCriticalTables,
    };
  }

  if (schemaReport.differences.missingCriticalColumns.length > 0) {
    return {
      compatible: false,
      reason: 'missing_critical_columns',
      details: schemaReport.differences.missingCriticalColumns,
    };
  }

  return {
    compatible: true,
    reason: null,
    details: [],
  };
};
