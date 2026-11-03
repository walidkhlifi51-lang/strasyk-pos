import { appClient } from '@/api/appClient';
import { getSupabaseBrowserClient } from '@/api/supabase/client';
import { executeResellerAction } from '@/lib/resellerAccess';
import { isSupabaseMode } from '@/config/env';
import { identityService } from '@/services/auth/identityService';

export const resellerService = {
  async getPortalContext() {
    if (!isSupabaseMode) {
      const access = await identityService.getAccess();
      if (!access.isReseller || access.status !== 'active') throw new Error('RESELLER_ACCESS_DENIED');
      const links = await appClient.entities.ResellerTenant.filter({ reseller_id: access.reseller.id, status: 'active' });
      const tenants = [];
      for (const link of links) {
        const [tenant] = await appClient.entities.Tenant.filter({ id: link.tenant_id });
        if (tenant) tenants.push(Object.fromEntries(['id', 'nom_commercial', 'active', 'subscription_plan', 'slug'].map((key) => [key, tenant[key]])));
      }
      return { reseller: { ...access.reseller, permissions: {}, server_actions: [] }, role: access.resellerRole, status: access.status,
        server_actions: [], resellerTenants: links, tenants, commissions: [], payouts: [], invoices: [], pricingRules: [], resellerUsers: [], branding: null };
    }
    const { data, error } = await getSupabaseBrowserClient().rpc('strasyk_get_reseller_portal');
    if (error) throw new Error('RESELLER_CONTEXT_UNAVAILABLE');
    return data;
  },
  executeAction(action, payload) {
    return executeResellerAction({
      readContext: () => this.getPortalContext(),
      invoke: async (actionName, input) => {
        const { data, error } = await getSupabaseBrowserClient().rpc('strasyk_reseller_action', {
          action_name: actionName, payload: input,
        });
        if (error) throw new Error('RESELLER_ACTION_FAILED');
        return data;
      },
    }, action, payload);
  },
  listResellers(query, sort, limit, options) {
    if (query) return appClient.entities.Reseller.filter(query, sort, limit, options);
    return appClient.entities.Reseller.list(sort, limit, options);
  },
  listResellerUsers(query, sort, limit, options) {
    return appClient.entities.ResellerUser.filter(query, sort, limit, options);
  },
};
