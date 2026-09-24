import { apiRequest } from './api';
import type { FinancialPlanOverview } from '../types/financialPlan';

export const financialPlansService = {
  getOverview(token: string) {
    return apiRequest<FinancialPlanOverview>('/financial-plans/overview', {
      method: 'GET',
      token,
    });
  },
};
