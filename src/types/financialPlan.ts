import type { SavingsRoadmap } from './savingsRoadmap';
export type CashflowPlanStatus =
  | 'STABLE'
  | 'WARNING'
  | 'RISK'
  | 'INSUFFICIENT_DATA';

export type SavingsPlanStatus =
  | 'ON_TRACK'
  | 'BEHIND'
  | 'OVERDUE'
  | 'NO_DEADLINE';

export type FinancialPlanOverview = {
  generated_at: string;
  methodology: {
    history_months: number;
    forecast_months: number;
    excludes_internal_transfers: boolean;
    note: string;
  };
  cashflow_plans: Array<{
    currency: string;
    spending_actions?: Array<{
      category_id: number;
      category: string;
      monthly_baseline: number;
      monthly_target: number;
      monthly_reduction: number;
      reduction_percent: number;
      steps: string[];
    }>;
    history: Array<{
      month: string;
      income: number;
      expense: number;
      transaction_count: number;
    }>;
    forecast: Array<{
      month: string;
      projected_income: number;
      projected_expense: number;
      projected_net: number;
    }>;
    summary: {
      history_average_income: number;
      history_average_expense: number;
      forecast_average_income: number;
      forecast_average_expense: number;
      forecast_average_net: number;
      transaction_count: number;
      status: CashflowPlanStatus;
      confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    };
  }>;
  savings_plans: Array<{
    id: number;
    name: string;
    wallet_id: number;
    currency: string;
    target_amount: number;
    current_amount: number;
    remaining_amount: number;
    progress_percent: number;
    suggested_monthly: number;
    roadmap?: SavingsRoadmap;
    target_date?: string | null;
    contributed_this_month: number;
    expected_by_today: number;
    monthly_gap: number;
    status: SavingsPlanStatus;
  }>;
};
