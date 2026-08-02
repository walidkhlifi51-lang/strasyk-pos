import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  cleanupE2EData,
  createAdminSupabaseClient,
  demoTenantId,
  fetchByNames,
  fetchOptionItems,
  fetchOptionItemsByGroupIds,
  fetchOptionGroups,
  fetchProductByName,
  fetchProductIngredients,
  fetchProductOptionGroups,
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

const names = {
  categoryInitial: 'E2E_LOT1_CAT_PIZZA',
  categoryUpdated: 'E2E_LOT1_CAT_PIZZA_OK',
  ingredients: [
    'E2E_LOT1_ING_MOZZA',
    'E2E_LOT1_ING_TOMATE',
    'E2E_LOT1_ING_BASILIC',
  ],
  product: 'E2E_LOT1_PIZZA_MARGHERITA',
  optionGroup: 'E2E_LOT1_SUPPLEMENT_PIZZA',
  optionItem: 'E2E_LOT1_SUP_MOZZA',
};

test('option assignment regression keeps assignment after refresh', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });

  const prices = {
    junior: '11',
    senior: '15',
    mega: '19',
    supplement: '2',
  };

  const supabaseAdmin = createAdminSupabaseClient();
  const cleanupResult = await cleanupE2EData(supabaseAdmin);

  testInfo.annotations.push(
    { type: 'target', description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${demoTenantId}` },
    { type: 'cleanup', description: JSON.stringify(cleanupResult.deleted) }
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
  await categoryDialog.getByTestId('category-name-input').fill(names.categoryInitial);
  await categoryDialog.getByTestId('category-manages-sizes-switch').click();
  await categoryDialog.getByTestId('category-add-size-button').click();
  await categoryDialog.getByTestId('category-add-size-button').click();
  await categoryDialog.getByTestId('category-add-size-button').click();
  await categoryDialog.getByTestId('category-size-template-0').fill('Junior');
  await categoryDialog.getByTestId('category-size-template-1').fill('Senior');
  await categoryDialog.getByTestId('category-size-template-2').fill('Mega');
  await categoryDialog.getByTestId('category-save-button').click();

  const createdCategoryRows = await waitForRows(
    () => fetchByNames(supabaseAdmin, 'categories', [names.categoryInitial]),
    1,
    'Expected the E2E category to be persisted in Supabase.'
  );
  const createdCategoryId = createdCategoryRows[0].id;

  await page.getByTestId('category-search-input').fill(names.categoryInitial);
  await page.getByTestId(`category-edit-${createdCategoryId}`).click();
  await categoryDialog.getByTestId('category-name-input').fill(names.categoryUpdated);
  await categoryDialog.getByTestId('category-save-button').click();

  await page.getByTestId('settings-tab-ingredients').click();
  for (const ingredientName of names.ingredients) {
    await page.getByTestId('ingredient-create-button').click();
    const ingredientDialog = page.getByTestId('ingredient-dialog');
    await ingredientDialog.getByTestId('ingredient-name-input').fill(ingredientName);
    await ingredientDialog.getByTestId('ingredient-stock-input').fill('100');
    await ingredientDialog.getByTestId('ingredient-cost-input').fill('1.50');
    await ingredientDialog.getByTestId('ingredient-save-button').click();
  }

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId('product-create-button').click();
  const productDialog = page.getByTestId('product-dialog');
  await productDialog.getByTestId('product-form-name-input').fill(names.product);
  await selectRadixOption(page, productDialog.getByTestId('product-form-category-trigger'), names.categoryUpdated);
  await productDialog.getByTestId('product-size-price-Junior').fill(prices.junior);
  await productDialog.getByTestId('product-size-price-Senior').fill(prices.senior);
  await productDialog.getByTestId('product-size-price-Mega').fill(prices.mega);
  await productDialog.getByRole('tab', { name: /Ingr.dients/i }).click();
  for (let index = 0; index < names.ingredients.length; index += 1) {
    await productDialog.getByTestId('product-add-ingredient-button').click();
    await selectRadixOption(page, productDialog.getByTestId(`product-ingredient-select-${index}`), names.ingredients[index]);
    await productDialog.getByTestId(`product-ingredient-quantity-${index}`).fill(index === 0 ? '120' : index === 1 ? '90' : '5');
  }
  await productDialog.getByTestId('product-form-submit').click();
  await expect(productDialog).toBeHidden({ timeout: 20_000 });

  const productRows = await waitForRows(
    () => fetchProductByName(supabaseAdmin, names.product),
    1,
    'Expected the E2E product to be persisted in Supabase.'
  );
  const productId = productRows[0].id;
  const productIngredients = await fetchProductIngredients(supabaseAdmin, productId);
  expect(productIngredients).toHaveLength(3);

  await page.getByTestId('settings-tab-options').click();
  await page.getByTestId('option-template-create-button').click();
  await page.getByTestId('option-group-name-input').fill(names.optionGroup);
  await page.getByTestId('option-group-save-button').click();
  await waitForRows(
    () => fetchOptionGroups(supabaseAdmin, [names.optionGroup]),
    1,
    'Expected the option template group to be persisted in Supabase before adding an option item.'
  );
  await expect(page.getByText(names.optionGroup, { exact: true })).toBeVisible({ timeout: 20_000 });
  const templateGroups = await waitForRows(
    () => fetchOptionGroups(supabaseAdmin, [names.optionGroup]),
    1,
    'Expected the option template group to be persisted in Supabase.'
  );
  const templateGroupId = templateGroups[0].id;
  const templateCard = page.getByTestId(`option-template-card-${templateGroupId}`);
  await templateCard.getByTestId(`option-item-add-${templateGroupId}`).click();
  await page.getByTestId('option-item-name-input').fill(names.optionItem);
  await page.getByTestId('option-item-surcharge-input').fill(prices.supplement);
  await page.getByTestId('option-item-save-button').click();
  await expect(page.getByText(names.optionItem, { exact: true })).toBeVisible({ timeout: 15_000 });

  const templateItems = await waitForRows(
    () => fetchOptionItems(supabaseAdmin, [names.optionItem]),
    1,
    'Expected the option template item to be persisted in Supabase.'
  );
  expect(Number(templateItems[0].price_surcharge)).toBe(2);

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId(`product-options-${productId}`).click();
  const optionsDialog = page.getByTestId('product-options-dialog');
  const assignmentCheckbox = optionsDialog.getByTestId(`option-template-assign-${templateGroupId}`);
  await assignmentCheckbox.click();

  await expect.poll(async () => {
    const assignedGroups = await fetchProductOptionGroups(supabaseAdmin, productId);
    return assignedGroups.filter((group) => group.template_group_id === templateGroupId).length;
  }, {
    timeout: 20_000,
    message: 'Expected product option group copy to be created for the assigned template.',
  }).toBe(1);

  const assignedGroups = await fetchProductOptionGroups(supabaseAdmin, productId);
  const assignedGroup = assignedGroups.find((group) => group.template_group_id === templateGroupId);
  expect(assignedGroup).toBeTruthy();
  expect(assignedGroup.product_id).toBe(productId);
  expect(assignedGroup.template_group_id).toBe(templateGroupId);

  await expect(optionsDialog.getByRole('heading', { name: names.optionGroup, exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(optionsDialog.getByText(names.optionItem, { exact: true })).toBeVisible({ timeout: 20_000 });

  const copiedItems = await fetchOptionItemsByGroupIds(supabaseAdmin, [assignedGroup.id]);
  expect(copiedItems).toHaveLength(1);
  expect(copiedItems[0].nom).toBe(names.optionItem);
  expect(Number(copiedItems[0].price_surcharge)).toBe(2);

  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  await assertDemoTenantSession(page);
  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId(`product-options-${productId}`).click();
  const optionsDialogAfterRefresh = page.getByTestId('product-options-dialog');
  const checkboxAfterRefresh = optionsDialogAfterRefresh.getByRole('checkbox', { name: names.optionGroup });
  await expect(checkboxAfterRefresh).toBeChecked();
  await expect(optionsDialogAfterRefresh.getByText(names.optionItem, { exact: true })).toBeVisible({ timeout: 20_000 });
});
