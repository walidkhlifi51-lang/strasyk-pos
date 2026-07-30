import { ProvisioningError } from './errors.mjs';

const FORBIDDEN_TOKENS = ['prod', 'production', 'live'];

const containsForbiddenToken = (value) => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (!normalized) return false;
  return FORBIDDEN_TOKENS.some((token) => normalized.includes(token));
};

export const collectForbiddenSignals = (config) => {
  const candidates = [
    ['environment name', config.envName],
    ['environment confirmation', config.envConfirmation],
    ['supabase url', config.supabaseUrl],
    ['supabase project ref', config.projectRef],
    ['supabase project ref from url', config.projectRefFromUrl],
    ['allowed project refs', (config.allowedProjectRefs || []).join(',')],
    ['tenant slug', config.tenantSlug],
  ];

  return candidates
    .filter(([, value]) => containsForbiddenToken(value))
    .map(([field, value]) => ({ field, value }));
};

export const assertSafeEnvironment = (config) => {
  const forbiddenSignals = collectForbiddenSignals(config);
  if (forbiddenSignals.length > 0) {
    throw new ProvisioningError('Execution blocked: forbidden production-like markers detected.', {
      code: 'FORBIDDEN_ENVIRONMENT',
      details: { forbiddenSignals },
    });
  }

  if (!config.envName) {
    throw new ProvisioningError('STRASYK_TEST_ENVIRONMENT_NAME is required.', {
      code: 'MISSING_ENVIRONMENT_NAME',
    });
  }

  if (!config.supabaseUrl) {
    throw new ProvisioningError('SUPABASE_URL or VITE_SUPABASE_URL is required.', {
      code: 'MISSING_SUPABASE_URL',
    });
  }

  if (!config.projectRef) {
    throw new ProvisioningError('SUPABASE_PROJECT_REF is required.', {
      code: 'MISSING_PROJECT_REF',
    });
  }

  if (!config.serviceRoleKey) {
    throw new ProvisioningError('SUPABASE_SERVICE_ROLE_KEY is required.', {
      code: 'MISSING_SERVICE_ROLE_KEY',
    });
  }

  if (!config.allowedProjectRefs.length) {
    throw new ProvisioningError('STRASYK_TEST_ALLOWED_PROJECT_REFS must contain at least one authorized project ref.', {
      code: 'MISSING_ALLOWED_PROJECT_REFS',
    });
  }

  if (!config.allowedProjectRefs.includes(config.projectRef)) {
    throw new ProvisioningError('Execution blocked: project ref is not present in the authorized allowlist.', {
      code: 'PROJECT_REF_NOT_ALLOWED',
      details: {
        projectRef: config.projectRef,
        allowedProjectRefs: config.allowedProjectRefs,
      },
    });
  }

  if (config.projectRefFromUrl !== config.projectRef) {
    throw new ProvisioningError('Execution blocked: SUPABASE_URL is inconsistent with SUPABASE_PROJECT_REF.', {
      code: 'PROJECT_REF_URL_MISMATCH',
      details: {
        projectRef: config.projectRef,
        projectRefFromUrl: config.projectRefFromUrl,
      },
    });
  }
};
