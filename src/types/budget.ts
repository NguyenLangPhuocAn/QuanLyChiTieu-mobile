export type BudgetPeriod =
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR'
  | 'CUSTOM';
export type BudgetScope = 'WALLET' | 'CATEGORY';
export type BudgetStatus = 'NORMAL' | 'WARNING' | 'EXCEEDED';

export type BudgetForecast = {
  total_days: number;
  elapsed_days: number;
  days_remaining: number;
  daily_average: number;
  projected_spent: number;
  recommended_daily: number;
};

export type BudgetTransaction = {
  id: number;
  wallet_id: number;
  wallet_name: string;
  category_id?: number | null;
  category_name?: string | null;
  category_icon?: string | null;
  amount: number;
  currency: string;
  note?: string | null;
  transaction_date: string;
  created_at?: string | null;
  type: 'EXPENSE';
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedBudgets = { data: Budget[]; meta: PaginationMeta };
export type PaginatedBudgetTransactions = {
  data: BudgetTransaction[];
  meta: PaginationMeta;
};

export type BudgetRenewalResult = {
  creation_state: 'created' | 'existing';
  budget: Budget;
};

export type Budget = {
  id: number;
  user_id: number;
  name: string;
  scope: BudgetScope;
  wallet_id: number;
  wallet_name: string;
  wallet_currency: string;
  category_id?: number | null;
  category_name?: string | null;
  limit_amount: number;
  original_limit_amount?: number;
  carry_over_overspent?: number;
  available_limit_amount?: number;
  effective_remaining?: number;
  effective_percent?: number;
  amount?: number;
  period: BudgetPeriod;
  start_date: string;
  end_date: string;
  created_at?: string | null;
  updated_at?: string | null;
  spent: number;
  remaining: number;
  percent: number;
  percentage: number;
  status: BudgetStatus;
  warning?: {
    code: string;
    message: string;
    wallet_limit?: number;
    category_total?: number;
  } | null;
  forecast?: BudgetForecast;
};
