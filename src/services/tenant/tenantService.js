import { appClient } from '@/api/appClient';

const entityApi = /** @type {any} */ (appClient.entities);

export const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export const isSafeReadError = (error) => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return error.code === '42P01'
    || error.code === '42501'
    || message.includes('permission denied')
    || message.includes('row-level security')
    || message.includes('not exist');
};

export const safeFilter = async (entityApi, query = {}, sort, limit, options = {}) => {
  try {
    return await entityApi.filter(query, sort, limit, options);
  } catch (error) {
    if (isSafeReadError(error)) return [];
    throw error;
  }
};

export const tenantService = {
  listPlatformAdminAccess(query, sort, limit, options) {
    return safeFilter(entityApi.PlatformAdminAccess, query, sort, limit, options);
  },
  listResellerUsers(query, sort, limit, options) {
    return safeFilter(entityApi.ResellerUser, query, sort, limit, options);
  },
  listResellers(query, sort, limit, options) {
    return safeFilter(entityApi.Reseller, query, sort, limit, options);
  },
  listTenants(query, sort, limit, options) {
    return safeFilter(entityApi.Tenant, query, sort, limit, options);
  },
  getTenantById(id, options) {
    return safeFilter(entityApi.Tenant, { id }, '-created_date', 5, options);
  },
  createUserAccess(payload) {
    return entityApi.UserAccess.create(payload);
  },
  listDeliveryPeople(query, sort, limit, options) {
    return safeFilter(entityApi.DeliveryPerson, query, sort, limit, options);
  },
  listUserAccess(query, sort, limit, options) {
    return safeFilter(entityApi.UserAccess, query, sort, limit, options);
  },
};
