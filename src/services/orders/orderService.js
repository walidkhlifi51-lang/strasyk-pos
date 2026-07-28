import { appClient } from '@/api/appClient';

const entityApi = /** @type {any} */ (appClient.entities);

export const orderService = {
  listOrders(query, sort, limit, options) {
    return entityApi.Order.filter(query, sort, limit, options);
  },
  getOrderById(id, options) {
    return entityApi.Order.filter({ id }, null, 1, options);
  },
  createOrder(payload) {
    return entityApi.Order.create(payload);
  },
  updateOrder(id, payload) {
    return entityApi.Order.update(id, payload);
  },
  updateTable(id, payload) {
    return entityApi.Table.update(id, payload);
  },
  getTableById(id, options) {
    return entityApi.Table.filter({ id }, null, 1, options);
  },
};
