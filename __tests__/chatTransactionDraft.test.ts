import { resolveChatDraftSelections } from '../src/utils/chatTransactionDraft';
import type { ChatTransactionDraft } from '../src/types/chatbot';

const draft: ChatTransactionDraft = {
  type: 'EXPENSE',
  amount: 30000,
  currency: 'VND',
  note: 'Ăn sáng',
  transaction_date: null,
  category_name: null,
  wallet_name: null,
};
const wallets = [
  { id: 1, name: 'Tiền mặt', currency: 'VND', wallet_type: 'CASH' },
  { id: 2, name: 'Đô la', currency: 'USD', wallet_type: 'BANK' },
  { id: 3, name: 'Tiết kiệm', currency: 'VND', wallet_type: 'SAVINGS' },
];
const categories = [
  { id: 4, name: 'Ăn uống', type: 'EXPENSE' },
  { id: 5, name: 'Lương', type: 'INCOME' },
];

it('requires selection when names are missing instead of using the first wallet/category', () => {
  expect(resolveChatDraftSelections(draft, wallets, categories)).toEqual({
    walletId: null,
    categoryId: null,
  });
});
it('matches names and preserves the requested currency and income/expense type', () => {
  expect(
    resolveChatDraftSelections(
      { ...draft, wallet_name: 'Tiền mặt', category_name: 'Ăn uống' },
      wallets,
      categories,
    ),
  ).toEqual({ walletId: 1, categoryId: 4 });
  expect(
    resolveChatDraftSelections(
      { ...draft, wallet_name: 'Đô la', category_name: 'Lương' },
      wallets,
      categories,
    ),
  ).toEqual({ walletId: null, categoryId: null });
});
it('rejects savings wallets and ambiguous names', () => {
  expect(
    resolveChatDraftSelections(
      { ...draft, wallet_name: 'Tiết kiệm' },
      wallets,
      categories,
    ).walletId,
  ).toBeNull();
  expect(
    resolveChatDraftSelections(
      { ...draft, wallet_name: 'Tiền mặt' },
      [...wallets, { ...wallets[0], id: 8 }],
      categories,
    ).walletId,
  ).toBeNull();
});
