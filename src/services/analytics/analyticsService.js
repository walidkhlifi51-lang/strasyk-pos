import { orderService } from '@/services/orders/orderService';

export const analyticsService = {
  listOrdersForCustomerAnalysis(query, sort, limit, options) {
    return orderService.listOrders(query, sort, limit, options);
  },
};
