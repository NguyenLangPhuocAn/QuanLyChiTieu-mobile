export type PaymentOrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentOrder = {
  id: number;
  order_code: string;
  provider: 'VNPAY';
  plan_code: string;
  amount: number;
  currency: 'VND';
  status: PaymentOrderStatus;
  payment_url?: string | null;
  vnp_transaction_no?: string | null;
  vnp_bank_code?: string | null;
  vnp_response_code?: string | null;
  expires_at: string;
  paid_at?: string | null;
  created_at?: string | null;
};

export type PremiumPlan = {
  code: 'PREMIUM_LIFETIME';
  name: string;
  amount: number;
  currency: 'VND';
  provider: 'VNPAY';
  environment: 'SANDBOX' | 'PRODUCTION';
};
