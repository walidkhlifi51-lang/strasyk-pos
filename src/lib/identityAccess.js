// UI context only. Database grants, RLS and RPC checks remain authoritative.
export const IDENTITY_CONTRACT_VERSION = 1;

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

export const resolveIdentityAccess = (user, identity) => {
  if (!user?.id) return { user: null, status: 'not_authenticated' };
  if (identity?.version !== IDENTITY_CONTRACT_VERSION || identity?.user_id !== user.id) {
    fail('IDENTITY_CONTEXT_INVALID');
  }

  const memberships = identity.memberships || [];
  const resellers = identity.resellers || [];
  if (!Array.isArray(memberships) || !Array.isArray(resellers)) fail('IDENTITY_CONTEXT_INVALID');
  // Never mix a distributor identity with POS or platform privileges.
  if (resellers.length && (memberships.length || identity.is_platform_admin === true)) {
    fail('IDENTITY_ROLE_CONFLICT');
  }
  if (resellers.length > 1) fail('IDENTITY_RESELLER_SELECTION_REQUIRED');

  const base = {
    user: { ...user, tenant_id: null, role: 'user' },
    tenant: null, reseller: null, userAccess: null, deliveryPerson: null,
    isOwner: false, isPlatformAdmin: false, isReseller: false, role: null,
    availableTenants: [...new Map(memberships.map((entry) => [entry.tenant?.id, entry.tenant])).values()].filter(Boolean),
  };
  if (resellers.length) {
    const entry = resellers[0];
    if (!entry.reseller?.id || !['owner', 'manager', 'sales', 'support'].includes(entry.role)) {
      fail('IDENTITY_CONTEXT_INVALID');
    }
    return {
      ...base, reseller: entry.reseller, isReseller: true,
      resellerRole: entry.role, role: `reseller_${entry.role}`,
      status: entry.status === 'active' && entry.reseller.status === 'active' ? 'active' : 'suspended',
    };
  }
  const selectedId = identity.selected_tenant_id ?? memberships[0]?.tenant?.id ?? null;
  const selected = memberships.find((entry) => entry.tenant?.id === selectedId);
  if (selectedId && !selected) fail('TENANT_SELECTION_DENIED');
  if (identity.is_platform_admin === true && (!selected || selected.tenant.active !== true)) {
    return { ...base, user: { ...base.user, role: 'admin' }, role: 'admin', isPlatformAdmin: true, status: 'active' };
  }
  if (!memberships.length) return { ...base, status: 'no_access' };

  // Selection is server-owned and is validated against current memberships.
  const entry = selected;
  if (!entry.tenant?.id || !['owner', 'employee', 'manager', 'delivery'].includes(entry.role)) {
    fail('IDENTITY_CONTEXT_INVALID');
  }
  return {
    ...base,
    isPlatformAdmin: identity.is_platform_admin === true,
    user: { ...base.user, tenant_id: entry.tenant.id, role: entry.role },
    tenant: entry.tenant, role: entry.role, isOwner: entry.role === 'owner',
    userAccess: entry.user_access || null, deliveryPerson: entry.delivery_person || null,
    status: entry.tenant.active === true ? 'active' : 'suspended',
  };
};

export const scopeToTenant = (tenantId, data = {}) => {
  if (!tenantId) fail('TENANT_CONTEXT_REQUIRED');
  if (data.tenant_id != null && data.tenant_id !== tenantId) fail('TENANT_MISMATCH');
  return { ...data, tenant_id: tenantId };
};

export const readIdentityAccess = async ({ getUser, getContext }) => {
  const user = await getUser();
  if (!user) return { user: null, status: 'not_authenticated' };
  // Missing RPC or denied access must never fall back to email/JWT/localStorage.
  const context = await getContext();
  return resolveIdentityAccess(user, context);
};
