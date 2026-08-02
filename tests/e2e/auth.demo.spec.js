import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';

const e2eConfig = loadE2EConfig();
assertSafeTarget(e2eConfig);

test('demo owner can sign in only on the demo tenant', async ({ page, baseURL }) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId });

  test.info().annotations.push({
    type: 'target',
    description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${e2eConfig.expectedTenantId}`,
  });

  await page.goto('/Auth', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/Auth/);

  await page.locator('#email').fill(e2eConfig.email);
  await page.locator('#password').fill(e2eConfig.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
  const activeTenantId = await expect.poll(async () => {
    const localStorageSnapshot = await page.evaluate(() => {
      const snapshot = {};
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        snapshot[key] = window.localStorage.getItem(key);
      }
      return snapshot;
    });

    return extractTenantIdFromStoredSession(localStorageSnapshot);
  }, {
    timeout: 30_000,
    message: 'Expected the authenticated session to target the demo tenant.',
  }).toBe(e2eConfig.expectedTenantId);

  await expect(page.getByText(e2eConfig.expectedTenantName).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/pos\.strasyk\.com/i);
});
