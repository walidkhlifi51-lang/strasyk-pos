import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  createAdminSupabaseClient,
  demoTenantId,
  fetchByNames,
  fetchProductByName,
  fetchProtectedTenantSnapshots,
} from './helpers/supabase.js';

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

const waitForRows = async (fetcher, expectedLength, message) => {
  await expect.poll(fetcher, {
    timeout: 20_000,
    message,
  }).toHaveLength(expectedLength);

  return fetcher();
};

const waitForAvailability = async (supabaseAdmin, productName, expectedValue, label) => {
  await expect.poll(async () => {
    const rows = await fetchProductByName(supabaseAdmin, productName);
    return rows[0]?.disponible ?? null;
  }, {
    timeout: 15_000,
    message: `Expected Supabase availability to settle to ${expectedValue} after ${label}.`,
  }).toBe(expectedValue);
};

const waitForRefetch = async (page, productId) => page.waitForResponse((response) => {
  const request = response.request();
  return request.method() === 'GET'
    && response.url().includes('/rest/v1/products')
    && response.url().includes('tenant_id=eq.');
}, { timeout: 30_000 });

const toggleAndAssert = async ({ page, switchLocator, productCard, supabaseAdmin, productName, productId, expectedPayloadValue, expectedUiState, expectedDbValue, label }) => {
  const patchResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === 'PATCH'
      && response.url().includes('/rest/v1/products')
      && response.url().includes(productId);
  }, { timeout: 30_000 });

  const refetchResponsePromise = waitForRefetch(page, productId);

  await switchLocator.click();

  const patchResponse = await patchResponsePromise;
  const patchRequestBody = patchResponse.request().postDataJSON ? patchResponse.request().postDataJSON() : patchResponse.request().postData();
  expect(patchRequestBody).toEqual({ disponible: expectedPayloadValue });
  expect(patchResponse.status()).toBe(200);

  await refetchResponsePromise;
  await expect(switchLocator).toHaveAttribute('data-state', expectedUiState, { timeout: 15_000 });
  await expect(switchLocator).toHaveAttribute('aria-checked', expectedUiState === 'checked' ? 'true' : 'false', { timeout: 15_000 });
  await waitForAvailability(supabaseAdmin, productName, expectedDbValue, label);
  await expect(productCard.locator('span.text-xs').first()).toHaveText(expectedUiState === 'checked' ? 'Disponible' : 'Indisponible');
};

test('product availability toggle stays in sync with Supabase after disable and re-enable', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });

  const runId = `${Date.now()}`;
  const names = {
    category: `E2E_AVAIL_CAT_${runId}`,
    product: `E2E_AVAIL_PRODUCT_${runId}`,
  };

  const supabaseAdmin = createAdminSupabaseClient();
  const protectedSnapshotBefore = await fetchProtectedTenantSnapshots(supabaseAdmin);

  testInfo.annotations.push(
    { type: 'target', description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${demoTenantId}` },
    { type: 'isolation', description: `unique-run-id=${runId}` },
  );

  await page.goto('/Auth', { waitUntil: 'networkidle' });
  await page.locator('#email').fill(e2eConfig.email);
  await page.locator('#password').fill(e2eConfig.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
  await assertDemoTenantSession(page);

  await page.goto('/Parametres', { waitUntil: 'networkidle' });
  await assertDemoTenantSession(page);

  await page.getByTestId('settings-tab-categories').click();
  await page.getByTestId('category-create-button').click();
  const categoryDialog = page.getByTestId('category-dialog');
  await categoryDialog.getByTestId('category-name-input').fill(names.category);
  await categoryDialog.getByTestId('category-save-button').click();
  const categoryRows = await waitForRows(
    () => fetchByNames(supabaseAdmin, 'categories', [names.category]),
    1,
    'Expected the category to be persisted before creating the product.',
  );
  expect(categoryRows[0].tenant_id).toBe(demoTenantId);

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId('product-create-button').click();
  const productDialog = page.getByTestId('product-dialog');
  await productDialog.getByTestId('product-form-name-input').fill(names.product);
  await productDialog.getByTestId('product-form-category-trigger').click();
  await page.getByRole('option', { name: names.category, exact: true }).click();
  await productDialog.locator('#base_price').fill('12');
  await productDialog.getByTestId('product-form-submit').click();
  await expect(productDialog).toBeHidden({ timeout: 20_000 });

  const productRows = await waitForRows(
    () => fetchProductByName(supabaseAdmin, names.product),
    1,
    'Expected the product to be persisted before availability assertions.',
  );
  const productId = productRows[0].id;

  await page.getByTestId('product-search-input').fill(names.product);
  const productCard = page.getByTestId(`product-card-${productId}`);
  const switchLocator = page.getByTestId(`product-availability-${productId}`);
  await expect(productCard).toBeVisible({ timeout: 15_000 });
  await expect(switchLocator).toHaveAttribute('data-state', 'checked');
  await expect(switchLocator).toHaveAttribute('aria-checked', 'true');
  await expect(productCard.locator('span.text-xs').first()).toHaveText('Disponible');

  await toggleAndAssert({
    page,
    switchLocator,
    productCard,
    supabaseAdmin,
    productName: names.product,
    productId,
    expectedPayloadValue: false,
    expectedUiState: 'unchecked',
    expectedDbValue: false,
    label: 'disable',
  });

  await toggleAndAssert({
    page,
    switchLocator,
    productCard,
    supabaseAdmin,
    productName: names.product,
    productId,
    expectedPayloadValue: true,
    expectedUiState: 'checked',
    expectedDbValue: true,
    label: 'reenable',
  });

  const protectedSnapshotAfter = await fetchProtectedTenantSnapshots(supabaseAdmin);
  expect(protectedSnapshotAfter).toEqual(protectedSnapshotBefore);
});
