import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';

const e2eConfig = loadE2EConfig();
assertSafeTarget(e2eConfig);

const getLocalStorageSnapshot = async (page) => page.evaluate(() => {
  const snapshot = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    snapshot[key] = window.localStorage.getItem(key);
  }
  return snapshot;
});

const assertDemoTenantSession = async (page) => {
  await expect.poll(async () => {
    const localStorageSnapshot = await getLocalStorageSnapshot(page);
    return extractTenantIdFromStoredSession(localStorageSnapshot);
  }, {
    timeout: 30_000,
    message: 'Expected the authenticated session to target the demo tenant.',
  }).toBe(e2eConfig.expectedTenantId);
};

test('schema projections avoid invalid orders and restaurant_profiles fields', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });

  const responses = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('supabase.co/rest/v1/orders') && !url.includes('supabase.co/rest/v1/restaurant_profiles')) {
      return;
    }

    let body = null;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }

    responses.push({
      method: response.request().method(),
      status: response.status(),
      url,
      body,
    });
  });

  testInfo.annotations.push({
    type: 'target',
    description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${e2eConfig.expectedTenantId}`,
  });

  await page.goto('/Auth', { waitUntil: 'networkidle' });
  await page.locator('#email').fill(e2eConfig.email);
  await page.locator('#password').fill(e2eConfig.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
  await assertDemoTenantSession(page);

  await page.goto('/Parametres', { waitUntil: 'networkidle' });
  await assertDemoTenantSession(page);
  await expect(page.getByText('Paramètres & Configuration').first()).toBeVisible({ timeout: 30_000 });

  const orderRequests = responses.filter((entry) => entry.url.includes('/rest/v1/orders'));
  const profileRequests = responses.filter((entry) => entry.url.includes('/rest/v1/restaurant_profiles'));

  expect(orderRequests.length).toBeGreaterThan(0);
  expect(profileRequests.length).toBeGreaterThan(0);

  for (const request of orderRequests) {
    expect(request.url).toContain('mode_paiement');
    expect(request.url).not.toContain('payment_method');
    expect(request.status).toBeLessThan(400);
  }

  for (const request of profileRequests) {
    expect(request.url).not.toContain('customer_display_settings');
    expect(request.status).toBeLessThan(400);
  }
});
