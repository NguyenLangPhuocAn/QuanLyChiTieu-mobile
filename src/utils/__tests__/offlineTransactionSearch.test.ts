import type { ApiTransaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { searchCachedTransactions } from '../offlineTransactionSearch';

const categories = [
  { id: 1, name: 'Ăn uống', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
  { id: 2, name: 'Lương', type: 'INCOME', cash_flow_group: 'NORMAL' },
  { id: 3, name: 'Vay', type: 'INCOME', cash_flow_group: 'LOAN_DEBT' },
] as Category[];
const rows = [
  {
    id: 1,
    wallet_id: 10,
    category_id: 1,
    amount: '-79000',
    currency: 'VND',
    note: 'Cà phê sáng',
    tags: ['ăn uống'],
    transaction_date: '2026-11-16',
    type: 'EXPENSE',
  },
  {
    id: 2,
    wallet_id: 11,
    category_id: 2,
    amount: '1000000',
    currency: 'VND',
    note: 'Lương tháng 11',
    tags: ['công việc'],
    transaction_date: '2026-11-15',
    type: 'INCOME',
  },
  {
    id: 3,
    wallet_id: 10,
    category_id: 3,
    amount: '250000',
    currency: 'VND',
    note: 'Vay bạn',
    tags: [],
    transaction_date: '2026-11-14',
    type: 'INCOME',
  },
] as ApiTransaction[];

it('filters cached records by date, wallet, category, type, amount and Vietnamese note', () => {
  expect(
    searchCachedTransactions(rows, categories, {
      wallet_id: 10,
      category_id: 1,
      type: 'EXPENSE',
      cash_flow: 'normal',
      from: '2026-11-16',
      to: '2026-11-16',
      min_amount: 79000,
      max_amount: 79000,
      q: 'ca phe',
      tag: 'an uong',
    }).map(row => row.id),
  ).toEqual([1]);
});

it('keeps loan transactions out of normal cash flow and honors a second note keyword', () => {
  expect(
    searchCachedTransactions(rows, categories, {
      type: 'INCOME',
      cash_flow: 'normal',
      q: 'luong',
      note: 'thang 11',
    }).map(row => row.id),
  ).toEqual([2]);
  expect(
    searchCachedTransactions(rows, categories, {
      cash_flow: 'loan_debt',
    }).map(row => row.id),
  ).toEqual([3]);
});

it('sorts only the cached rows and never invents server results', () => {
  expect(searchCachedTransactions(rows, categories, {}).map(row => row.id)).toEqual([
    1, 2, 3,
  ]);
  expect(searchCachedTransactions(rows, categories, { q: 'không có' })).toEqual([]);
});
