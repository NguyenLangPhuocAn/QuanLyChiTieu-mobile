export type ApiCategoryType = 'INCOME' | 'EXPENSE';
export type ApiCategoryCashFlowGroup = 'NORMAL' | 'LOAN_DEBT';

export type Category = {
  id: number;
  name: string;
  type: ApiCategoryType;
  cash_flow_group?: ApiCategoryCashFlowGroup | null;
  icon?: string | null;
  is_system?: boolean | null;
  user_id?: number | null;
};
