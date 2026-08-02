import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const LOCAL_ENV_PATH = path.join(ROOT_DIR, '.env.e2e.local');
const GIT_HEAD_PATH = path.join(ROOT_DIR, '.git', 'HEAD');
const PRODUCTION_HOSTS = new Set(['pos.strasyk.com']);
const BLOCKED_BRANCHES = new Set(['main']);
const DEMO_TENANT_ID = '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e';

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    throw new Error(`Missing local E2E env file: ${path.basename(filePath)}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
};

const requireValue = (env, key) => {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required in .env.e2e.local.`);
  }
  return value;
};

export const readCurrentGitBranch = () => {
  if (!existsSync(GIT_HEAD_PATH)) {
    throw new Error('Missing .git/HEAD. E2E branch guard cannot verify the current branch.');
  }

  const head = readFileSync(GIT_HEAD_PATH, 'utf8').trim();
  if (!head.startsWith('ref: ')) return 'detached-head';

  const ref = head.slice(5);
  const segments = ref.split('/');
  return segments[segments.length - 1] || 'unknown';
};

export const loadE2EConfig = () => {
  const env = parseEnvFile(LOCAL_ENV_PATH);
  const branch = readCurrentGitBranch();

  return {
    baseURL: requireValue(env, 'E2E_BASE_URL'),
    branch,
    email: requireValue(env, 'E2E_DEMO_EMAIL'),
    password: requireValue(env, 'E2E_DEMO_PASSWORD'),
    expectedTenantId: requireValue(env, 'E2E_EXPECTED_TENANT_ID'),
    expectedTenantName: requireValue(env, 'E2E_EXPECTED_TENANT_NAME'),
  };
};

export const assertSafeTarget = ({ baseURL, expectedTenantId, branch = readCurrentGitBranch() }) => {
  let hostname = '';

  try {
    hostname = new URL(baseURL).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid E2E_BASE_URL: ${baseURL}`);
  }

  if (PRODUCTION_HOSTS.has(hostname)) {
    throw new Error(`Refusing to run E2E tests against production host: ${hostname}`);
  }

  if (BLOCKED_BRANCHES.has(branch)) {
    throw new Error(`Refusing to run E2E tests on blocked branch: ${branch}`);
  }

  if (expectedTenantId !== DEMO_TENANT_ID) {
    throw new Error(`Refusing to run E2E tests for non-demo tenant: ${expectedTenantId}`);
  }
};

export const sanitizeEmailForLog = (email) => {
  const [localPart = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  return `${localPart.slice(0, 2)}***@${domain}`;
};
