import { defineConfig } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const LOCAL_ENV_PATH = path.join(ROOT_DIR, '.env.e2e.local');
const GIT_HEAD_PATH = path.join(ROOT_DIR, '.git', 'HEAD');
const PRODUCTION_HOSTS = new Set(['pos.strasyk.com']);
const BLOCKED_BRANCHES = new Set(['main']);

const loadLocalEnv = (filePath) => {
  if (!existsSync(filePath)) return {};

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

const localEnv = loadLocalEnv(LOCAL_ENV_PATH);
const baseURL = process.env.E2E_BASE_URL || localEnv.E2E_BASE_URL || '';
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || localEnv.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const branch = (() => {
  if (!existsSync(GIT_HEAD_PATH)) return 'unknown';
  const head = readFileSync(GIT_HEAD_PATH, 'utf8').trim();
  if (!head.startsWith('ref: ')) return 'detached-head';
  const ref = head.slice(5);
  const segments = ref.split('/');
  return segments[segments.length - 1] || 'unknown';
})();

let hostname = '';
try {
  hostname = new URL(baseURL).hostname.toLowerCase();
} catch {
  hostname = '';
}

if (!baseURL) {
  throw new Error('E2E_BASE_URL is required for preview readonly diagnostics.');
}

if (PRODUCTION_HOSTS.has(hostname)) {
  throw new Error(`Unsafe E2E base URL blocked: ${baseURL}`);
}

if (BLOCKED_BRANCHES.has(branch)) {
  throw new Error(`Unsafe E2E branch blocked: ${branch}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    extraHTTPHeaders: bypassSecret ? {
      'x-vercel-protection-bypass': bypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    } : undefined,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    headless: true,
  },
});
