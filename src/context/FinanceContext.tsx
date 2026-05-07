import React, { createContext, useContext, useMemo, useState } from 'react';
import type { TransactionItem } from '../data/mockTransactions';
import type { Category } from '../types/category';

type PreferredCurrency = 'VND' | 'USD' | 'EUR' | 'JPY';

type FinanceContextValue = {
  preferredCurrency: PreferredCurrency;
  setPreferredCurrency: (currency: PreferredCurrency) => void;
  transactions: TransactionItem[];
  setTransactions: (transactions: TransactionItem[]) => void;
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  selectedTransactionCategory: Category | null;
  setSelectedTransactionCategory: (category: Category | null) => void;
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

export const FinanceProvider = ({ children }: React.PropsWithChildren) => {
  const [preferredCurrency, setPreferredCurrency] = useState<PreferredCurrency>('VND');
  // Danh sách giao dịch được nạp từ API tại MainScreen và chia sẻ cho các tab con.
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  // Danh mục được dùng chung cho màn chọn danh mục và form thêm giao dịch.
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTransactionCategory, setSelectedTransactionCategory] = useState<Category | null>(null);

  const value = useMemo(
    () => ({
      preferredCurrency,
      setPreferredCurrency,
      transactions,
      setTransactions,
      categories,
      setCategories,
      selectedTransactionCategory,
      setSelectedTransactionCategory,
    }),
    [categories, preferredCurrency, selectedTransactionCategory, transactions],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = () => {
  const context = useContext(FinanceContext);

  if (!context) {
    throw new Error('useFinance must be used within FinanceProvider');
  }

  return context;
};
