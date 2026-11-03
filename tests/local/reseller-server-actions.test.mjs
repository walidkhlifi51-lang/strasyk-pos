import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { assertResellerAction, executeResellerAction, getResellerPermissions, getResellerTabs, RESELLER_PERMISSION_KEYS } from '../../src/lib/resellerAccess.js';

const contract = (patch = {}) => ({
  status: 'active', role: 'owner', server_actions: ['create_tenant'],
  reseller: { id: 'reseller-A', type: 'standard', permissions: { can_create_tenant: true } },
  ...patch,
});

for (const type of ['standard', 'white_label']) {
  test(`${type}: all missing commercial permissions are disabled`, () => {
    const permissions = getResellerPermissions({ type });
    assert.equal(Object.keys(permissions).length, RESELLER_PERMISSION_KEYS.length);
    assert.ok(Object.values(permissions).every((value) => value === false));
    assert.deepEqual([...getResellerTabs({ type })], ['clients']);
  });
}

test('white label features require both the type and the explicit permission', () => {
  const permissions = { can_manage_branding: true, can_manage_domain: true, can_manage_subresellers: true };
  assert.equal(getResellerPermissions({ type: 'standard', permissions }).can_manage_branding, false);
  assert.equal(getResellerPermissions({ type: 'white_label', permissions }).can_manage_branding, true);
});

test('viewing commissions and viewing invoices are independent permissions', () => {
  const reseller = { type: 'standard', permissions: { can_view_commissions: true } };
  assert.equal(getResellerTabs(reseller).has('commissions'), true);
  assert.equal(getResellerTabs(reseller).has('invoices'), false);
});

test('support and suspended users cannot create a merchant despite enabled permissions', () => {
  assert.throws(() => assertResellerAction(contract({ role: 'support' }), 'create_tenant'), /NOT_AUTHORIZED/);
  assert.throws(() => assertResellerAction(contract({ status: 'suspended' }), 'create_tenant'), /NOT_AUTHORIZED/);
});

test('a missing server action never falls back to direct table writes', async () => {
  let writes = 0;
  await assert.rejects(executeResellerAction({
    readContext: async () => contract({ server_actions: [] }), invoke: async () => { writes++; },
  }, 'create_tenant', {}), /NOT_AUTHORIZED/);
  assert.equal(writes, 0);
});

test('revocation is re-read for each action and stops the next invocation', async () => {
  let enabled = true;
  let writes = 0;
  const adapter = {
    readContext: async () => enabled ? contract() : contract({ reseller: { type: 'standard', permissions: {} } }),
    invoke: async (action, payload) => { writes++; return { action, payload }; },
  };
  await executeResellerAction(adapter, 'create_tenant', { nom_commercial: 'Test' });
  enabled = false;
  await assert.rejects(executeResellerAction(adapter, 'create_tenant', {}), /NOT_AUTHORIZED/);
  assert.equal(writes, 1);
});

test('reading invoices or managing offers never authorizes settling or deleting invoices', () => {
  const allowed = contract({ reseller: { type: 'white_label', permissions: {
    can_view_commercial_invoices: true, can_manage_commercial_offers: true,
  } }, server_actions: ['create_invoice', 'mark_invoice_paid', 'toggle_monthly_payment', 'delete_invoice'] });
  for (const action of allowed.server_actions) assert.throws(() => assertResellerAction(allowed, action), /NOT_AUTHORIZED/);
});

test('failure to read the permission context never invokes a write', async () => {
  await assert.rejects(executeResellerAction({
    readContext: async () => { throw new Error('offline'); }, invoke: () => assert.fail('unexpected write'),
  }, 'create_tenant', {}), /offline/);
});

test('reseller portal has no direct entity reads or writes behind its event handlers', () => {
  const ast = parse(readFileSync('src/pages/ResellerPortal.jsx', 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  const forbiddenImports = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration' && ['/api/appClient', '/lib/tenantProvisioning'].some((part) => node.source.value.endsWith(part))) {
      // Pure email formatting is allowed, but provisioning/entity entrypoints are not.
      for (const entry of node.specifiers) if (entry.imported?.name !== 'normalizeEmail') forbiddenImports.push(entry.local.name);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(ast);
  assert.deepEqual(forbiddenImports, []);
});
