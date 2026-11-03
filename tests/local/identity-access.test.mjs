import test from 'node:test';
import assert from 'node:assert/strict';
import { readIdentityAccess, resolveIdentityAccess, scopeToTenant } from '../../src/lib/identityAccess.js';

const user = { id: 'auth-A', email: 'a@example.test', tenant_id: 'tenant-B', role: 'admin' };
const tenant = { id: 'tenant-A', active: true, nom_commercial: 'Test A' };
const context = (patch = {}) => ({
  version: 1, user_id: user.id, is_platform_admin: false, memberships: [], resellers: [], ...patch,
});
const merchantContext = (patch = {}) => context({ memberships: [{ tenant, role: 'owner' }], ...patch });

test('JWT tenant and admin role do not grant any access', () => {
  const access = resolveIdentityAccess(user, context());
  assert.equal(access.status, 'no_access');
  assert.equal(access.isPlatformAdmin, false);
  assert.equal(access.user.tenant_id, null);
  assert.equal(access.user.role, 'user');
});

test('verified membership selects A despite forged metadata pointing to B', () => {
  const access = resolveIdentityAccess(user, merchantContext());
  assert.equal(access.tenant.id, 'tenant-A');
  assert.equal(access.user.tenant_id, 'tenant-A');
  assert.equal(access.role, 'owner');
});

test('a context for another Auth user or contract version is rejected', () => {
  assert.throws(() => resolveIdentityAccess(user, context({ user_id: 'auth-B' })), /IDENTITY_CONTEXT_INVALID/);
  assert.throws(() => resolveIdentityAccess(user, context({ version: 2 })), /IDENTITY_CONTEXT_INVALID/);
});

test('missing RPC fails closed without consulting metadata or an alternative backend', async () => {
  let calls = 0;
  await assert.rejects(readIdentityAccess({
    getUser: async () => user,
    getContext: async () => { calls++; throw new Error('M1_IDENTITY_RPC_REQUIRED'); },
  }), /M1_IDENTITY_RPC_REQUIRED/);
  assert.equal(calls, 1);
});

test('anonymous callers do not request an identity context', async () => {
  assert.equal((await readIdentityAccess({
    getUser: async () => null, getContext: () => { throw new Error('must not run'); },
  })).status, 'not_authenticated');
});

for (const type of ['standard', 'white_label']) {
  test(`${type} reseller gets no tenant or platform privileges`, () => {
    const access = resolveIdentityAccess(user, context({ resellers: [{
      reseller: { id: 'reseller-A', type, status: 'active' }, role: 'owner', status: 'active',
    }] }));
    assert.equal(access.status, 'active');
    assert.equal(access.isReseller, true);
    assert.equal(access.isPlatformAdmin, false);
    assert.equal(access.isOwner, false);
    assert.equal(access.tenant, null);
    assert.equal(access.user.tenant_id, null);
  });
}

test('reseller cannot combine a merchant or platform-admin identity', () => {
  const resellers = [{ reseller: { id: 'reseller-A', status: 'active' }, role: 'owner', status: 'active' }];
  assert.throws(() => resolveIdentityAccess(user, merchantContext({ resellers })), /IDENTITY_ROLE_CONFLICT/);
  assert.throws(() => resolveIdentityAccess(user, context({ resellers, is_platform_admin: true })), /IDENTITY_ROLE_CONFLICT/);
});

test('suspended reseller remains suspended and is not converted into a merchant', () => {
  const access = resolveIdentityAccess(user, context({ resellers: [{
    reseller: { id: 'reseller-A', status: 'active' }, role: 'sales', status: 'suspended',
  }] }));
  assert.equal(access.status, 'suspended');
  assert.equal(access.tenant, null);
});

test('tenant must be explicitly active; employee keeps its actual access flags', () => {
  const access = resolveIdentityAccess(user, context({ memberships: [{
    tenant: { ...tenant, active: false }, role: 'employee',
    user_access: { can_access_settings: false },
  }] }));
  assert.equal(access.status, 'suspended');
  assert.equal(access.isOwner, false);
  assert.equal(access.userAccess.can_access_settings, false);
});

test('revocation applies on the next context read with the same Auth user', async () => {
  let granted = true;
  const dependencies = { getUser: async () => user, getContext: async () => granted ? merchantContext() : context() };
  assert.equal((await readIdentityAccess(dependencies)).status, 'active');
  granted = false;
  assert.equal((await readIdentityAccess(dependencies)).status, 'no_access');
});

test('a platform administrator is granted access only by the server context', () => {
  const access = resolveIdentityAccess(user, context({ is_platform_admin: true }));
  assert.equal(access.isPlatformAdmin, true);
  assert.equal(access.tenant, null);
  assert.equal(access.role, 'admin');
});

test('unknown roles, malformed memberships and ambiguous reseller selections fail closed', () => {
  assert.throws(() => resolveIdentityAccess(user, context({ memberships: [{ tenant, role: 'admin' }] })), /INVALID/);
  assert.throws(() => resolveIdentityAccess(user, context({ memberships: 'invalid' })), /INVALID/);
  assert.throws(() => resolveIdentityAccess(user, context({ resellers: [{}, {}] })), /SELECTION_REQUIRED/);
});

test('scoping never removes tenant constraints or accepts another tenant', () => {
  assert.deepEqual(scopeToTenant('tenant-A', { id: 'order-A' }), { id: 'order-A', tenant_id: 'tenant-A' });
  assert.throws(() => scopeToTenant(null, {}), /TENANT_CONTEXT_REQUIRED/);
  assert.throws(() => scopeToTenant('tenant-A', { tenant_id: 'tenant-B' }), /TENANT_MISMATCH/);
});

test('multi-tenant selection follows a server-validated choice, not the first row or JWT', () => {
  const second = { id: 'tenant-C', active: true, nom_commercial: 'Test C' };
  const access = resolveIdentityAccess(user, context({ selected_tenant_id: second.id, memberships: [
    { tenant, role: 'owner' }, { tenant: second, role: 'employee', user_access: { can_access_pos: true } },
  ] }));
  assert.equal(access.tenant.id, second.id);
  assert.equal(access.isOwner, false);
  assert.equal(access.availableTenants.length, 2);
});

test('selection of an unauthorized tenant is rejected even for a platform admin', () => {
  assert.throws(() => resolveIdentityAccess(user, merchantContext({
    selected_tenant_id: 'tenant-B', is_platform_admin: true,
  })), /TENANT_SELECTION_DENIED/);
});

test('suspended merchant ownership does not lock out a verified STRASYK administrator', () => {
  const access = resolveIdentityAccess(user, context({ is_platform_admin: true, selected_tenant_id: tenant.id,
    memberships: [{ tenant: { ...tenant, active: false }, role: 'owner' }],
  }));
  assert.equal(access.status, 'active');
  assert.equal(access.isPlatformAdmin, true);
  assert.equal(access.tenant, null);
  assert.equal(access.role, 'admin');
  assert.equal(access.availableTenants.length, 1);
});

test('a verified administrator keeps its active merchant membership without inventing a reseller role', () => {
  const access = resolveIdentityAccess(user, merchantContext({ is_platform_admin: true, selected_tenant_id: tenant.id }));
  assert.equal(access.isOwner, true);
  assert.equal(access.isPlatformAdmin, true);
  assert.equal(access.isReseller, false);
  assert.equal(access.tenant.id, tenant.id);
});

test('a revoked selected membership is not accepted from a previous context', () => {
  assert.throws(() => resolveIdentityAccess(user, context({ selected_tenant_id: tenant.id })), /TENANT_SELECTION_DENIED/);
});
