import {
  filterNormalCashFlowCategories,
  getCashFlowType,
  isLoanDebtCategory,
} from '../src/utils/transactionClassification';

describe('transaction cash-flow classification', () => {
  it('classifies loan and debt icons separately from normal cash flow', () => {
    expect(
      getCashFlowType({
        name: 'Borrowed cash',
        icon: 'categories/icons/expense_loan.png',
      }),
    ).toBe('loan_debt');
    expect(
      getCashFlowType({
        name: 'Debt repayment',
        icon: 'categories/icons/expense_debt_payment.png',
      }),
    ).toBe('loan_debt');
  });

  it('classifies Vietnamese loan and debt names separately from normal cash flow', () => {
    expect(isLoanDebtCategory({ name: 'Vay tien', icon: null })).toBe(true);
    expect(isLoanDebtCategory({ name: 'Tra no', icon: null })).toBe(true);
    expect(isLoanDebtCategory({ name: 'Thu no', icon: null })).toBe(true);
  });

  it('keeps ordinary income and expense categories as normal cash flow', () => {
    expect(getCashFlowType({ name: 'Salary', icon: 'categories/icons/income_salary.png' })).toBe('normal');
    expect(getCashFlowType({ name: 'Food', icon: 'categories/icons/expense_food.png' })).toBe('normal');
  });

  it('uses category cash_flow_group before falling back to name or icon guesses', () => {
    expect(
      getCashFlowType({
        name: 'Food',
        icon: 'categories/icons/expense_food.png',
        cash_flow_group: 'LOAN_DEBT',
      }),
    ).toBe('loan_debt');
    expect(
      getCashFlowType({
        name: 'Debt-looking normal category',
        icon: 'categories/icons/expense_debt_payment.png',
        cash_flow_group: 'NORMAL',
      }),
    ).toBe('normal');
  });

  it('filters loan and debt categories out of normal transaction category lists', () => {
    const categories = [
      { id: 1, name: 'An uong', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
      { id: 2, name: 'Tra no', type: 'EXPENSE', cash_flow_group: 'LOAN_DEBT' },
      { id: 3, name: 'Thu hoi no', type: 'INCOME', cash_flow_group: 'LOAN_DEBT' },
      { id: 4, name: 'Luong', type: 'INCOME', cash_flow_group: 'NORMAL' },
    ];

    expect(filterNormalCashFlowCategories(categories)).toEqual([
      categories[0],
      categories[3],
    ]);
  });
});
