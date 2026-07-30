import { assertSchemaCompatibleForStepOne } from './schemaInspector.mjs';
import { buildStage2DryRunPlan } from './stage2Planner.mjs';
import { buildCanonicalPayloadsBySeedKey, validateCanonicalPayloads } from './canonicalPayloads.mjs';

export const buildDryRunReport = ({ config, schemaReport, beforeMetrics, afterMetrics, readModel }) => {
  const schemaCompatibility = assertSchemaCompatibleForStepOne(schemaReport);
  const dryRunPlan = buildStage2DryRunPlan({
    metrics: beforeMetrics,
    readModel,
  });
  const payloadValidation = validateCanonicalPayloads(
    buildCanonicalPayloadsBySeedKey(),
    dryRunPlan.futureWriteOrder || [],
  );

  if (!schemaCompatibility.compatible) {
    dryRunPlan.wouldRefuse.push({
      reason: schemaCompatibility.reason,
      details: schemaCompatibility.details,
    });
  }

  if (!payloadValidation.valid) {
    dryRunPlan.realExecutionAllowed = false;
    dryRunPlan.executionState = 'blocked_payload_validation';
    dryRunPlan.wouldRefuse.push({
      reason: 'canonical_payload_validation_failed',
      details: payloadValidation.issues,
    });
  }

  return {
    mode: 'dry-run',
    environment: {
      name: config.envName,
      projectRef: config.projectRef,
      supabaseUrl: config.supabaseUrl,
      allowedProjectRefs: config.allowedProjectRefs,
    },
    guarantees: {
      writesPerformed: false,
      usersCreated: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsDeleted: 0,
    },
    readOnlyMetrics: {
      before: beforeMetrics,
      after: afterMetrics,
    },
    stage2ReadModel: readModel,
    schemaCompatible: schemaCompatibility.compatible,
    schemaCompatibilityReason: schemaCompatibility.reason,
    alreadyProvisioned: dryRunPlan.alreadyProvisioned ?? false,
    noOp: dryRunPlan.noOp ?? false,
    plannedMutations: dryRunPlan.plannedMutations ?? dryRunPlan.mutationSummary?.totalMutationsPrevues ?? 0,
    plan: dryRunPlan,
    canonicalPayloadValidation: payloadValidation,
    schemaReport,
  };
};
