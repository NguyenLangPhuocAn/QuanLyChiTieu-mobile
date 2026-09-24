import type { SavingsRoadmap } from './savingsRoadmap';
export type SavingsGoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SavingsEntryType = 'CONTRIBUTION' | 'WITHDRAWAL' | 'ADJUSTMENT';

export type SavingsGoalEntry = {
  id: number;
  transfer_id?: number | null;
  type: SavingsEntryType;
  amount: number;
  entry_date: string;
  note?: string | null;
  created_at?: string | null;
};

export type SavingsGoal = {
  id: number;
  user_id: number;
  wallet_id: number;
  wallet_name?: string | null;
  wallet_currency: string;
  wallet_balance: number;
  name: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  progress_percent: number;
  suggested_monthly: number;
  roadmap?: SavingsRoadmap;
  target_date?: string | null;
  note?: string | null;
  status: SavingsGoalStatus;
  created_at?: string | null;
  updated_at?: string | null;
  entries: SavingsGoalEntry[];
};

export type SavingsAssistantContext = {
  active_goal_count: number;
  completed_goal_count: number;
  currency_summaries: Array<{
    currency: string;
    target_amount: number;
    saved_amount: number;
    remaining_amount: number;
    suggested_monthly: number;
  }>;
  goals: Array<{
    id: number;
    name: string;
    progress_percent: number;
    remaining_amount: number;
    suggested_monthly: number;
    target_date?: string | null;
    currency: string;
  }>;
};
