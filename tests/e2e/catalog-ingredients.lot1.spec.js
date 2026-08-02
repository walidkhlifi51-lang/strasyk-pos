import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  createAdminSupabaseClient,
  demoTenantId,
  fetchByNames,
  fetchOptionGroups,
  fetchOptionItems,
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
  const activeTenantId = await expect.poll(async () => {
    const localStorageSnapshot = await getLocalStorageSnapshot(page);
    return extractTenantIdFromStoredSession(localStorageSnapshot);
  }, {
    timeout: 30_000,
    message: 'Expected the authenticated session to target the demo tenant.',
  }).toBe(e2eConfig.expectedTenantId);

  return activeTenantId;
};

const waitForRefetch = async (page, productId) => page.waitForResponse((response) => {
  const request = response.request();
  return request.method() === 'GET'
    && response.url().includes('/rest/v1/products')
    && response.url().includes('tenant_id=eq.');
}, { timeout: 30_000 });

const toggleAvailabilityAndAssert = async ({ page, productCard, switchLocator, supabaseAdmin, productName, productId, expectedPayloadValue, expectedUiState, expectedDbValue }) => {
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
  await expect(productCard.locator('span.text-xs').first()).toHaveText(expectedUiState === 'checked' ? 'Disponible' : 'Indisponible');

  await expect.poll(async () => {
    const rows = await fetchProductByName(supabaseAdmin, productName);
    return rows[0]?.disponible ?? null;
  }, {
    timeout: 15_000,
    message: `Expected Supabase availability to settle to ${expectedDbValue}.`,
  }).toBe(expectedDbValue);
};

const createCollectors = (page, getCurrentStep) => {
  const consoleErrors = [];
  const requestErrors = [];
  const ignoredConsolePatterns = [
    'Auth session missing',
    'column orders.payment_method does not exist',
  ];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      if (ignoredConsolePatterns.some((pattern) => message.text().includes(pattern))) {
        return;
      }
      consoleErrors.push(message.text());
    }
  });

  page.on('response', async (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    if (!url.includes('supabase.co') && !url.includes('127.0.0.1')) return;

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = null;
      }
    }

    let payload = null;
    try {
      payload = response.request().postDataJSON ? response.request().postDataJSON() : response.request().postData();
    } catch {
      payload = response.request().postData();
    }

    requestErrors.push({
      timestamp: new Date().toISOString(),
      step: getCurrentStep?.() || null,
      status,
      method: response.request().method(),
      url,
      responseBody,
      payload,
    });
  });

  return { consoleErrors, requestErrors };
};

test('lot 1 - catalogue et ingredients on demo tenant only', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });
  const runId = `${Date.now()}`;

  const names = {
    categoryInitial: `E2E_LOT1_CAT_PIZZA_${runId}`,
    categoryUpdated: `E2E_LOT1_CAT_PIZZA_OK_${runId}`,
    ingredients: [
      `E2E_LOT1_ING_MOZZA_${runId}`,
      `E2E_LOT1_ING_TOMATE_${runId}`,
      `E2E_LOT1_ING_BASILIC_${runId}`,
    ],
    product: `E2E_LOT1_PIZZA_MARGHERITA_${runId}`,
    optionGroup: `E2E_LOT1_SUPPLEMENT_PIZZA_${runId}`,
    optionItem: `E2E_LOT1_SUP_MOZZA_${runId}`,
  };

  const prices = {
    junior: '11',
    senior: '15',
    mega: '19',
    seniorUpdated: '16',
    supplement: '2',
  };

  const journal = [];
  const screenshots = [];
  let currentStep = 'bootstrap';
  const collectors = createCollectors(page, () => currentStep);
  const supabaseAdmin = createAdminSupabaseClient();
  const protectedSnapshotBefore = await fetchProtectedTenantSnapshots(supabaseAdmin);

  const recordStep = (step, details = {}) => {
    currentStep = step;
    journal.push({
      timestamp: new Date().toISOString(),
      step,
      ...details,
    });
  };

  const capture = async (label) => {
    const outputPath = testInfo.outputPath(`${label}.png`);
    await page.screenshot({ path: outputPath, fullPage: true });
    screenshots.push(outputPath);
    return outputPath;
  };

  testInfo.annotations.push({
    type: 'target',
    description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${demoTenantId}`,
  });

  await test.step('prepare unique E2E identifiers without deleting historical rows', async () => {
    recordStep('safe-replay-run-id', { runId });
  });

  await test.step('login with the demo owner account', async () => {
    await page.goto('/Auth', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(e2eConfig.email);
    await page.locator('#password').fill(e2eConfig.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
    await assertDemoTenantSession(page);
    await expect(page.getByText(e2eConfig.expectedTenantName).first()).toBeVisible({ timeout: 30_000 });
    recordStep('login-ok');
  });

  await test.step('open Parametres and create a category with sizes', async () => {
    await page.goto('/Parametres', { waitUntil: 'networkidle' });
    await assertDemoTenantSession(page);
    await page.getByTestId('settings-tab-categories').click();
    await page.getByTestId('category-create-button').click();

    const dialog = page.getByTestId('category-dialog');
    await dialog.getByTestId('category-name-input').fill(names.categoryInitial);
    await dialog.getByTestId('category-manages-sizes-switch').click();
    await dialog.getByTestId('category-add-size-button').click();
    await dialog.getByTestId('category-add-size-button').click();
    await dialog.getByTestId('category-add-size-button').click();
    await dialog.getByTestId('category-size-template-0').fill('Junior');
    await dialog.getByTestId('category-size-template-1').fill('Senior');
    await dialog.getByTestId('category-size-template-2').fill('Mega');
    await dialog.getByTestId('category-save-button').click();

    await expect(page.locator('span.font-medium', { hasText: names.categoryInitial }).first()).toBeVisible({ timeout: 15_000 });

    const categoryRows = await fetchByNames(supabaseAdmin, 'categories', [names.categoryInitial]);
    expect(categoryRows).toHaveLength(1);
    expect(categoryRows[0].tenant_id).toBe(demoTenantId);
    expect(categoryRows[0].manages_sizes).toBe(true);
    expect(categoryRows[0].size_template).toEqual(['Junior', 'Senior', 'Mega']);

    recordStep('category-created', {
      table: 'categories',
      recordId: categoryRows[0].id,
    });
    await capture('lot1-category-created');
  });

  await test.step('rename the category', async () => {
    await page.getByTestId('category-search-input').fill(names.categoryInitial);
    const categoryRowsBeforeRename = await fetchByNames(supabaseAdmin, 'categories', [names.categoryInitial]);
    expect(categoryRowsBeforeRename).toHaveLength(1);
    const categoryId = categoryRowsBeforeRename[0].id;
    const categoryCard = page.getByTestId(`category-row-${categoryId}`);
    await expect(categoryCard).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(`category-edit-${categoryId}`).click();

    const dialog = page.getByTestId('category-dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByTestId('category-name-input').fill(names.categoryUpdated);
    await dialog.getByTestId('category-save-button').click();

    await page.getByTestId('category-search-input').fill('');
    await expect(page.locator('span.font-medium', { hasText: names.categoryUpdated }).first()).toBeVisible({ timeout: 15_000 });

    const categoryRows = await fetchByNames(supabaseAdmin, 'categories', [names.categoryUpdated]);
    expect(categoryRows).toHaveLength(1);
    expect(categoryRows[0].tenant_id).toBe(demoTenantId);
    recordStep('category-renamed', {
      table: 'categories',
      recordId: categoryRows[0].id,
    });
  });

  await test.step('create three ingredients', async () => {
    await page.getByTestId('settings-tab-ingredients').click();

    for (const ingredientName of names.ingredients) {
      await page.getByTestId('ingredient-create-button').click();
      const dialog = page.getByTestId('ingredient-dialog');
      await dialog.getByTestId('ingredient-name-input').fill(ingredientName);
      await dialog.getByTestId('ingredient-stock-input').fill('100');
      await dialog.getByTestId('ingredient-cost-input').fill('1.50');
      await dialog.getByTestId('ingredient-save-button').click();
      await expect(page.getByText(ingredientName)).toBeVisible({ timeout: 15_000 });
    }

    const ingredientRows = await fetchByNames(supabaseAdmin, 'ingredients', names.ingredients);
    expect(ingredientRows).toHaveLength(3);
    for (const row of ingredientRows) {
      expect(row.tenant_id).toBe(demoTenantId);
    }

    recordStep('ingredients-created', {
      table: 'ingredients',
      recordIds: ingredientRows.map((row) => row.id),
    });
  });

  await test.step('create a pizza with three sizes and attach ingredients', async () => {
    await page.getByTestId('settings-tab-products').click();
    await page.getByTestId('product-create-button').click();

    const dialog = page.getByTestId('product-dialog');
    await dialog.getByTestId('product-form-name-input').fill(names.product);
    await selectRadixOption(page, dialog.getByTestId('product-form-category-trigger'), names.categoryUpdated);

    await dialog.getByTestId('product-size-price-Junior').fill(prices.junior);
    await dialog.getByTestId('product-size-price-Senior').fill(prices.senior);
    await dialog.getByTestId('product-size-price-Mega').fill(prices.mega);

    await dialog.getByRole('tab', { name: /Ingr.dients/i }).click();
    for (let index = 0; index < names.ingredients.length; index += 1) {
      await dialog.getByTestId('product-add-ingredient-button').click();
      await selectRadixOption(page, dialog.getByTestId(`product-ingredient-select-${index}`), names.ingredients[index]);
      await dialog.getByTestId(`product-ingredient-quantity-${index}`).fill(index === 0 ? '120' : index === 1 ? '90' : '5');
    }

    await dialog.getByTestId('product-form-submit').click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(names.product)).toBeVisible({ timeout: 20_000 });

    const productRows = await fetchProductByName(supabaseAdmin, names.product);
    expect(productRows).toHaveLength(1);
    expect(productRows[0].tenant_id).toBe(demoTenantId);
    expect(productRows[0].size_prices).toEqual([
      { size: 'Junior', price: 11 },
      { size: 'Senior', price: 15 },
      { size: 'Mega', price: 19 },
    ]);
    expect(productRows[0].prix).toBe(11);

    const productIngredients = await fetchProductIngredients(supabaseAdmin, productRows[0].id);
    expect(productIngredients).toHaveLength(3);
    for (const row of productIngredients) {
      expect(row.tenant_id).toBe(demoTenantId);
    }

    recordStep('product-created', {
      tables: ['products', 'product_ingredients'],
      productId: productRows[0].id,
      ingredientLinks: productIngredients.map((row) => row.id),
    });
    await capture('lot1-product-created');
  });

  await test.step('create a paid supplement template and assign it to the pizza', async () => {
    await page.getByTestId('settings-tab-options').click();
    await page.getByTestId('option-template-create-button').click();
    await page.getByTestId('option-group-name-input').fill(names.optionGroup);
    await page.getByTestId('option-group-save-button').click();

    await expect.poll(
      () => fetchOptionGroups(supabaseAdmin, [names.optionGroup]),
      {
        timeout: 20_000,
        message: 'Expected the paid supplement template group to be persisted in Supabase.',
      }
    ).toHaveLength(1);
    const templateGroupRows = await fetchOptionGroups(supabaseAdmin, [names.optionGroup]);
    const templateGroupId = templateGroupRows[0].id;
    const templateCard = page.getByTestId(`option-template-card-${templateGroupId}`);
    await expect(templateCard).toContainText(names.optionGroup);
    await templateCard.getByTestId(`option-item-add-${templateGroupId}`).click();

    await page.getByTestId('option-item-name-input').fill(names.optionItem);
    await page.getByTestId('option-item-surcharge-input').fill(prices.supplement);
    await page.getByTestId('option-item-save-button').click();

    await expect(page.getByText(names.optionItem, { exact: true })).toBeVisible({ timeout: 15_000 });

    const templateGroups = await fetchOptionGroups(supabaseAdmin, [names.optionGroup]);
    expect(templateGroups.some((row) => row.tenant_id === demoTenantId)).toBe(true);
    const templateItems = await fetchOptionItems(supabaseAdmin, [names.optionItem]);
    expect(templateItems.some((row) => row.tenant_id === demoTenantId && Number(row.price_surcharge) === 2)).toBe(true);

    await page.getByTestId('settings-tab-products').click();
    const productRowsForOptions = await fetchProductByName(supabaseAdmin, names.product);
    expect(productRowsForOptions).toHaveLength(1);
    const productCard = page.getByTestId(`product-card-${productRowsForOptions[0].id}`);
    await page.getByTestId(`product-options-${productRowsForOptions[0].id}`).click();
    const optionsDialog = page.getByTestId('product-options-dialog');
    const assignmentCheckbox = optionsDialog.getByTestId(`option-template-assign-${templateGroupId}`);
    await assignmentCheckbox.click();
    await expect(assignmentCheckbox).toBeChecked();
    await expect(optionsDialog.getByText(names.optionItem, { exact: true })).toBeVisible({ timeout: 20_000 });

    const optionGroups = await fetchOptionGroups(supabaseAdmin, [names.optionGroup]);
    expect(optionGroups.filter((row) => row.tenant_id === demoTenantId)).toHaveLength(2);

    const optionItems = await fetchOptionItems(supabaseAdmin, [names.optionItem]);
    expect(optionItems.filter((row) => row.tenant_id === demoTenantId)).toHaveLength(2);

    recordStep('paid-supplement-created-and-assigned', {
      tables: ['option_groups', 'option_items'],
      optionGroupIds: optionGroups.map((row) => row.id),
      optionItemIds: optionItems.map((row) => row.id),
    });
    await capture('lot1-option-assigned');
    await page.keyboard.press('Escape');
  });

  await test.step('refresh and verify persistence, then update one size price', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await assertDemoTenantSession(page);
    await page.getByTestId('settings-tab-products').click();
    await expect(page.getByText(names.product)).toBeVisible({ timeout: 15_000 });

    const existingProductRows = await fetchProductByName(supabaseAdmin, names.product);
    expect(existingProductRows).toHaveLength(1);
    await page.getByTestId(`product-edit-${existingProductRows[0].id}`).click();

    const dialog = page.getByTestId('product-dialog');
    await expect(dialog.getByTestId('product-form-name-input')).toHaveValue(names.product);
    await dialog.getByRole('tab', { name: /Ingr.dients/i }).click();
    await expect(dialog.locator('[data-testid^="product-ingredient-select-"]')).toHaveCount(3);
    await expect(dialog.getByTestId('product-ingredient-quantity-0')).toHaveValue('120');
    await expect(dialog.getByTestId('product-ingredient-quantity-1')).toHaveValue('90');
    await expect(dialog.getByTestId('product-ingredient-quantity-2')).toHaveValue('5');
    await expect(dialog.locator('button[role="switch"]').nth(0)).toHaveAttribute('data-state', 'unchecked');
    await expect(dialog.locator('button[role="switch"]').nth(1)).toHaveAttribute('data-state', 'unchecked');
    await expect(dialog.locator('button[role="switch"]').nth(2)).toHaveAttribute('data-state', 'unchecked');
    await dialog.getByRole('tab', { name: /Informations/i }).click();

    await dialog.getByTestId('product-size-price-Senior').fill(prices.seniorUpdated);
    await dialog.getByTestId('product-form-submit').click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const updatedProductRows = await fetchProductByName(supabaseAdmin, names.product);
    expect(updatedProductRows).toHaveLength(1);
    expect(updatedProductRows[0].size_prices).toEqual([
      { size: 'Junior', price: 11 },
      { size: 'Senior', price: 16 },
      { size: 'Mega', price: 19 },
    ]);

    recordStep('product-size-updated', {
      table: 'products',
      productId: updatedProductRows[0].id,
    });
  });

  await test.step('disable and re-enable the product', async () => {
    const productRowsBeforeToggle = await fetchProductByName(supabaseAdmin, names.product);
    expect(productRowsBeforeToggle).toHaveLength(1);
    const productCard = page.getByTestId(`product-card-${productRowsBeforeToggle[0].id}`);
    const switchLocator = page.getByTestId(`product-availability-${productRowsBeforeToggle[0].id}`);
    await toggleAvailabilityAndAssert({
      page,
      productCard,
      switchLocator,
      supabaseAdmin,
      productName: names.product,
      productId: productRowsBeforeToggle[0].id,
      expectedPayloadValue: false,
      expectedUiState: 'unchecked',
      expectedDbValue: false,
    });
    await toggleAvailabilityAndAssert({
      page,
      productCard,
      switchLocator,
      supabaseAdmin,
      productName: names.product,
      productId: productRowsBeforeToggle[0].id,
      expectedPayloadValue: true,
      expectedUiState: 'checked',
      expectedDbValue: true,
    });

    const productRowsAfterToggle = await fetchProductByName(supabaseAdmin, names.product);
    expect(productRowsAfterToggle).toHaveLength(1);
    expect(productRowsAfterToggle[0].disponible).toBe(true);

    recordStep('product-toggled', {
      table: 'products',
      productId: productRowsAfterToggle[0].id,
      finalAvailable: productRowsAfterToggle[0].disponible,
    });
    await capture('lot1-product-reactivated');
  });

  await test.step('verify no protected tenant data changed and no frontend errors leaked', async () => {
    const protectedSnapshotAfter = await fetchProtectedTenantSnapshots(supabaseAdmin);
    expect(protectedSnapshotAfter).toEqual(protectedSnapshotBefore);

    expect(collectors.consoleErrors).toEqual([]);
    expect(collectors.requestErrors).toEqual([]);

    recordStep('cross-tenant-integrity-ok', {
      protectedTenantSnapshotStable: true,
      consoleErrors: 0,
      requestErrors: 0,
    });
  });

  await testInfo.attach('lot1-journal', {
    body: JSON.stringify({ names, journal, screenshots }, null, 2),
    contentType: 'application/json',
  });
});
