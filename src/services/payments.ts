import { apiRequest } from './api';
import type { PaymentOrder, PremiumPlan } from '../types/payment';

export const paymentsService = {
  getPremiumPlan(token: string) {
    return apiRequest<PremiumPlan>('/payments/plans/premium', {
      method: 'GET',
      token,
    });
  },

  createVnpayOrder(token: string, locale: 'vn' | 'en' = 'vn') {
    return apiRequest<PaymentOrder>('/payments/vnpay/orders', {
      method: 'POST',
      token,
      body: { locale },
    });
  },

  getOrder(token: string, orderCode: string) {
    return apiRequest<PaymentOrder>(
      `/payments/orders/${encodeURIComponent(orderCode)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  listOrders(token: string) {
    return apiRequest<PaymentOrder[]>('/payments/orders', {
      method: 'GET',
      token,
    });
  },
};
