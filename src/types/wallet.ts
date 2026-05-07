export type Wallet = {
  id: number;
  user_id: number | null;
  name: string;
  balance: string | number;
  budget_limit?: string | number | null;
  created_at: string;
};
