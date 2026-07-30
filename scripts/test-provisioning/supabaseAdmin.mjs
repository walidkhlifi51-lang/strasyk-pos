import { createClient } from '@supabase/supabase-js';
import { ProvisioningError } from './errors.mjs';

export const createSupabaseAdminClient = (config) => {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new ProvisioningError('Supabase admin client cannot be created without URL and service role key.', {
      code: 'INVALID_ADMIN_CLIENT_CONFIG',
    });
  }

  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-strasyk-provisioning-mode': config.mode,
      },
    },
  });
};

export const countAuthUsers = async (supabaseAdmin) => {
  let page = 1;
  const perPage = 200;
  let total = 0;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new ProvisioningError('Unable to count Supabase Auth users.', {
        code: 'AUTH_USER_COUNT_FAILED',
        details: {
          message: error.message,
        },
        cause: error,
      });
    }

    const users = data?.users || [];
    total += users.length;
    if (users.length < perPage) break;
    page += 1;
  }

  return total;
};

export const fetchPostgrestOpenApi = async (config, fetchImpl = fetch) => {
  const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ProvisioningError('Unable to fetch Supabase PostgREST OpenAPI schema.', {
      code: 'OPENAPI_FETCH_FAILED',
      details: {
        status: response.status,
        body,
      },
    });
  }

  return await response.json();
};
