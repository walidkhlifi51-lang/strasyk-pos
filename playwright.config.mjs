import { defineConfig } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const LOCAL_ENV_PATH = path.join(ROOT_DIR, '.env.e2e.local');
const GIT_HEAD_PATH = path.join(ROOT_DIR, '.git', 'HEAD');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
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
const baseURL = process.env.E2E_BASE_URL || localEnv.E2E_BASE_URL || DEFAULT_BASE_URL;
const branch = (() => {
  if (!existsSync(GIT_HEAD_PATH)) return 'unknown';
  const head = readFileSync(GIT_HEAD_PATH, 'utf8').trim();
  if (!head.startsWith('ref: ')) return 'detached-head';
  const ref = head.slice(5);
  const segments = ref.split('/');
  return segments[segments.length - 1] || 'unknown';
})();
const hostname = (() => {
  try {
    return new URL(baseURL).hostname.toLowerCase();
  } catch {
    return '';
  }
})();

if (PRODUCTION_HOSTS.has(hostname)) {
  throw new Error(`Unsafe E2E base URL blocked: ${baseURL}`);
}

if (BLOCKED_BRANCHES.has(branch)) {
  throw new Error(`Unsafe E2E branch blocked: ${branch}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: DEFAULT_BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
