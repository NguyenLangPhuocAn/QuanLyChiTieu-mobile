export type LoanDebtType = 'BORROWED' | 'LENT';
export type LoanDebtStatus = 'OPEN' | 'OVERDUE' | 'PAID';

export type LoanDebtPayment = {
  id: number;
  loan_debt_id: number;
  wallet_id: number;
  transaction_id: number;
  amount: number | string;
  payment_date: string;
  note?: string | null;
  created_at?: string | null;
};

export type LoanDebt = {
  id: number;
  user_id: number;
  person_name: string;
  type: LoanDebtType;
  principal_amount: number;
  settled_amount: number;
  remaining_amount: number;
  currency: string;
  due_date?: string | null;
  note?: string | null;
  opening_wallet_id: number;
  opening_transaction_id: number;
  status: LoanDebtStatus;
  payments: LoanDebtPayment[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateLoanDebtPayload = {
  person_name: string;
  type: LoanDebtType;
  principal_amount: string;
  wallet_id: number;
  due_date?: string | null;
  note?: string;
  transaction_date?: string;
};

export type UpdateLoanDebtPayload = Omit<
  Partial<CreateLoanDebtPayload>,
  'type' | 'transaction_date'
>;

export type CreateLoanDebtPaymentPayload = {
  wallet_id: number;
  amount: string;
  payment_date?: string;
  note?: string;
};
