import { apiRequest } from './api';
import type {
  Budget,
  BudgetPeriod,
  BudgetRenewalResult,
  BudgetScope,
  PaginatedBudgets,
  PaginatedBudgetTransactions,
} from '../types/budget';
import type { BudgetPeriodFilter } from '../utils/budgetFilters';

export type BudgetPayload = {
  name: string;
  scope: BudgetScope;
  wallet_id: number;
  category_id?: number | null;
  limit_amount: string;
  period: BudgetPeriod;
  start_date: string;
  end_date: string;
};

export type BudgetPageQuery = {
  page: number;
  limit: number;
  q?: string;
  period_filter?: BudgetPeriodFilter;
  custom_start_date?: string;
  custom_end_date?: string;
  current_date?: string;
  wallet_id?: number;
  scope?: BudgetScope;
};

const buildQuery = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  });
  const value = params.toString();
  return value ? `?${value}` : '';
};

export const budgetsService = {
  getAll(token: string, walletId?: number) {
    const query = walletId ? `?wallet_id=${walletId}` : '';

    return apiRequest<Budget[]>(`/budgets${query}`, {
      method: 'GET',
      token,
    });
  },

  getPage(token: string, query: BudgetPageQuery) {
    return apiRequest<PaginatedBudgets>(
      `/budgets${buildQuery(
        query as unknown as Record<string, string | number | undefined>,
      )}`,
      { method: 'GET', token },
    );
  },

  getOne(token: string, id: number) {
    return apiRequest<Budget>(`/budgets/${id}`, { method: 'GET', token });
  },

  getTransactions(token: string, id: number, page: number, limit: number) {
    return apiRequest<PaginatedBudgetTransactions>(
      `/budgets/${id}/transactions${buildQuery({ page, limit })}`,
      { method: 'GET', token },
    );
  },

  create(token: string, payload: BudgetPayload) {
    return apiRequest<Budget>('/budgets', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  update(token: string, id: number, payload: Partial<BudgetPayload>) {
    return apiRequest<Budget>(`/budgets/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  remove(token: string, id: number) {
    return apiRequest<Budget>(`/budgets/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  createNextPeriod(token: string, id: number) {
    return apiRequest<BudgetRenewalResult>(`/budgets/${id}/next-period`, {
      method: 'POST',
      token,
    });
  },
};
