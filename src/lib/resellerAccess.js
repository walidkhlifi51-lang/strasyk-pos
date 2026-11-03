export const RESELLER_PERMISSION_KEYS = [
  'can_create_tenant', 'can_activate_tenant', 'can_suspend_tenant', 'can_reactivate_tenant',
  'can_assign_license', 'can_change_license', 'can_manage_commercial_offers',
  'can_view_commissions', 'can_view_commercial_invoices', 'can_manage_branding',
  'can_manage_domain', 'can_manage_subresellers',
];

// Navigation only; Layout and server permissions still deny POS access.
export const resellerPortalRedirect = (access, pathname) => (
  access?.status === 'active' && access.isReseller === true
    && access.isPlatformAdmin !== true && pathname !== '/ResellerPortal'
    ? '/ResellerPortal' : null
);

export const getResellerPermissions = (reseller) => Object.fromEntries(
  RESELLER_PERMISSION_KEYS.map((key) => [key, reseller?.permissions?.[key] === true
    && (!['can_manage_branding', 'can_manage_domain', 'can_manage_subresellers'].includes(key)
      || reseller?.type === 'white_label')]),
);

export const getResellerTabs = (reseller) => {
  const permissions = getResellerPermissions(reseller);
  const tabs = new Set(['clients']);
  if (permissions.can_view_commercial_invoices) ['stats', 'accounting', 'invoices'].forEach((tab) => tabs.add(tab));
  if (permissions.can_view_commissions) tabs.add('commissions');
  if (permissions.can_manage_commercial_offers) tabs.add('pricing');
  if (permissions.can_manage_branding || permissions.can_manage_domain) tabs.add('branding');
  return tabs;
};

export const assertResellerAction = (context, action) => {
  // Managing offers or reading invoices never authorizes financial mutations.
  const permission = { create_tenant: 'can_create_tenant', create_owner_invitation: 'can_create_tenant' }[action];
  const permissions = getResellerPermissions(context?.reseller);
  if (context?.status !== 'active' || !['owner', 'manager', 'sales'].includes(context?.role)
      || !permission || !permissions[permission] || !context?.server_actions?.includes(action)) {
    throw new Error('RESELLER_ACTION_NOT_AUTHORIZED');
  }
};

// Re-read the server contract for every action. No entity CRUD fallback exists.
export const executeResellerAction = async ({ readContext, invoke }, action, payload) => {
  assertResellerAction(await readContext(), action);
  return invoke(action, payload);
};
