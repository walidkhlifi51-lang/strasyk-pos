import { test, expect } from '@playwright/test';
import { assertSafeTarget, loadE2EConfig, sanitizeEmailForLog } from './helpers/env.js';
import { extractTenantIdFromStoredSession } from './helpers/tenant.js';
import {
  LOT2_SCENARIOS,
  POS_REAL_DATA_MODEL,
  assertLot2SafeTarget,
  assertNoActiveLot2HoldOrder,
  assertNoPosWritesObserved,
  buildLot2CleanupProtection,
  createNetworkCollectors,
  cleanupHeldOrderById,
  extractPosReadModelSummary,
  fetchAvailableDemoTable,
  fetchCanonicalProductForLot2,
  fetchLot2ReadonlySnapshot,
  fetchOrderById,
  fetchTableById,
  waitForPosReadModel,
} from './helpers/lot2Pos.js';

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

const assertDemoTenantSession = async (page) => expect.poll(async () => {
  const localStorageSnapshot = await getLocalStorageSnapshot(page);
  return extractTenantIdFromStoredSession(localStorageSnapshot);
}, {
  timeout: 30_000,
  message: 'Expected the authenticated session to target the demo tenant.',
}).toBe(e2eConfig.expectedTenantId);

const expectSingleVisibleTestId = async (page, testId, timeout = 15_000) => {
  const locator = page.locator(`[data-testid="${testId}"]:visible`);
  await expect(locator).toHaveCount(1, { timeout });
  await expect(locator.first()).toBeVisible({ timeout });
  return locator.first();
};

const visibleOrderLineLocator = (page) => page.locator('[data-testid^="pos-order-line-"]:visible');

test.describe('lot 2 - POS orders and payments scaffold', () => {
  test('LOT2-000 smoke - open POS and observe the real read model without writes', async ({ page, baseURL }, testInfo) => {
    assertLot2SafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });
    await page.setViewportSize({ width: 1600, height: 1200 });

    const collectors = createNetworkCollectors(page);
    const before = await fetchLot2ReadonlySnapshot();
    const table = await fetchAvailableDemoTable();
    const simpleProduct = await fetchCanonicalProductForLot2('Coca-Cola');
    const pizzaProduct = await fetchCanonicalProductForLot2('Pizza Margherita');

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

    await page.goto('/StrasykPos', { waitUntil: 'networkidle' });
    await waitForPosReadModel({ page, responses: collectors.responses });
    await expect(page).toHaveURL(/\/StrasykPos/);
    await expect(page.getByRole('tab', { name: /Sur place/i })).toBeVisible({ timeout: 30_000 });

    const productSearch = await expectSingleVisibleTestId(page, 'pos-product-search-visible');
    const selectTableButton = await expectSingleVisibleTestId(page, 'pos-select-table-button');
    await expect(page.getByTestId('pos-waiting-orders-list').locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId(`pos-product-card-${simpleProduct.id}`).locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId(`pos-product-card-${pizzaProduct.id}`).locator(':visible')).toHaveCount(1);

    await selectTableButton.click();
    await expect(page.getByTestId(`pos-table-option-${table.id}`).locator(':visible')).toHaveCount(1);
    await page.getByTestId(`pos-table-option-${table.id}`).click();
    await expect(page.getByTestId(`pos-selected-table-${table.id}`).locator(':visible')).toHaveCount(1);

    await page.getByTestId(`pos-product-card-${pizzaProduct.id}`).click();
    await expect(page.getByTestId('pos-size-option-Petite').locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId('pos-size-option-Grande').locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId('pos-customization-quantity-value').locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId('pos-customization-confirm').locator(':visible')).toHaveCount(1);
    await page.getByRole('button', { name: 'Annuler' }).click();

    const after = await fetchLot2ReadonlySnapshot();
    const readModelSummary = extractPosReadModelSummary(collectors);
    const cleanupProtection = buildLot2CleanupProtection({});

    expect(readModelSummary.writeRequestsObserved).toBe(0);
    expect(readModelSummary.orderReadUrl).toContain('/rest/v1/orders');
    expect(readModelSummary.orderSelectFields).toEqual(expect.arrayContaining(['articles', 'mode_paiement', 'table_id', 'statut', 'payee']));

    if (readModelSummary.ordersFieldsObserved.length > 0 && readModelSummary.firstOrderArticlesShape.length > 0) {
      expect(readModelSummary.firstOrderArticlesShape).toEqual(expect.arrayContaining(['nom_produit', 'quantite', 'prix_unitaire', 'total_ligne']));
    }

    if (readModelSummary.ordersFieldsObserved.length > 0 && readModelSummary.firstOrderPaymentShape.length > 0) {
      expect(readModelSummary.firstOrderPaymentShape).toEqual(expect.arrayContaining(['methode', 'montant']));
    }

    expect(after.orders.length).toBe(before.orders.length);
    expect(after.tables.length).toBe(before.tables.length);
    expect(after.customers.length).toBe(before.customers.length);
    await assertNoPosWritesObserved(collectors);

    testInfo.attachments.push({
      name: 'lot2-read-model-summary',
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        baseURL: baseURL || e2eConfig.baseURL,
        expectedTenantId: e2eConfig.expectedTenantId,
        scenariosPrepared: LOT2_SCENARIOS,
        realDataModel: POS_REAL_DATA_MODEL,
        readModelSummary,
        cleanupProtection,
      }, null, 2)),
    });
  });

  test('LOT2-A commande sur place mise en attente', async ({ page, baseURL }, testInfo) => {
    assertLot2SafeTarget({ baseURL: baseURL || e2eConfig.baseURL, expectedTenantId: e2eConfig.expectedTenantId, branch: e2eConfig.branch });
    await page.setViewportSize({ width: 1600, height: 1200 });

    await assertNoActiveLot2HoldOrder();

    const collectors = createNetworkCollectors(page);
    const chronology = [];
    const runId = `E2E_LOT2_HOLD_${Date.now()}`;

    const record = (step, details = {}) => {
      chronology.push({
        timestamp: new Date().toISOString(),
        step,
        ...details,
      });
    };

    const tableBefore = await fetchAvailableDemoTable();
    if (!tableBefore) {
      throw new Error('LOT2-A requires one available table on the demo tenant.');
    }

    const simpleProduct = await fetchCanonicalProductForLot2('Coca-Cola');
    const pizzaProduct = await fetchCanonicalProductForLot2('Pizza Margherita');
    if (!simpleProduct || !pizzaProduct) {
      throw new Error('LOT2-A requires canonical products Coca-Cola and Pizza Margherita.');
    }

    const pizzaSize = Array.isArray(pizzaProduct.size_prices) && pizzaProduct.size_prices.length > 0
      ? pizzaProduct.size_prices[0]?.size
      : null;

    if (!pizzaSize) {
      throw new Error('LOT2-A requires one configured size on Pizza Margherita.');
    }

    const beforeSnapshot = await fetchLot2ReadonlySnapshot();
    record('preflight-ok', {
      tableId: tableBefore.id,
      tableName: tableBefore.nom,
      tableStatusBefore: tableBefore.statut,
      tableOrderBefore: tableBefore.order_id,
      simpleProductId: simpleProduct.id,
      pizzaProductId: pizzaProduct.id,
      pizzaSize,
    });

    testInfo.annotations.push({
      type: 'target',
      description: `demo=${sanitizeEmailForLog(e2eConfig.email)} tenant=${e2eConfig.expectedTenantId}`,
    });

    let createdOrderId = null;
    let resumedOrderNumber = null;
    let cleanupReport = null;

    await page.goto('/Auth', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(e2eConfig.email);
    await page.locator('#password').fill(e2eConfig.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/Auth'), { timeout: 30_000 });
    await assertDemoTenantSession(page);
    record('login-ok');

    await page.goto('/StrasykPos', { waitUntil: 'networkidle' });
    await waitForPosReadModel({ page, responses: collectors.responses });
    await expect(page).toHaveURL(/\/StrasykPos/);
    record('pos-opened');

    const productSearch = await expectSingleVisibleTestId(page, 'pos-product-search-visible');
    const selectTableButton = await expectSingleVisibleTestId(page, 'pos-select-table-button');
    await expect(page.getByTestId('pos-waiting-orders-list').locator(':visible')).toHaveCount(1);
    await selectTableButton.click();
    await expect(page.getByTestId(`pos-table-option-${tableBefore.id}`).locator(':visible')).toHaveCount(1);
    await page.getByTestId(`pos-table-option-${tableBefore.id}`).click();
    await expect(page.getByTestId(`pos-selected-table-${tableBefore.id}`).locator(':visible')).toHaveCount(1);
    record('table-selected', { tableId: tableBefore.id, tableName: tableBefore.nom });

    await productSearch.fill('Coca-Cola');
    await page.getByTestId(`pos-product-card-${simpleProduct.id}`).click();
    await expect(visibleOrderLineLocator(page)).toHaveCount(1, { timeout: 15_000 });
    record('simple-product-added', { productId: simpleProduct.id, productName: 'Coca-Cola' });

    await productSearch.fill('Pizza Margherita');
    await page.getByTestId(`pos-product-card-${pizzaProduct.id}`).click();
    await expect(page.getByText('Personnaliser: Pizza Margherita', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pos-size-option-Petite').locator(':visible')).toHaveCount(1);
    await expect(page.getByTestId('pos-size-option-Grande').locator(':visible')).toHaveCount(1);
    await page.getByTestId(`pos-size-option-${pizzaSize}`).click();
    await page.getByTestId('pos-customization-quantity-increase').click();
    await expect(page.getByTestId('pos-customization-quantity-value')).toHaveText('2');
    await page.getByTestId('pos-customization-confirm').click();
    await expect(visibleOrderLineLocator(page)).toHaveCount(2, { timeout: 15_000 });
    record('pizza-added-with-size', { productId: pizzaProduct.id, productName: 'Pizza Margherita', availableSizes: ['Petite', 'Grande'], size: pizzaSize });
    record('pizza-quantity-updated', { size: pizzaSize, quantity: 2, mechanism: 'customization-modal' });

    const notesInput = page.locator('#order-notes');
    await notesInput.fill(runId);
    record('note-set', { note: runId });

    const orderCreateResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === 'POST' && response.url().includes('/rest/v1/orders');
    }, { timeout: 30_000 });
    const tablePatchResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === 'PATCH' && response.url().includes('/rest/v1/tables');
    }, { timeout: 30_000 });

    await page.getByRole('button', { name: 'Mettre en attente' }).click();

    const orderCreateResponse = await orderCreateResponsePromise;
    const tablePatchResponse = await tablePatchResponsePromise;
    const orderCreatePayload = orderCreateResponse.request().postDataJSON();
    const createdOrderRows = await orderCreateResponse.json();
    createdOrderId = createdOrderRows?.[0]?.id || null;
    record('order-held', {
      createdOrderId,
      orderResponseStatus: orderCreateResponse.status(),
      tablePatchStatus: tablePatchResponse.status(),
    });

    if (!createdOrderId) {
      throw new Error('LOT2-A did not receive a created order id from the hold response.');
    }

    const heldOrder = await fetchOrderById(createdOrderId);
    const tableAfterHold = await fetchTableById(tableBefore.id);
    const afterHoldSnapshot = await fetchLot2ReadonlySnapshot();

    expect(afterHoldSnapshot.orders.length).toBe(beforeSnapshot.orders.length + 1);
    expect(heldOrder?.tenant_id).toBe(e2eConfig.expectedTenantId);
    expect(heldOrder?.statut).toBe('en_attente');
    expect(heldOrder?.payee).toBe(false);
    expect(heldOrder?.table_id).toBe(tableBefore.id);
    expect(heldOrder?.notes).toBe(runId);
    expect(Array.isArray(heldOrder?.articles)).toBe(true);
    expect(heldOrder.articles).toHaveLength(2);

    const heldSimpleLine = heldOrder.articles.find((article) => article.nom_produit === 'Coca-Cola');
    const heldPizzaLine = heldOrder.articles.find((article) => article.nom_produit === `Pizza Margherita (${pizzaSize})`);
    expect(heldSimpleLine?.quantite).toBe(1);
    expect(heldPizzaLine?.quantite).toBe(2);
    expect(heldPizzaLine?.size).toBe(pizzaSize);
    expect(Array.isArray(heldOrder.mode_paiement)).toBe(true);
    expect(heldOrder.mode_paiement).toHaveLength(0);
    expect(tableAfterHold?.order_id).toBe(createdOrderId);
    expect(tableAfterHold?.statut).toBe('occupee');
    record('supabase-hold-verified', {
      orderId: createdOrderId,
      tableId: tableBefore.id,
      tableStatusAfterHold: tableAfterHold?.statut,
      articles: heldOrder.articles,
    });

    await page.reload({ waitUntil: 'networkidle' });
    await waitForPosReadModel({ page, responses: collectors.responses });
    await expect(page.getByTestId('pos-waiting-orders-list').locator(':visible')).toHaveCount(1, { timeout: 15_000 });
    record('page-refreshed');

    const orderCard = page.getByTestId(`pos-order-card-${createdOrderId}`);
    await expect(orderCard.locator(':visible')).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId(`pos-order-resume-${createdOrderId}`).click();
    resumedOrderNumber = heldOrder.numero_commande || String(heldOrder.numero_caisse);
    await expect(page.getByTestId(`pos-selected-table-${tableBefore.id}`).locator(':visible')).toHaveCount(1, { timeout: 15_000 });
    await expect(visibleOrderLineLocator(page)).toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByTestId('pos-order-note-input')).toHaveValue(runId);
    record('order-resumed-after-refresh', { resumedOrderNumber });

    const resumedTable = await fetchTableById(tableBefore.id);
    expect(resumedTable?.order_id).toBe(createdOrderId);
    expect(resumedTable?.statut).toBe('occupee');

    cleanupReport = await cleanupHeldOrderById({ orderId: createdOrderId, tableBefore });
    const afterCleanupSnapshot = await fetchLot2ReadonlySnapshot();
    const tableAfterCleanup = await fetchTableById(tableBefore.id);
    expect(afterCleanupSnapshot.orders.length).toBe(beforeSnapshot.orders.length);
    expect(tableAfterCleanup?.order_id ?? null).toBe(tableBefore.order_id ?? null);
    expect(tableAfterCleanup?.statut).toBe(tableBefore.statut);
    record('cleanup-complete', {
      deletedOrderId: cleanupReport.deletedOrder.id,
      restoredTable: cleanupReport.restoredTable,
    });

    const errorResponses = collectors.responses.filter((entry) => entry.status >= 400);
    expect(errorResponses).toHaveLength(0);

    const summary = {
      chronology,
      network: {
        orderCreate: {
          url: orderCreateResponse.url(),
          status: orderCreateResponse.status(),
          payloadColumns: Object.keys(orderCreatePayload || {}),
          payload: {
            numero_commande: orderCreatePayload?.numero_commande,
            type_commande: orderCreatePayload?.type_commande,
            tenant_id: orderCreatePayload?.tenant_id,
            table_id: orderCreatePayload?.table_id,
            statut: orderCreatePayload?.statut,
            payee: orderCreatePayload?.payee,
            notes: orderCreatePayload?.notes,
            articles: orderCreatePayload?.articles,
          },
        },
        tablePatch: {
          url: tablePatchResponse.url(),
          status: tablePatchResponse.status(),
          payload: tablePatchResponse.request().postDataJSON(),
        },
      },
      ids: {
        tableId: tableBefore.id,
        orderId: createdOrderId,
        simpleProductId: simpleProduct.id,
        pizzaProductId: pizzaProduct.id,
      },
      supabase: {
        heldOrder,
        tableBefore,
        tableAfterHold,
        tableAfterCleanup,
      },
      resumedOrderNumber,
      cleanupReport,
      consoleErrors: collectors.consoleErrors,
      requestErrors: errorResponses,
    };

    console.log(JSON.stringify(summary, null, 2));
  });

  test.skip('LOT2-004 produit simple', async () => {});
  test.skip('LOT2-005 pizza avec taille', async () => {});
  test.skip('LOT2-008 changement de quantité', async () => {});
  test.skip('LOT2-011 mise en attente et reprise', async () => {});
  test.skip('LOT2-012 paiement espèces', async () => {});
  test.skip('LOT2-014 protection double validation', async () => {});
  test.skip('LOT2-015 persistance après rafraîchissement', async () => {});
  test.skip('LOT2-016 isolation tenant', async () => {});
});
