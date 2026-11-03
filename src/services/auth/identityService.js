import { appClient } from '@/api/appClient';
import { isSupabaseMode } from '@/config/env';
import { getSupabaseBrowserClient } from '@/api/supabase/client';
import { readIdentityAccess } from '@/lib/identityAccess';

const getLocalDemoContext = async () => {
  const user = await appClient.auth.me();
  const [tenants, accesses, admins, resellerUsers, drivers] = await Promise.all([
    appClient.entities.Tenant.filter({ owner_email: user.email }),
    appClient.entities.UserAccess.filter({ user_email: user.email, is_active: true }),
    appClient.entities.PlatformAdminAccess.filter({ user_email: user.email, is_active: true }),
    appClient.entities.ResellerUser.filter({ user_email: user.email }),
    appClient.entities.DeliveryPerson.filter({ user_email: user.email }),
  ]);
  const memberships = tenants.map((tenant) => ({ tenant, role: 'owner' }));
  for (const access of accesses) {
    const [tenant] = await appClient.entities.Tenant.filter({ id: access.tenant_id });
    if (tenant) memberships.push({ tenant, role: access.role, user_access: access });
  }
  for (const driver of drivers) {
    if (driver.app_access_enabled === false) continue;
    const [tenant] = await appClient.entities.Tenant.filter({ id: driver.tenant_id });
    const safeDriver = Object.fromEntries([
      'id', 'tenant_id', 'nom', 'prenom', 'app_access_enabled', 'en_livraison',
      'nb_livraisons_jour', 'total_encaisse',
    ].map((field) => [field, driver[field]]));
    if (tenant) memberships.push({ tenant, role: 'delivery', delivery_person: safeDriver });
  }
  const resellers = [];
  for (const member of resellerUsers) {
    const [reseller] = await appClient.entities.Reseller.filter({ id: member.reseller_id });
    if (reseller) resellers.push({ reseller, role: member.role, status: member.status });
  }
  const priority = { owner: 1, delivery: 2, manager: 3, employee: 3 };
  memberships.sort((left, right) => priority[left.role] - priority[right.role]);
  const requested = localStorage.getItem(`strasyk_demo_tenant_${user.id}`);
  const selected = memberships.find((entry) => entry.tenant.id === requested) || memberships[0];
  return { version: 1, user_id: user.id, is_platform_admin: admins.length > 0, memberships, resellers,
    selected_tenant_id: selected?.tenant.id || null };
};

export const identityService = {
  async getContext() {
    if (!isSupabaseMode) return getLocalDemoContext();
    const { data, error } = await getSupabaseBrowserClient().rpc('strasyk_get_identity_context');
    if (error) {
      const failure = new Error(error.code === 'PGRST202'
        ? 'M1_IDENTITY_RPC_REQUIRED: preparation SQL M1 non appliquee.'
        : 'IDENTITY_CONTEXT_UNAVAILABLE');
      failure.code = error.code;
      throw failure;
    }
    return data;
  },
  getAccess() {
    return readIdentityAccess({ getUser: () => appClient.auth.me(), getContext: () => this.getContext() });
  },
  async selectTenant(tenantId) {
    const pending = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
    if (!Array.isArray(pending) || pending.length) throw new Error('TENANT_SWITCH_PENDING_OPERATIONS');
    if (!isSupabaseMode) {
      const context = await getLocalDemoContext();
      if (!context.memberships.some((entry) => entry.tenant.id === tenantId)) throw new Error('TENANT_SELECTION_DENIED');
      const user = await appClient.auth.me();
      localStorage.setItem(`strasyk_demo_tenant_${user.id}`, tenantId);
      return;
    }
    const { error } = await getSupabaseBrowserClient().rpc('strasyk_select_tenant', { target_tenant_id: tenantId });
    if (error) throw new Error('TENANT_SELECTION_DENIED');
  },
};
