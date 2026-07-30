import { buildRuntimeConfig } from './config.mjs';
import { pathToFileURL } from 'node:url';
import { serializeProvisioningError, toProvisioningError } from './errors.mjs';
import { assertSafeEnvironment } from './guards.mjs';
import { createLogger, redactSecrets } from './logger.mjs';
import { inspectSupabaseSchema } from './schemaInspector.mjs';
import { buildStatusReport } from './status.mjs';
import { buildDryRunReport } from './dryRun.mjs';
import { collectReadOnlyMetrics } from './readOnlyMetrics.mjs';
import { collectStage2ReadModel } from './stage2ReadModel.mjs';
import { executeProvision } from './provision.mjs';

export const runCli = async ({
  argv = process.argv.slice(2),
  processEnv = process.env,
  cwd = process.cwd(),
  fetchImpl = fetch,
} = {}) => {
  const config = buildRuntimeConfig({ argv, processEnv, cwd });
  const logger = createLogger({ verbose: config.verbose });

  try {
    assertSafeEnvironment(config);
    logger.section(`STRASYK POS Supabase test provisioning: ${config.mode}`);
    logger.info('Target project validated.', {
      envName: config.envName,
      projectRef: config.projectRef,
      tenantSlug: config.tenantSlug,
    });

    const schemaReport = await inspectSupabaseSchema(config, { fetchImpl });
    let report;
    if (config.mode === 'provision') {
      report = await executeProvision({ config, schemaReport, logger });
    } else {
      const beforeMetrics = await collectReadOnlyMetrics({ config, schemaReport });
      const readModel = await collectStage2ReadModel({ config, schemaReport, metrics: beforeMetrics });
      const afterMetrics = config.mode === 'dry-run'
        ? await collectReadOnlyMetrics({ config, schemaReport })
        : beforeMetrics;
      report = config.mode === 'dry-run'
        ? buildDryRunReport({ config, schemaReport, beforeMetrics, afterMetrics, readModel })
        : buildStatusReport({ config, schemaReport, metrics: beforeMetrics, readModel });
    }

    if (config.outputJson) {
      logger.writeJson(report);
    } else {
      logger.info(config.mode === 'provision' ? 'Provisioning execution completed.' : 'Read-only execution completed.', {
        mode: report.mode,
        writesPerformed: report.writesPerformed ?? false,
        missingCriticalTables: report.schemaReport?.differences?.missingCriticalTables || [],
        missingCriticalColumns: report.schemaReport?.differences?.missingCriticalColumns || [],
      });
      logger.writeJson(report);
    }

    return { exitCode: 0, report };
  } catch (error) {
    const normalizedError = toProvisioningError(error, 'Read-only provisioning step failed.');
    const serializedError = redactSecrets(serializeProvisioningError(normalizedError));
    logger.error(normalizedError.message, serializedError);
    return {
      exitCode: normalizedError.exitCode,
      error: {
        ...serializedError,
      },
    };
  }
};

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const result = await runCli();
  process.exit(result.exitCode);
}
