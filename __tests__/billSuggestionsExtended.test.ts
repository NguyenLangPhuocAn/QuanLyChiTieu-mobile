import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  suggestBills,
  suggestionVisibility,
  billSuggestionNotes,
  equivalentSuggestionKeys,
} from '../src/utils/billSuggestions';
import {
  billDueDate,
  billOccurrences,
  isBillDueDate,
  validateBillInput,
  type BillBook,
} from '../src/utils/recurringBills';
import {
  parseBillBook,
  recurringBillsService,
} from '../src/services/recurringBills';
import {
  billActivitySlot,
  analyzeBillActivity,
} from '../src/utils/billActivity';
import { billMerchantIdentity } from '../src/utils/billMerchantIdentity';
import type { ApiTransaction } from '../src/types/transaction';
const rows = (dates: string[], names: string[] = []) =>
  dates.map(
    (date, i): ApiTransaction => ({
      id: i + 1,
      wallet_id: 1,
      amount: -300000,
      type: 'EXPENSE',
      currency: 'VND',
      transaction_date: date,
      note: names[i] ?? 'Internet FPT',
    }),
  );
const dates = ['2026-01-31', '2026-04-30', '2026-10-31'];
const names = [
  'Internet FPT',
  'Cước FPT Telecom Internet',
  'Thanh toán FPT Internet',
];
const candidate = () => suggestBills(rows(dates, names), '2026-11-02')[0];
const scope = { userId: 167, server: 'https://extended-bills.invalid' };
const empty: BillBook = { version: 1, bills: [], periods: [] };
beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.removeItem(
    'planning-local:v1:' + scope.server + ':' + scope.userId,
  );
  await AsyncStorage.removeItem(
    'recurring-bills:v1:' + scope.server + ':' + scope.userId,
  );
});
it('recognizes a quarterly calendar with a missing quarter and original names as evidence', () => {
  const item = candidate();
  expect(item.input).toMatchObject({
    cycle: 'QUARTERLY',
    anchorDate: '2026-01-31',
    startDate: '2027-01-31',
  });
  expect(item.nextDate).toBe('2027-01-31');
  expect(item.missingDates).toEqual(['2026-07-31']);
  expect(item.nameVariants).toHaveLength(3);
  expect(item.evidence.map(e => e.note)).toEqual(names);
  expect(billSuggestionNotes(item).join(' ')).toContain(
    'Không đồng nghĩa chưa thanh toán',
  );
});
it('supports complete quarterly evidence without treating it as sparse monthly bills', () => {
  const item = suggestBills(
    rows(['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31']),
    '2026-11-02',
  )[0];
  expect(item.input.cycle).toBe('QUARTERLY');
  expect(item.missingDates).toEqual([]);
});
it('retains the original monthly day across one missing month and a short first month', () => {
  const item = suggestBills(
    rows(['2026-09-30', '2026-10-31', '2026-12-31']),
    '2027-01-02',
  )[0];
  expect(item.input.cycle).toBe('MONTHLY');
  expect(item.nextDate).toBe('2027-01-31');
  expect(item.missingDates).toEqual(['2026-11-30']);
});
it('supports a missing weekly slot without shifting future dates', () => {
  const item = suggestBills(
    rows(['2026-10-01', '2026-10-08', '2026-10-22']),
    '2026-10-23',
  )[0];
  expect(item.input.cycle).toBe('WEEKLY');
  expect(item.missingDates).toEqual(['2026-10-15']);
  expect(item.nextDate).toBe('2026-10-29');
});
it('explains already elapsed slots after the latest observed transaction', () => {
  const item = suggestBills(
    rows(['2026-01-31', '2026-04-30', '2026-07-31']),
    '2026-11-02',
  )[0];
  expect(item.missingDates).toEqual(['2026-10-31']);
  expect(item.nextDate).toBe('2027-01-31');
});
it.each([
  ['2026-01-31', '2026-07-31', '2027-01-31'],
  ['2026-01-01', '2026-03-01', '2026-05-01'],
  ['2026-01-01', '2026-05-12', '2026-09-21'],
])('rejects sparse or irregular evidence %j', (...sampleDates: string[]) => {
  expect(suggestBills(rows(sampleDates), '2027-02-01')).toEqual([]);
});
it('requires at least three dates and rejects conflicting charges in a period', () => {
  expect(suggestBills(rows(dates.slice(0, 2)), '2026-11-02')).toEqual([]);
  const data = rows(dates, names);
  expect(suggestBills([...data, { ...data[1], id: 99 }], '2026-11-02')).toEqual(
    [],
  );
});
it('never combines packages, arbitrary similar names or different currencies', () => {
  expect(billMerchantIdentity('netflix goi 1')).not.toBe(
    billMerchantIdentity('netflix goi 2'),
  );
  expect(billMerchantIdentity('hoa lan')).not.toBe(
    billMerchantIdentity('lan hoa'),
  );
  expect(
    suggestBills(
      rows(dates, ['FPT Internet goi 1', 'FPT Internet goi 2', 'FPT Play']),
      '2026-11-02',
    ),
  ).toEqual([]);
  const data = rows(dates, names);
  data[1].currency = 'USD';
  expect(suggestBills(data, '2026-11-02')).toEqual([]);
  expect(
    suggestBills(
      rows(dates, [
        'Cước chuyển khoản',
        'Cước chuyển khoản',
        'Cước chuyển khoản',
      ]),
      '2026-11-02',
    ),
  ).toEqual([]);
});
it('rejects stale quarterly history', () => {
  expect(
    suggestBills(
      rows(['2026-01-31', '2026-04-30', '2026-07-31']),
      '2027-03-01',
    ),
  ).toEqual([]);
});
it('preserves old ignore/track decisions across equivalent reordered names and restores them', async () => {
  const item = suggestBills(
    rows(['2026-07-31', '2026-08-31', '2026-10-31'], names),
    '2026-11-02',
  )[0];
  const old = 'bill-suggest:v1:VND:MONTHLY:internet fpt';
  expect(equivalentSuggestionKeys(old, item.key)).toBe(true);
  await recurringBillsService.decideSuggestion(scope, old, 'IGNORED');
  expect(
    suggestionVisibility(
      item,
      await recurringBillsService.load(scope),
      '2026-11-02',
    ),
  ).toBe('HIDDEN');
  await recurringBillsService.restoreSuggestion(scope, item.key);
  expect(
    suggestionVisibility(
      item,
      await recurringBillsService.load(scope),
      '2026-11-02',
    ),
  ).toBe('VISIBLE');
  await Promise.all([
    recurringBillsService.save(scope, item.input, undefined, item.key),
    recurringBillsService.save(scope, item.input, undefined, old),
  ]);
  const book = await recurringBillsService.load(scope);
  expect(book.bills).toHaveLength(1);
  expect(book.periods).toEqual([]);
});
it('round-trips quarterly data and validates due dates, including leap days and native-compatible tracking', () => {
  const input = validateBillInput(candidate().input);
  const bill = { ...input, id: 'quarter', paused: false, archived: false };
  const book = { ...empty, bills: [bill] };
  expect(parseBillBook(JSON.stringify(book))).toEqual(book);
  expect(isBillDueDate(input, '2027-01-31')).toBe(true);
  expect(isBillDueDate(input, '2027-02-28')).toBe(false);
  expect(
    billOccurrences(book, '2026-01-01', '2027-04-30', '2026-11-02').map(
      o => o.dueDate,
    ),
  ).toEqual(['2027-01-31', '2027-04-30']);
  const leap = { cycle: 'QUARTERLY' as const, anchorDate: '2024-02-29' };
  expect(billDueDate(leap, 4)).toBe('2025-02-28');
  expect(billDueDate(leap, 16)).toBe('2028-02-29');
});
it('analyzes increases only on quarterly slots and matches equivalent source labels', () => {
  const data = rows(
    ['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31'],
    [...names, names[1]],
  );
  data[3].amount = -390000;
  const bill = {
    ...candidate().input,
    id: 'quarter',
    paused: false,
    archived: false,
  };
  expect(billActivitySlot(bill, '2026-10-30')).toBe('2026-10-31');
  expect(billActivitySlot(bill, '2026-09-30')).toBeNull();
  const alerts = analyzeBillActivity(
    { ...empty, bills: [bill] },
    data,
    '2026-11-02',
  ).alerts;
  expect(alerts).toHaveLength(1);
  expect(alerts[0].kind).toBe('INCREASE');
});
