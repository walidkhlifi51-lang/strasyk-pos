import { appClient } from '@/api/appClient';

const entityApi = /** @type {any} */ (appClient.entities);

export const customerService = {
  listCustomers(query, sort, limit, options) {
    return entityApi.Customer.filter(query, sort, limit, options);
  },
  getCustomerById(id, options) {
    return entityApi.Customer.filter({ id }, null, 1, options);
  },
  createCustomer(payload) {
    return entityApi.Customer.create(payload);
  },
  updateCustomer(id, payload) {
    return entityApi.Customer.update(id, payload);
  },
  deleteCustomer(id) {
    return entityApi.Customer.delete(id);
  },
};
