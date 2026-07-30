import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { assertSchemaCompatibleForStepOne } from './schemaInspector.mjs';
import { buildStage2DryRunPlan } from './stage2Planner.mjs';

export const buildStatusReport = ({ config, schemaReport, metrics, readModel = null }) => {
  const schemaCompatibility = assertSchemaCompatibleForStepOne(schemaReport);
  const simulatedPlan = readModel
    ? buildStage2DryRunPlan({
      readModel,
      metrics,
    })
    : null;

  return {
    mode: 'status',
    environment: {
      name: config.envName,
      projectRef: config.projectRef,
      supabaseUrl: config.supabaseUrl,
      allowedProjectRefs: config.allowedProjectRefs,
      tenantSlug: config.tenantSlug,
    },
    safeguards: {
      writesEnabled: false,
      resetEnabled: false,
      provisionEnabled: false,
      schemaCompatible: schemaCompatibility.compatible,
      schemaCompatibilityReason: schemaCompatibility.reason,
    },
    canonicalSeed: {
      tenant: CANONICAL_DATASET.tenant,
      ownerEmail: config.ownerEmail || CANONICAL_DATASET.identity.ownerEmail,
      objectCounts: {
        categories: CANONICAL_DATASET.categories.length,
        products: CANONICAL_DATASET.products.length,
        optionGroups: CANONICAL_DATASET.optionGroups.length,
        optionItems: CANONICAL_DATASET.optionItems.length,
        ingredients: CANONICAL_DATASET.ingredients.length,
        tables: CANONICAL_DATASET.tables.length,
        customers: CANONICAL_DATASET.customers.length,
        orders: CANONICAL_DATASET.orders.length,
      },
    },
    readOnlyMetrics: metrics,
    schemaReport,
    simulatedPlanSummary: {
      creationsAuth: simulatedPlan?.mutationSummary?.creationsAuth ?? 1,
      insertionsMetier: simulatedPlan?.mutationSummary?.insertionsMetier ?? 29,
      insertionsRegistre: simulatedPlan?.mutationSummary?.insertionsRegistre ?? 30,
      totalMutationsPrevues: simulatedPlan?.mutationSummary?.totalMutationsPrevues ?? 60,
      plannedMutations: simulatedPlan?.plannedMutations ?? simulatedPlan?.mutationSummary?.totalMutationsPrevues ?? 60,
      wouldUpdate: simulatedPlan?.mutationSummary?.misesAJour ?? 0,
      wouldRefuse: simulatedPlan?.wouldRefuse?.length ?? 0,
      alreadyProvisioned: simulatedPlan?.alreadyProvisioned ?? false,
      noOp: simulatedPlan?.noOp ?? false,
    },
  };
};
