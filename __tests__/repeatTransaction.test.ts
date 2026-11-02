import {
  canRepeatTransaction,
  repeatTransactionDraft,
} from '../src/utils/repeatTransaction';
import type { TransactionItem } from '../src/data/mockTransactions';
import type { Wallet } from '../src/types/wallet';
import type { Category } from '../src/types/category';
const source: TransactionItem = {
  id: '99',
  walletId: 1,
  categoryId: 4,
  wallet: 'QA',
  category: 'Ăn uống',
  currency: 'VND',
  amount: -79000,
  displayAmount: -3,
  displayCurrency: 'USD',
  type: 'expense',
  cashFlowType: 'normal',
  note: 'Cà phê',
  date: '2020-01-01',
  receiptImage: '/old.jpg',
  tags: ['ăn uống', 'ăn uống'],
  receiptItems: [{ name: 'Bạc xỉu (2)', amount: 94000 }],
};
const scope = { userId: 7, server: 'http://qa' };
const wallets = [{ id: 1, wallet_type: 'CASH', currency: 'VND' }] as Wallet[];
const categories: Category[] = [
  { id: 4, name: 'Ăn uống', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
];
const request = {
  ...scope,
  requestId: 'new-event',
  transaction: source,
  includeItems: false,
};
it('uses original currency/amount with an explicit allow-list, not converted display money or old metadata', () => {
  const draft = repeatTransactionDraft(request, scope, wallets, categories);
  expect(draft).toMatchObject({
    type: 'EXPENSE',
    amount: '79000',
    currency: 'VND',
    walletId: 1,
    note: 'Cà phê',
    tags: '#ăn uống',
    receiptItems: [],
  });
  for (const key of [
    'id',
    'date',
    'receiptImage',
    'source',
    'source_ref',
    'client_request_id',
  ])
    expect(draft).not.toHaveProperty(key);
});
it('only copies item details on request, as independent editable values', () => {
  const draft = repeatTransactionDraft(
    { ...request, includeItems: true },
    scope,
    wallets,
    categories,
  );
  expect(draft.receiptItems).toEqual([
    { name: 'Bạc xỉu (2)', amount: '94000' },
  ]);
  draft.receiptItems[0].name = 'Đã sửa';
  expect(source.receiptItems![0].name).toBe('Bạc xỉu (2)');
});
it.each(['loan_debt', 'saving_transfer'] as const)(
  'does not turn %s into regular income or expense',
  cashFlowType => {
    expect(canRepeatTransaction({ ...source, cashFlowType })).toBe(false);
    expect(() =>
      repeatTransactionDraft(
        { ...request, transaction: { ...source, cashFlowType } },
        scope,
        wallets,
        categories,
      ),
    ).toThrow();
  },
);
it('clears unavailable or mismatched wallets and categories without choosing a different default', () => {
  const draft = repeatTransactionDraft(
    request,
    scope,
    [{ ...wallets[0], currency: 'USD' }],
    [{ ...categories[0], type: 'INCOME' }],
  );
  expect(draft.walletId).toBeNull();
  expect(draft.category).toBeNull();
  expect(
    repeatTransactionDraft(
      request,
      scope,
      [{ ...wallets[0], wallet_type: 'SAVINGS' }],
      categories,
    ).walletId,
  ).toBeNull();
});
it('rejects another account/backend and invalid amounts', () => {
  for (const other of [
    { ...scope, userId: 8 },
    { ...scope, server: 'http://other' },
  ])
    expect(() =>
      repeatTransactionDraft(request, other, wallets, categories),
    ).toThrow();
  for (const amount of [0, NaN, Infinity])
    expect(canRepeatTransaction({ ...source, amount })).toBe(false);
});
