import {
  getTransactionDateKey,
  mapApiTransactions,
} from '../src/utils/mapTransactions';

describe('mapApiTransactions', () => {
  it('keeps the intended GMT+7 date from legacy UTC timestamps', () => {
    expect(getTransactionDateKey('2026-08-10T17:00:00.000Z')).toBe(
      '2026-08-11',
    );
    expect(getTransactionDateKey('2026-08-11')).toBe('2026-08-11');
  });

  it('keeps original transaction currency separate from display currency', () => {
    const [transaction] = mapApiTransactions(
      [
        {
          id: 1,
          wallet_id: 2,
          category_id: 3,
          amount: 10,
          currency: 'USD',
          display_amount: 250000,
          display_currency: 'VND',
          note: 'Coffee',
          receipt_items: [
            { name: 'Coffee', amount: 8 },
            { name: 'Tax', amount: 1 },
          ],
          transaction_date: '2026-05-24T00:00:00.000Z',
          type: 'EXPENSE',
          category: { id: 3, name: 'Food', type: 'EXPENSE' },
        },
      ],
      [
        {
          id: 2,
          user_id: 7,
          name: 'USD wallet',
          currency: 'USD',
          balance: 100,
          display_balance: 2500000,
          display_currency: 'VND',
          created_at: '2026-05-24T00:00:00.000Z',
        },
      ],
    );

    expect(transaction.currency).toBe('USD');
    expect(transaction.amount).toBe(10);
    expect(transaction.displayCurrency).toBe('VND');
    expect(transaction.displayAmount).toBe(250000);
    expect(transaction.receiptItems).toEqual([
      { name: 'Coffee', amount: 8 },
      { name: 'Tax', amount: 1 },
    ]);
  });

  it('removes account plan labels from transaction notes', () => {
    const [transaction] = mapApiTransactions(
      [
        {
          id: 1,
          wallet_id: 2,
          category_id: 3,
          amount: -245000,
          currency: 'VND',
          note: 'Ăn uống cuối tuần - tài khoản BASIC thật',
          transaction_date: '2026-05-24T00:00:00.000Z',
          type: 'EXPENSE',
          category: { id: 3, name: 'Ăn uống', type: 'EXPENSE' },
        },
      ],
      [],
    );

    expect(transaction.note).toBe('Ăn uống cuối tuần');
  });

  it('marks loan and debt transactions separately from normal income and expense', () => {
    const [transaction] = mapApiTransactions(
      [
        {
          id: 2,
          wallet_id: 4,
          category_id: 9,
          amount: -1000000,
          currency: 'VND',
          note: 'Loan repayment',
          transaction_date: '2026-05-24T00:00:00.000Z',
          type: 'EXPENSE',
          category: {
            id: 9,
            name: 'Debt payment',
            type: 'EXPENSE',
            icon: 'categories/icons/expense_debt_payment.png',
          },
        },
      ],
      [],
    );

    expect(transaction.cashFlowType).toBe('loan_debt');
  });
});
