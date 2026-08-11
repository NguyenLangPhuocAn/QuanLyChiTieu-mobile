import { apiRequest } from './api';
import type {
  CreateLoanDebtPayload,
  CreateLoanDebtPaymentPayload,
  LoanDebt,
  LoanDebtStatus,
  LoanDebtType,
  UpdateLoanDebtPayload,
} from '../types/loanDebt';

const buildQuery = (filter?: {
  type?: LoanDebtType;
  status?: LoanDebtStatus;
}) => {
  const params = new URLSearchParams();
  if (filter?.type) params.set('type', filter.type);
  if (filter?.status) params.set('status', filter.status);
  return params.toString() ? `?${params.toString()}` : '';
};

export const loanDebtsService = {
  getAll(
    token: string,
    filter?: { type?: LoanDebtType; status?: LoanDebtStatus },
  ) {
    return apiRequest<LoanDebt[]>(`/loan-debts${buildQuery(filter)}`, {
      method: 'GET',
      token,
    });
  },
  getOne(token: string, id: number) {
    return apiRequest<LoanDebt>(`/loan-debts/${id}`, {
      method: 'GET',
      token,
    });
  },
  create(token: string, payload: CreateLoanDebtPayload) {
    return apiRequest<LoanDebt>('/loan-debts', {
      method: 'POST',
      token,
      body: payload,
    });
  },
  update(token: string, id: number, payload: UpdateLoanDebtPayload) {
    return apiRequest<LoanDebt>(`/loan-debts/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },
  remove(token: string, id: number) {
    return apiRequest<{ id: number; deleted: boolean }>(`/loan-debts/${id}`, {
      method: 'DELETE',
      token,
    });
  },
  addPayment(
    token: string,
    id: number,
    payload: CreateLoanDebtPaymentPayload,
  ) {
    return apiRequest<LoanDebt>(`/loan-debts/${id}/payments`, {
      method: 'POST',
      token,
      body: payload,
    });
  },
  removePayment(token: string, id: number, paymentId: number) {
    return apiRequest<LoanDebt>(`/loan-debts/${id}/payments/${paymentId}`, {
      method: 'DELETE',
      token,
    });
  },
};
