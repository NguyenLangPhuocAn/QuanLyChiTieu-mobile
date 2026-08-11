import React, { createContext, useContext, useMemo, useState } from 'react';
import type { TransactionItem } from '../data/mockTransactions';
import type { Category } from '../types/category';
import type { TagItem } from '../types/tag';
import type { Budget } from '../types/budget';

type PreferredCurrency = string;

type FinanceContextValue = {
  preferredCurrency: PreferredCurrency;
  setPreferredCurrency: (currency: PreferredCurrency) => void;
  transactions: TransactionItem[];
  setTransactions: (transactions: TransactionItem[]) => void;
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  tags: TagItem[];
  setTags: (tags: TagItem[]) => void;
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  selectedTransactionCategory: Category | null;
  setSelectedTransactionCategory: (category: Category | null) => void;
  selectedBudgetCategory: Category | null;
  setSelectedBudgetCategory: (category: Category | null) => void;
};

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

export const FinanceProvider = ({ children }: React.PropsWithChildren) => {
  const [preferredCurrency, setPreferredCurrency] = useState<PreferredCurrency>('VND');
  // Danh sách giao dịch được nạp từ API tại MainScreen và chia sẻ cho các tab con.
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  // Danh mục được dùng chung cho màn chọn danh mục và form thêm giao dịch.
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedTransactionCategory, setSelectedTransactionCategory] = useState<Category | null>(null);
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<Category | null>(null);

  const value = useMemo(
    () => ({
      preferredCurrency,
      setPreferredCurrency,
      transactions,
      setTransactions,
      categories,
      setCategories,
      tags,
      setTags,
      budgets,
      setBudgets,
      selectedTransactionCategory,
      setSelectedTransactionCategory,
      selectedBudgetCategory,
      setSelectedBudgetCategory,
    }),
    [budgets, categories, preferredCurrency, selectedBudgetCategory, selectedTransactionCategory, tags, transactions],
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
