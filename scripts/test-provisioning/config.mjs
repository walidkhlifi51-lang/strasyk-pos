import fs from 'node:fs';
import path from 'node:path';
import { ProvisioningError } from './errors.mjs';

const DEFAULT_ENV_FILES = ['.env.test-provisioning.local'];

const parseEnvFile = (raw) => {
  const values = {};
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/gu, '');
    values[key] = value;
  }
  return values;
};

export const parseCliArgs = (argv = process.argv.slice(2)) => {
  const [rawMode = 'status', ...rest] = argv;
  const flags = new Set(rest);
  return {
    mode: rawMode,
    json: flags.has('--json'),
    verbose: flags.has('--verbose'),
  };
};

export const loadEnv = ({ cwd = process.cwd(), processEnv = process.env } = {}) => {
  const fileValues = {};
  for (const fileName of DEFAULT_ENV_FILES) {
    const envPath = path.join(cwd, fileName);
    if (!fs.existsSync(envPath)) continue;
    Object.assign(fileValues, parseEnvFile(fs.readFileSync(envPath, 'utf8')));
  }
  return {
    ...fileValues,
    ...processEnv,
  };
};

const normalizeAllowedRefs = (value) => `${value || ''}`
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const readSecretValue = ({ env, cwd, directKey, fileKey }) => {
  const directValue = `${env[directKey] || ''}`;
  if (directValue) return directValue;

  const filePath = `${env[fileKey] || ''}`.trim();
  if (!filePath) return '';

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(resolvedPath)) return '';
  return fs.readFileSync(resolvedPath, 'utf8').replace(/\r?\n$/u, '');
};

const resolveSupabaseUrl = (env) => env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';

const extractProjectRefFromUrl = (url) => {
  try {
    const hostname = new URL(url).hostname;
    const [projectRef] = hostname.split('.');
    return projectRef || '';
  } catch {
    return '';
  }
};

export const buildRuntimeConfig = ({ cwd = process.cwd(), processEnv = process.env, argv = process.argv.slice(2) } = {}) => {
  const cli = parseCliArgs(argv);
  const env = loadEnv({ cwd, processEnv });
  const supabaseUrl = resolveSupabaseUrl(env);
  const projectRef = `${env.SUPABASE_PROJECT_REF || ''}`.trim();
  const allowedProjectRefs = normalizeAllowedRefs(env.STRASYK_TEST_ALLOWED_PROJECT_REFS);
  const runtime = {
    mode: cli.mode,
    outputJson: cli.json,
    verbose: cli.verbose,
    envName: `${env.STRASYK_TEST_ENVIRONMENT_NAME || ''}`.trim(),
    envConfirmation: `${env.STRASYK_TEST_ENVIRONMENT_CONFIRMATION || ''}`.trim(),
    supabaseUrl,
    projectRef,
    projectRefFromUrl: extractProjectRefFromUrl(supabaseUrl),
    allowedProjectRefs,
    serviceRoleKey: `${env.SUPABASE_SERVICE_ROLE_KEY || ''}`.trim(),
    anonKey: `${env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''}`.trim(),
    ownerPassword: readSecretValue({
      env,
      cwd,
      directKey: 'STRASYK_TEST_OWNER_PASSWORD',
      fileKey: 'STRASYK_TEST_OWNER_PASSWORD_FILE',
    }),
    tenantSlug: `${env.STRASYK_TEST_TENANT_SLUG || 'strasyk-test-demo-restaurant'}`.trim(),
    ownerEmail: `${env.STRASYK_TEST_OWNER_EMAIL || ''}`.trim().toLowerCase(),
    expectedRegion: `${env.STRASYK_TEST_EXPECTED_REGION || ''}`.trim(),
    rawEnv: env,
  };

  const supportedModes = new Set(['status', 'dry-run', 'provision', 'reset']);
  if (!supportedModes.has(runtime.mode)) {
    throw new ProvisioningError(`Unsupported mode "${runtime.mode}".`, {
      code: 'UNSUPPORTED_MODE',
    });
  }

  return runtime;
};
