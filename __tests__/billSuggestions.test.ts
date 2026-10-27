import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  billMerchant,
  suggestBills,
  suggestionVisibility,
} from '../src/utils/billSuggestions';
import { recurringBillsService as service } from '../src/services/recurringBills';
import {
  billDueDate,
  billOccurrences,
  validateBillInput,
  isBillDueDate,
  type BillBook,
} from '../src/utils/recurringBills';
import type { ApiTransaction } from '../src/types/transaction';

const today = '2026-10-27';
const scope = { userId: 78, server: 'https://qa.invalid' };
const storageKey = 'recurring-bills:v1:https://qa.invalid:78';
const transactions = (
  dates = ['2026-08-31', '2026-09-30', '2026-10-31'],
  patch: Partial<ApiTransaction> = {},
): ApiTransaction[] =>
  dates.map((date, i) => ({
    id: i + 1,
    wallet_id: i + 1,
    amount: -(100000 + i * 10000),
    currency: 'VND',
    type: 'EXPENSE',
    note: 'Internet QA',
    transaction_date: date,
    ...patch,
  }));
const candidate = () =>
  suggestBills(
    transactions(['2026-07-31', '2026-08-31', '2026-09-30']),
    today,
  )[0];
const empty: BillBook = { version: 1, bills: [], periods: [] };
beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.removeItem(storageKey);
  jest.clearAllMocks();
});

it('requires 3 historical dates; future and two charges cannot establish a bill', () => {
  expect(suggestBills(transactions(), today)).toEqual([]);
  expect(suggestBills(transactions().slice(0, 2), '2026-11-01')).toEqual([]);
});
it('keeps original 31 through short months, excludes old periods, and preserves variable amounts across wallets', () => {
  const item = candidate();
  expect(item.input).toMatchObject({
    anchorDate: '2026-07-31',
    startDate: '2026-10-31',
    kind: 'VARIABLE',
    minAmount: 100000,
    maxAmount: 120000,
  });
  expect(item.evidence.map(row => row.id)).toEqual([1, 2, 3]);
  expect(validateBillInput(item.input)).toEqual(item.input);
  const book = {
    ...empty,
    bills: [{ ...item.input, id: 'test', paused: false, archived: false }],
  };
  expect(
    billOccurrences(book, '2000-01-01', '2026-12-31', today).map(
      row => row.dueDate,
    ),
  ).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
  expect(isBillDueDate(item.input, '2026-08-31')).toBe(false);
});
it('can infer day31 when first observed month is February without changing later months to28', () => {
  const [item] = suggestBills(
    transactions(['2026-02-28', '2026-03-31', '2026-04-30']),
    '2026-05-01',
  );
  expect(item.input.anchorDate).toBe('2026-01-31');
  expect(item.nextDate).toBe('2026-05-31');
});
it('recognizes annual leap-day schedules even when first observation is a non-leap year', () => {
  const [item] = suggestBills(
    transactions(['2023-02-28', '2024-02-29', '2025-02-28']),
    '2025-03-01',
  );
  expect(item.input.cycle).toBe('YEARLY');
  expect(item.input.anchorDate).toBe('2020-02-29');
  expect(item.nextDate).toBe('2026-02-28');
  expect(billDueDate(item.input, 8)).toBe('2028-02-29');
});
it('supports a bounded weekly calendar but rejects daily habits and irregular/missing monthly cycles', () => {
  expect(
    suggestBills(
      transactions(['2026-10-01', '2026-10-08', '2026-10-15']),
      today,
    )[0].nextDate,
  ).toBe('2026-10-29');
  for (const dates of [
    ['2026-10-01', '2026-10-02', '2026-10-03'],
    ['2026-07-10', '2026-08-21', '2026-09-04'],
    ['2026-01-01', '2026-04-01', '2026-07-01'],
  ])
    expect(suggestBills(transactions(dates), today)).toEqual([]);
});
it('does not combine currencies, plans, amounts by bucket or repeated API ids into false evidence', () => {
  const dates = ['2026-07-01', '2026-08-01', '2026-09-01'];
  const vnd = transactions(dates, { amount: -90000, note: 'Netflix gói 1' });
  const usd = transactions(dates, {
    amount: -1.99,
    currency: 'USD',
    note: 'Netflix gói 1',
  }).map(row => ({ ...row, id: row.id + 10 }));
  const plan2 = transactions(dates, {
    amount: -100000,
    note: 'Netflix gói 2',
  }).map(row => ({ ...row, id: row.id + 20 }));
  expect(suggestBills([...vnd, ...usd, ...plan2], today)).toHaveLength(3);
  expect(suggestBills([...vnd.slice(0, 2), vnd[0], vnd[1]], today)).toEqual([]);
});
it('rejects duplicate charges in the same calendar period rather than claiming they are a schedule', () => {
  const rows = transactions(['2026-07-01', '2026-08-01', '2026-09-01']);
  expect(suggestBills([...rows, { ...rows[1], id: 19 }], today)).toEqual([]);
  expect(
    suggestBills(
      [...rows, { ...rows[1], id: 20, transaction_date: '2026-08-15' }],
      today,
    ),
  ).toEqual([]);
});
it('normalizes case, accents, labelled month/reference but retains meaningful package numbers', () => {
  expect(billMerchant('Thanh toán ĐIỆN tháng 09/2026 ref: abc992')).toBe(
    'dien',
  );
  expect(billMerchant('Netflix gói 2')).not.toBe(billMerchant('Netflix gói 1'));
  expect(billMerchant('ACB dịch vụ 1234')).toContain('1234');
});
it('excludes income, loan/savings/transfer/refund categories, generic text and invalid money', () => {
  const rows = transactions(['2026-07-01', '2026-08-01', '2026-09-01']);
  for (const patch of [
    { type: 'INCOME' as const },
    {
      category: {
        id: 2,
        name: 'Vay',
        type: 'EXPENSE' as const,
        cash_flow_group: 'LOAN_DEBT' as const,
      },
    },
    { note: 'Chuyển ví QA' },
    { note: 'Refund QA' },
    { note: 'Chuyển khoản' },
    { amount: -0.5 },
    { amount: Infinity },
  ])
    expect(
      suggestBills(
        rows.map(row => ({ ...row, ...patch })),
        today,
      ),
    ).toEqual([]);
});
it('does not revive stale patterns', () => {
  expect(
    suggestBills(
      transactions(['2025-01-01', '2025-02-01', '2025-03-01']),
      today,
    ),
  ).toEqual([]);
});
it('validates start date as a due date instead of silently shifting the calendar', () => {
  expect(() =>
    validateBillInput({ ...candidate().input, startDate: '2026-10-30' }),
  ).toThrow('chu kỳ');
});
it('persists ignored/deferred choices, expires deferral and restores explicitly', async () => {
  const item = candidate();
  await service.decideSuggestion(scope, item.key, 'LATER', '2026-11-03');
  expect(suggestionVisibility(item, await service.load(scope), today)).toBe(
    'HIDDEN',
  );
  expect(
    suggestionVisibility(item, await service.load(scope), '2026-11-03'),
  ).toBe('VISIBLE');
  await service.decideSuggestion(scope, item.key, 'IGNORED');
  expect(
    suggestionVisibility(item, await service.load(scope), '2027-01-01'),
  ).toBe('HIDDEN');
  await service.restoreSuggestion(scope, item.key);
  expect(suggestionVisibility(item, await service.load(scope), today)).toBe(
    'VISIBLE',
  );
});
it('atomically tracks a suggestion once under concurrent save and preserves native eligibility metadata', async () => {
  const item = candidate();
  await Promise.all([
    service.save(scope, item.input, undefined, item.key),
    service.save(scope, item.input, undefined, item.key),
  ]);
  const book = await service.load(scope);
  expect(book.bills).toHaveLength(1);
  expect(book.periods).toEqual([]);
  expect(book.suggestions).toEqual([
    { key: item.key, status: 'TRACKED', billId: book.bills[0].id },
  ]);
  expect(suggestionVisibility(item, book, today)).toBe('TRACKED');
});
it('keeps decisions separated by backend/account and never overwrites corrupt decision data', async () => {
  const item = candidate();
  await service.decideSuggestion(scope, item.key, 'IGNORED');
  for (const other of [
    { ...scope, userId: 79 },
    { ...scope, server: 'https://another.invalid' },
  ])
    expect((await service.load(other)).suggestions).toBeUndefined();
  const corrupt = JSON.stringify({
    ...empty,
    suggestions: [{ key: item.key, status: 'TRACKED', billId: 'missing' }],
  });
  await AsyncStorage.setItem(storageKey, corrupt);
  await expect(
    service.decideSuggestion(scope, item.key, 'IGNORED'),
  ).rejects.toThrow('Giữ nguyên');
  expect(await AsyncStorage.getItem(storageKey)).toBe(corrupt);
});
it('storage failure cannot save a schedule while losing its decision, and manual matching bills are hidden', async () => {
  const item = candidate();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    service.save(scope, item.input, undefined, item.key),
  ).rejects.toThrow('Disk full');
  expect((await service.load(scope)).bills).toHaveLength(0);
  await service.save(scope, item.input);
  expect(suggestionVisibility(item, await service.load(scope), today)).toBe(
    'TRACKED',
  );
});
