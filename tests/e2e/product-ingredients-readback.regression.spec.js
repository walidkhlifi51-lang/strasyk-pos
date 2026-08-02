import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  cleanupE2EData,
  createAdminSupabaseClient,
  demoTenantId,
  fetchByNames,
  fetchProductByName,
  fetchProductIngredients,
  fetchProtectedTenantSnapshots,
} from './helpers/supabase.js';

const e2eConfig = loadE2EConfig();
assertSafeTarget(e2eConfig);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const selectRadixOption = async (page, trigger, optionName) => {
  await trigger.click();
  const roleOption = page.getByRole('option', { name: optionName, exact: true });
  if (await roleOption.count()) {
    await roleOption.click();
    return;
  }

  await page.locator('span').filter({ hasText: new RegExp(`^${escapeRegex(optionName)}(?:\\s|\\(|$)`) }).last().click();
};

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

const openProductAndAssertIngredients = async ({ page, productId, productName, expectedQuantities, expectedRetirable }) => {
  const requestPromise = page.waitForResponse((response) => {
    const request = response.request();
    const url = response.url();
    return request.method() === 'GET'
      && url.includes('/rest/v1/product_ingredients')
      && (url.includes(encodeURIComponent(productId)) || url.includes(productId));
  }, { timeout: 30_000 });

  await page.getByTestId(`product-edit-${productId}`).click();
  const dialog = page.getByTestId('product-dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId('product-form-name-input')).toHaveValue(productName);
  await dialog.getByRole('tab', { name: /Ingr.dients/i }).click();

  const response = await requestPromise;
  const responseUrl = response.url();

  for (const field of ['product_id', 'ingredient_id', 'quantite', 'retirable']) {
    expect(responseUrl).toContain(field);
  }

  await expect(dialog.locator('[data-testid^="product-ingredient-select-"]')).toHaveCount(3);

  for (let index = 0; index < expectedQuantities.length; index += 1) {
    await expect(dialog.getByTestId(`product-ingredient-quantity-${index}`)).toHaveValue(expectedQuantities[index]);
    const switchButton = dialog.locator('button[role="switch"]').nth(index);
    await expect(switchButton).toHaveAttribute('data-state', expectedRetirable[index] ? 'checked' : 'unchecked');
  }

  await page.keyboard.press('Escape');
};

test('product ingredient readback keeps 3 ingredient rows after reopen and refresh', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });

  const runId = `${Date.now()}`;
  const names = {
    category: `E2E_ING_READBACK_CAT_${runId}`,
    product: `E2E_ING_READBACK_PRODUCT_${runId}`,
    ingredients: [
      `E2E_ING_READBACK_MOZZA_${runId}`,
      `E2E_ING_READBACK_TOMATE_${runId}`,
      `E2E_ING_READBACK_BASILIC_${runId}`,
    ],
  };

  const expectedQuantities = ['120', '90', '5'];
  const expectedRetirable = [false, true, false];

  const supabaseAdmin = createAdminSupabaseClient();
  const cleanupResult = await cleanupE2EData(supabaseAdmin);
  const protectedSnapshotBefore = await fetchProtectedTenantSnapshots(supabaseAdmin);

  testInfo.annotations.push(
    { type: 'target', description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${demoTenantId}` },
    { type: 'cleanup', description: JSON.stringify(cleanupResult.deleted) },
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
  expect(categoryRows).toHaveLength(1);
  expect(categoryRows[0].tenant_id).toBe(demoTenantId);

  await page.getByTestId('settings-tab-ingredients').click();
  for (const ingredientName of names.ingredients) {
    await page.getByTestId('ingredient-create-button').click();
    const ingredientDialog = page.getByTestId('ingredient-dialog');
    await ingredientDialog.getByTestId('ingredient-name-input').fill(ingredientName);
    await ingredientDialog.getByTestId('ingredient-stock-input').fill('100');
    await ingredientDialog.getByTestId('ingredient-cost-input').fill('1.50');
    await ingredientDialog.getByTestId('ingredient-save-button').click();
  }

  const ingredientRows = await waitForRows(
    () => fetchByNames(supabaseAdmin, 'ingredients', names.ingredients),
    3,
    'Expected the three ingredients to be persisted before creating the product.',
  );
  expect(ingredientRows).toHaveLength(3);

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId('product-create-button').click();
  const productDialog = page.getByTestId('product-dialog');
  await productDialog.getByTestId('product-form-name-input').fill(names.product);
  await selectRadixOption(page, productDialog.getByTestId('product-form-category-trigger'), names.category);
  await productDialog.locator('#base_price').fill('12');
  await productDialog.getByRole('tab', { name: /Ingr.dients/i }).click();

  for (let index = 0; index < names.ingredients.length; index += 1) {
    await productDialog.getByTestId('product-add-ingredient-button').click();
    await selectRadixOption(page, productDialog.getByTestId(`product-ingredient-select-${index}`), names.ingredients[index]);
    await productDialog.getByTestId(`product-ingredient-quantity-${index}`).fill(expectedQuantities[index]);
    if (expectedRetirable[index]) {
      await productDialog.locator('button[role="switch"]').nth(index).click();
    }
  }

  await productDialog.getByTestId('product-form-submit').click();
  await expect(productDialog).toBeHidden({ timeout: 20_000 });

  const productRows = await waitForRows(
    () => fetchProductByName(supabaseAdmin, names.product),
    1,
    'Expected the product to be persisted before reopening it.',
  );
  expect(productRows).toHaveLength(1);
  expect(productRows[0].tenant_id).toBe(demoTenantId);

  const productIngredients = await fetchProductIngredients(supabaseAdmin, productRows[0].id);
  expect(productIngredients).toHaveLength(3);
  expect(productIngredients.map((row) => Number(row.quantite))).toEqual([120, 90, 5]);
  expect(productIngredients.map((row) => Boolean(row.retirable))).toEqual(expectedRetirable);

  await page.getByTestId('product-search-input').fill(names.product);
  await openProductAndAssertIngredients({
    page,
    productId: productRows[0].id,
    productName: names.product,
    expectedQuantities,
    expectedRetirable,
  });

  await page.reload({ waitUntil: 'networkidle' });
  await assertDemoTenantSession(page);
  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId('product-search-input').fill(names.product);
  await openProductAndAssertIngredients({
    page,
    productId: productRows[0].id,
    productName: names.product,
    expectedQuantities,
    expectedRetirable,
  });

  const protectedSnapshotAfter = await fetchProtectedTenantSnapshots(supabaseAdmin);
  expect(protectedSnapshotAfter).toEqual(protectedSnapshotBefore);
});
