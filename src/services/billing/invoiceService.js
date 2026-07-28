import { appClient } from '@/api/appClient';

export const invoiceService = {
  listTenantInvoices(query, sort, limit, options) {
    if (query) {
      return appClient.entities.TenantInvoice.filter(query, sort, limit, options);
    }
    return appClient.entities.TenantInvoice.list(sort, limit, options);
  },
  createTenantInvoice(payload) {
    return appClient.entities.TenantInvoice.create(payload);
  },
  updateTenantInvoice(id, payload) {
    return appClient.entities.TenantInvoice.update(id, payload);
  },
  deleteTenantInvoice(id) {
    return appClient.entities.TenantInvoice.delete(id);
  },
};
