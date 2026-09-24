import { apiRequest } from './api';
import type { SavingsAssistantContext, SavingsGoal } from '../types/savings';

export type SavingsGoalPayload = {
  name: string;
  target_amount: string;
  source_wallet_id?: number;
  initial_amount?: string;
  target_date?: string | null;
  note?: string;
  currency?: string;
};

export const savingsService = {
  getAll(token: string) {
    return apiRequest<SavingsGoal[]>('/savings-goals', {
      method: 'GET',
      token,
    });
  },

  getContext(token: string) {
    return apiRequest<SavingsAssistantContext>('/savings-goals/context', {
      method: 'GET',
      token,
    });
  },

  create(token: string, payload: SavingsGoalPayload) {
    return apiRequest<SavingsGoal>('/savings-goals', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  update(
    token: string,
    id: number,
    payload: Partial<
      Pick<
        SavingsGoalPayload,
        'name' | 'target_amount' | 'target_date' | 'note'
      >
    >,
  ) {
    return apiRequest<SavingsGoal>(`/savings-goals/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  remove(token: string, id: number) {
    return apiRequest<{ message: string }>(`/savings-goals/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  contribute(
    token: string,
    id: number,
    payload: { source_wallet_id: number; amount: string; note?: string },
  ) {
    return apiRequest<SavingsGoal>(`/savings-goals/${id}/contributions`, {
      method: 'POST',
      token,
      body: payload,
    });
  },

  withdraw(
    token: string,
    id: number,
    payload: { destination_wallet_id: number; amount: string; note?: string },
  ) {
    return apiRequest<SavingsGoal>(`/savings-goals/${id}/withdrawals`, {
      method: 'POST',
      token,
      body: payload,
    });
  },
};
