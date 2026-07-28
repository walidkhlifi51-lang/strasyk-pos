import { appClient } from '@/api/appClient';

export const resellerService = {
  listResellers(query, sort, limit, options) {
    if (query) return appClient.entities.Reseller.filter(query, sort, limit, options);
    return appClient.entities.Reseller.list(sort, limit, options);
  },
  listResellerUsers(query, sort, limit, options) {
    return appClient.entities.ResellerUser.filter(query, sort, limit, options);
  },
};
