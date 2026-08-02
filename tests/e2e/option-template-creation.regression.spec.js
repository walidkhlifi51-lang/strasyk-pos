import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  cleanupE2EData,
  createAdminSupabaseClient,
  demoTenantId,
  fetchByNames,
  fetchOptionGroups,
  fetchOptionItems,
  fetchOptionItemsByGroupIds,
  fetchProductByName,
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

test('option template creation and edition persist correctly', async ({ page, baseURL }, testInfo) => {
  assertSafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });

  const names = {
    category: 'E2E_OPT_CAT_OPTIONS',
    product: 'E2E_OPT_PRODUCT_OPTIONS',
    templateDraft: 'E2E_OPT_TEMPLATE_DRAFT',
    templateFinal: 'E2E_OPT_TEMPLATE_FINAL',
    itemDraft: 'E2E_OPT_ITEM_DRAFT',
    itemFinal: 'E2E_OPT_ITEM_FINAL',
  };

  const supabaseAdmin = createAdminSupabaseClient();
  const cleanupResult = await cleanupE2EData(supabaseAdmin);
  const optionGroupPosts = [];
  const networkErrors = [];
  const consoleErrors = [];

  testInfo.annotations.push(
    { type: 'target', description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${demoTenantId}` },
    { type: 'cleanup', description: JSON.stringify(cleanupResult.deleted) }
  );

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes('/rest/v1/option_groups')) return;

    const payload = request.postDataJSON?.() ?? null;
    optionGroupPosts.push({
      url: request.url(),
      payload,
    });
  });

  page.on('response', async (response) => {
    if (response.status() < 400) return;
    if (!response.url().includes('supabase.co')) return;

    networkErrors.push({
      status: response.status(),
      url: response.url(),
      body: await response.text().catch(() => null),
    });
  });

  await page.goto('/Auth', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(e2eConfig.email);
  await page.locator('#password').fill(e2eConfig.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
  await assertDemoTenantSession(page);

  await page.goto('/Parametres', { waitUntil: 'domcontentloaded' });
  await assertDemoTenantSession(page);

  await page.getByTestId('settings-tab-categories').click();
  await page.getByTestId('category-create-button').click();
  const categoryDialog = page.getByTestId('category-dialog');
  await categoryDialog.getByTestId('category-name-input').fill(names.category);
  await categoryDialog.getByTestId('category-save-button').click();
  await waitForRows(
    () => fetchByNames(supabaseAdmin, 'categories', [names.category]),
    1,
    'Expected the options regression category to be persisted in Supabase.'
  );

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId('product-create-button').click();
  const productDialog = page.getByTestId('product-dialog');
  await productDialog.getByTestId('product-form-name-input').fill(names.product);
  await selectRadixOption(page, productDialog.getByTestId('product-form-category-trigger'), names.category);
  await productDialog.getByTestId('product-form-price-input').fill('10');
  await productDialog.getByTestId('product-form-submit').click();
  await expect(productDialog).toBeHidden({ timeout: 20_000 });

  const productRows = await waitForRows(
    () => fetchProductByName(supabaseAdmin, names.product),
    1,
    'Expected the options regression product to be persisted in Supabase.'
  );
  const productId = productRows[0].id;

  await page.getByTestId('settings-tab-options').click();
  await page.getByTestId('option-template-create-button').click();
  await page.getByTestId('option-group-name-input').fill(names.templateDraft);
  await page.getByTestId('option-group-save-button').click();

  const createdTemplateRows = await waitForRows(
    () => fetchOptionGroups(supabaseAdmin, [names.templateDraft]),
    1,
    'Expected the option template group to be created in Supabase.'
  );
  const createdTemplateId = createdTemplateRows[0].id;
  expect(createdTemplateRows[0].tenant_id).toBe(demoTenantId);
  expect(createdTemplateRows[0].is_template).toBe(true);

  const createRequest = optionGroupPosts.find((entry) => entry.payload?.nom === names.templateDraft);
  expect(createRequest).toBeTruthy();
  expect(createRequest.payload.product_id).toBeNull();
  expect(createRequest.payload.is_template).toBe(true);

  const templateCard = page.getByTestId(`option-template-card-${createdTemplateId}`);
  await expect(templateCard).toContainText(names.templateDraft);
  await templateCard.getByTestId(`option-template-edit-${createdTemplateId}`).click();
  await page.getByTestId('option-group-name-input').fill(names.templateFinal);
  await page.getByTestId('option-group-selection-type-trigger').click();
  await page.getByRole('option', { name: 'Choix multiple', exact: true }).click();
  await page.getByTestId('option-group-min-selections-input').fill('1');
  await page.getByTestId('option-group-max-selections-input').fill('2');
  await page.getByTestId('option-group-save-button').click();

  const updatedTemplateRows = await waitForRows(
    () => fetchOptionGroups(supabaseAdmin, [names.templateFinal]),
    1,
    'Expected the option template group to be updated in Supabase.'
  );
  expect(updatedTemplateRows[0].id).toBe(createdTemplateId);
  expect(updatedTemplateRows[0].selection_type).toBe('multiple');
  expect(updatedTemplateRows[0].min_selections).toBe(1);
  expect(updatedTemplateRows[0].max_selections).toBe(2);

  await page.getByTestId(`option-template-card-${createdTemplateId}`).getByTestId(`option-item-add-${createdTemplateId}`).click();
  await page.getByTestId('option-item-name-input').fill(names.itemDraft);
  await page.getByTestId('option-item-surcharge-input').fill('2');
  await page.getByTestId('option-item-save-button').click();

  const createdItemRows = await waitForRows(
    () => fetchOptionItems(supabaseAdmin, [names.itemDraft]),
    1,
    'Expected the option template item to be created in Supabase.'
  );
  const createdItemId = createdItemRows[0].id;
  expect(createdItemRows[0].tenant_id).toBe(demoTenantId);
  expect(Number(createdItemRows[0].price_surcharge)).toBe(2);

  await page.getByTestId(`option-item-edit-${createdItemId}`).click();
  await page.getByTestId('option-item-name-input').fill(names.itemFinal);
  await page.getByTestId('option-item-surcharge-input').fill('2.5');
  await page.getByTestId('option-item-save-button').click();

  const updatedItemRows = await waitForRows(
    () => fetchOptionItems(supabaseAdmin, [names.itemFinal]),
    1,
    'Expected the option template item to be updated in Supabase.'
  );
  expect(updatedItemRows[0].id).toBe(createdItemId);
  expect(Number(updatedItemRows[0].price_surcharge)).toBe(2.5);

  await page.getByTestId('settings-tab-products').click();
  await page.getByTestId(`product-options-${productId}`).click();
  const optionsDialog = page.getByTestId('product-options-dialog');
  await optionsDialog.getByTestId(`option-template-assign-${createdTemplateId}`).click();

  const assignedGroups = await expect.poll(async () => {
    const rows = await fetchProductOptionGroups(supabaseAdmin, productId);
    return rows.filter((row) => row.template_group_id === createdTemplateId);
  }, {
    timeout: 20_000,
    message: 'Expected the product option group copy to be created for the template.',
  }).toHaveLength(1);

  const productGroups = await fetchProductOptionGroups(supabaseAdmin, productId);
  const assignedGroup = productGroups.find((row) => row.template_group_id === createdTemplateId);
  expect(assignedGroup).toBeTruthy();
  expect(assignedGroup.product_id).toBe(productId);

  const copiedItems = await fetchOptionItemsByGroupIds(supabaseAdmin, [assignedGroup.id]);
  expect(copiedItems).toHaveLength(1);
  expect(copiedItems[0].nom).toBe(names.itemFinal);
  expect(Number(copiedItems[0].price_surcharge)).toBe(2.5);

  await selectRadixOption(
    optionsDialog,
    optionsDialog.getByTestId(`product-group-rules-selection-type-${assignedGroup.id}`),
    'Choix unique'
  );
  await optionsDialog.getByTestId(`product-group-rules-save-${assignedGroup.id}`).click();

  await expect.poll(async () => {
    const rows = await fetchProductOptionGroups(supabaseAdmin, productId);
    return rows.find((row) => row.id === assignedGroup.id)?.selection_type ?? null;
  }, {
    timeout: 20_000,
    message: 'Expected the product group rules to be updated in Supabase.',
  }).toBe('single');

  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertDemoTenantSession(page);
  await page.getByTestId('settings-tab-options').click();
  await expect(page.getByTestId(`option-template-card-${createdTemplateId}`)).toContainText(names.templateFinal);
  await expect(page.getByText(names.itemFinal, { exact: true })).toBeVisible({ timeout: 20_000 });

  expect(optionGroupPosts.length).toBeGreaterThan(0);
  expect(networkErrors).toEqual([]);
  expect(consoleErrors.filter((entry) => entry.includes('safeWithTenant is not defined'))).toEqual([]);
});
