import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  analyzeBillActivity,
  billActivitySlot,
  readBillAlertKey,
  upcomingBillSummary,
} from '../src/utils/billActivity';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { billReminderPayload } from '../src/native/billReminder';
import type { ApiTransaction } from '../src/types/transaction';
import type { BillBook, RecurringBill } from '../src/utils/recurringBills';

const today = '2026-10-28';
const bill: RecurringBill = {
  id: 'internet',
  label: 'Internet QA',
  cycle: 'MONTHLY',
  anchorDate: today,
  kind: 'FIXED',
  minAmount: 100000,
  maxAmount: 100000,
  currency: 'VND',
  note: '',
  paused: false,
  archived: false,
};
const book: BillBook = { version: 1, bills: [bill], periods: [] };
const rows: ApiTransaction[] = [
  '2026-07-28',
  '2026-08-28',
  '2026-09-28',
  today,
].map((date, i) => ({
  id: i + 1,
  wallet_id: i + 1,
  amount: i === 3 ? -130000 : -100000,
  currency: 'VND',
  type: 'EXPENSE',
  note: 'Internet QA',
  transaction_date: date,
}));
const scope = { userId: 188, server: 'https://activity.invalid' };
const storageKey = 'recurring-bills:v1:https://activity.invalid:188';
const analyze = (source = rows, data = book) =>
  analyzeBillActivity(data, source, today).alerts;
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.removeItem(storageKey);
});

it('uses calendar slots before tracking, preserving day31, leap day, weekly rhythm and tolerances', () => {
  const month31 = { ...bill, anchorDate: '2026-10-31' };
  expect(billActivitySlot(month31, '2026-02-28')).toBe('2026-02-28');
  expect(billActivitySlot(month31, '2026-03-31')).toBe('2026-03-31');
  expect(billActivitySlot(month31, '2026-04-29')).toBe('2026-04-30');
  expect(
    billActivitySlot({ ...bill, anchorDate: '2026-10-01' }, '2026-09-29'),
  ).toBe('2026-10-01');
  expect(billActivitySlot(month31, '2026-04-20')).toBeNull();
  const leap = { ...bill, cycle: 'YEARLY' as const, anchorDate: '2024-02-29' };
  expect(billActivitySlot(leap, '2023-02-28')).toBe('2023-02-28');
  expect(billActivitySlot(leap, '2028-02-29')).toBe('2028-02-29');
  const weekly = { ...bill, cycle: 'WEEKLY' as const };
  expect(billActivitySlot(weekly, '2026-10-20')).toBe('2026-10-21');
  expect(billActivitySlot(weekly, '2026-10-18')).toBeNull();
});
it('shows exact evidence and delta using three stable consecutive prior periods and the expected maximum', () => {
  const original = JSON.stringify(book);
  expect(analyze()).toMatchObject([
    {
      kind: 'INCREASE',
      dueDate: today,
      baseline: 100000,
      increase: 30000,
      percent: 30,
      evidence: rows.map(row => ({
        id: row.id,
        date: row.transaction_date,
        amount: Math.abs(Number(row.amount)),
        note: row.note,
      })),
    },
  ]);
  expect(readBillAlertKey(analyze()[0].key)?.[2]).toBe('internet');
  expect(JSON.stringify(book)).toBe(original);
  expect(
    analyze(
      rows.map(row => (row.id === 4 ? { ...row, amount: -110000 } : row)),
    ),
  ).toHaveLength(1);
  expect(
    analyze(
      rows.map(row => (row.id === 4 ? { ...row, amount: -109999 } : row)),
    ),
  ).toEqual([]);
  expect(
    analyze(rows, {
      ...book,
      bills: [{ ...bill, minAmount: 130000, maxAmount: 130000 }],
    }),
  ).toEqual([]);
});
it('suppresses variable amounts within the chosen range and unstable, sparse, future or stale price patterns', () => {
  expect(
    analyze(rows, {
      ...book,
      bills: [{ ...bill, kind: 'VARIABLE', maxAmount: 150000 }],
    }),
  ).toEqual([]);
  expect(
    analyze(rows, {
      ...book,
      bills: [{ ...bill, kind: 'VARIABLE', maxAmount: 120000 }],
    }),
  ).toHaveLength(1);
  expect(
    analyze(rows.map(row => (row.id === 1 ? { ...row, amount: -70000 } : row))),
  ).toEqual([]);
  expect(analyze(rows.slice(1))).toEqual([]);
  expect(
    analyze(
      rows.map(row =>
        row.id === 2 ? { ...row, transaction_date: '2026-06-28' } : row,
      ),
    ),
  ).toEqual([]);
  expect(
    analyze(
      rows.map(row =>
        row.id === 4 ? { ...row, transaction_date: '2026-11-28' } : row,
      ),
    ),
  ).toEqual([]);
  expect(analyzeBillActivity(book, rows, '2027-04-01').alerts).toEqual([]);
});
it('uses integer currency units for decimal thresholds and does not combine currencies or package names', () => {
  const dollarBill = {
    ...bill,
    currency: 'USD',
    minAmount: 1.01,
    maxAmount: 1.01,
  };
  const dollars = rows.map(row => ({
    ...row,
    currency: 'USD',
    amount: row.id === 4 ? -1.12 : -1.01,
  }));
  expect(analyze(dollars, { ...book, bills: [dollarBill] })[0]).toMatchObject({
    kind: 'INCREASE',
    baseline: 1.01,
    increase: 0.11,
  });
  expect(
    analyze(
      dollars.map(row => (row.id === 4 ? { ...row, amount: -1.11 } : row)),
      { ...book, bills: [dollarBill] },
    ),
  ).toEqual([]);
  expect(
    analyze(
      rows.map(row => (row.id === 4 ? { ...row, currency: 'USD' } : row)),
    ),
  ).toEqual([]);
  expect(
    analyze(
      rows.map(row =>
        row.id === 4 ? { ...row, note: 'Internet QA gói 2' } : row,
      ),
    ),
  ).toEqual([]);
});
it('flags distinct equal-amount payments in the same cycle within three days, without calling them proven duplicates', () => {
  const source = [
    rows[3],
    { ...rows[3], id: 5, transaction_date: '2026-10-27' },
  ];
  expect(analyze(source)).toMatchObject([
    { kind: 'DUPLICATE', evidence: [{ id: 5 }, { id: 4 }] },
  ]);
  expect(analyze([rows[3], rows[3]])).toEqual([]);
  expect(analyze([rows[3], { ...rows[3], id: 5, amount: -140000 }])).toEqual(
    [],
  );
  const far = [
    { ...rows[3], transaction_date: '2026-10-25' },
    { ...rows[3], id: 5, transaction_date: '2026-10-31' },
  ];
  expect(
    analyzeBillActivity(
      { ...book, bills: [{ ...bill, anchorDate: '2026-10-28' }] },
      far,
      '2026-10-31',
    ).alerts,
  ).toEqual([]);
});
it('does not use duplicated API IDs, invalid dates/money, refunds, transfers, savings or loans as evidence', () => {
  expect(analyze([...rows, rows[0]])).toEqual([]);
  for (const patch of [
    { transaction_date: '2026-10-28garbage' },
    { transaction_date: '2026-02-30T00:00:00Z' },
    { amount: true },
    { amount: 0 },
    { amount: 1.5 },
    { type: 'INCOME' },
    { note: 'Hoàn tiền Internet QA' },
    { note: 'Chuyển ví Internet QA' },
    { category: { cash_flow_group: 'SAVING_TRANSFER' } },
    { category: { cash_flow_group: 'LOAN_DEBT' } },
  ]) {
    expect(
      analyze(
        rows.map(row =>
          row.id === 4 ? ({ ...row, ...patch } as ApiTransaction) : row,
        ),
      ),
    ).toEqual([]);
  }
});
it('fails closed on ambiguous names even with an archived/paused matching schedule', () => {
  for (const patch of [{}, { paused: true }, { archived: true }]) {
    const data = { ...book, bills: [bill, { ...bill, id: 'other', ...patch }] };
    expect(analyze(rows, data)).toEqual([]);
    expect(analyzeBillActivity(data, rows, today).ambiguousNames).toBe(1);
  }
  expect(
    analyze(rows, { ...book, bills: [{ ...bill, paused: true }] }),
  ).toEqual([]);
});
it('uses explicit current payment references for ambiguous/custom notes, never stale snapshots or another bill references', () => {
  const active = { ...bill, anchorDate: '2026-07-28' };
  const data: BillBook = {
    ...book,
    bills: [active, { ...active, id: 'other' }],
    periods: rows.map(row => ({
      billId: bill.id,
      dueDate: row.transaction_date,
      status: 'PAID',
      payment: {
        id: row.id,
        date: row.transaction_date,
        amount: 1,
        currency: 'VND',
        note: 'Old snapshot',
      },
    })),
  };
  expect(
    analyze(
      rows.map(row => ({ ...row, note: 'Đã thanh toán' })),
      data,
    ),
  ).toMatchObject([{ kind: 'INCREASE', baseline: 100000, increase: 30000 }]);
  expect(
    analyze(
      rows.map(row => (row.id === 4 ? { ...row, amount: -100000 } : row)),
      data,
    ),
  ).toEqual([]);
  expect(
    analyze(
      rows.map(row => ({ ...row, note: 'Hoàn tiền' })),
      data,
    ),
  ).toEqual([]);
  expect(
    analyze(rows, {
      ...data,
      bills: [active, { ...active, id: 'other', archived: true }],
      periods: data.periods.map(p => ({ ...p, billId: 'other' })),
    }),
  ).toEqual([]);
});
it('retains original service identity after renaming a tracked suggestion and changes review keys with source money/dates', () => {
  const renamed = {
    ...book,
    bills: [{ ...bill, label: 'Mạng ở nhà' }],
    suggestions: [
      {
        key: 'bill-suggest:v1:VND:MONTHLY:internet qa',
        status: 'TRACKED' as const,
        billId: bill.id,
      },
    ],
  };
  const first = analyze(rows, renamed)[0];
  expect(first.kind).toBe('INCREASE');
  const next = analyze(
    rows.map(row => (row.id === 4 ? { ...row, amount: -140000 } : row)),
    renamed,
  )[0];
  expect(next.key).not.toBe(first.key);
  expect(readBillAlertKey(first.key)?.[7]).toBe('internet qa');
});
it('saves/restores review choices atomically and idempotently, isolated by account/server, without changing native payload or money', async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(book));
  const alert = analyze()[0];
  await Promise.all([
    service.reviewAlert(scope, alert.key, true, () => true),
    service.reviewAlert(scope, alert.key, true, () => true),
  ]);
  const saved = await service.load(scope);
  expect(saved.reviewedAlerts).toEqual([alert.key]);
  expect(saved.bills).toEqual(book.bills);
  expect(saved.periods).toEqual([]);
  expect(billReminderPayload(saved)).toBe(billReminderPayload(book));
  expect(
    (await service.load({ ...scope, userId: 189 })).reviewedAlerts,
  ).toBeUndefined();
  expect(
    (await service.load({ ...scope, server: 'https://other.invalid' }))
      .reviewedAlerts,
  ).toBeUndefined();
  await service.reviewAlert(scope, alert.key, false, () => true);
  expect((await service.load(scope)).reviewedAlerts).toEqual([]);
});
it('rejects obsolete decisions, cancelled queue work and storage failures, preserving existing data', async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(book));
  const key = analyze()[0].key;
  await expect(
    service.reviewAlert(scope, key, true, () => false),
  ).rejects.toThrow('Đã dừng');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    service.reviewAlert(scope, key, true, () => true),
  ).rejects.toThrow('Disk full');
  expect((await service.load(scope)).reviewedAlerts).toBeUndefined();
  await service.save(
    scope,
    { ...bill, minAmount: 110000, maxAmount: 110000 },
    bill.id,
  );
  await expect(
    service.reviewAlert(scope, key, true, () => true),
  ).rejects.toThrow('Lịch vừa thay đổi');
});
it('replaces old evidence versions of an event, prunes expired choices and refuses corrupt keys without overwriting the book', async () => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(book));
  for (let amount = 130000; amount <= 150000; amount += 1000) {
    const alert = analyze(
      rows.map(row => (row.id === 4 ? { ...row, amount: -amount } : row)),
    )[0];
    await service.reviewAlert(scope, alert.key, true, () => true);
  }
  expect((await service.load(scope)).reviewedAlerts).toHaveLength(1);
  const past = JSON.parse(analyze()[0].key);
  past[5] = '2020-01-28';
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ ...book, reviewedAlerts: [JSON.stringify(past)] }),
  );
  await service.reviewAlert(scope, analyze()[0].key, true, () => true);
  expect((await service.load(scope)).reviewedAlerts).toEqual([
    analyze()[0].key,
  ]);
  expect(readBillAlertKey('[]')).toBeNull();
  expect(readBillAlertKey('{}')).toBeNull();
  const broken = JSON.stringify({ ...book, reviewedAlerts: ['broken'] });
  await AsyncStorage.setItem(storageKey, broken);
  await expect(service.load(scope)).rejects.toThrow('Giữ nguyên dữ liệu');
  await expect(
    service.reviewAlert(scope, analyze()[0].key, true, () => true),
  ).rejects.toThrow();
  expect(await AsyncStorage.getItem(storageKey)).toBe(broken);
});
it('sums actual upcoming calendar periods by currency, skips handled/paused/archived and honors start dates', () => {
  const data: BillBook = {
    version: 1,
    bills: [
      bill,
      { ...bill, id: 'week', cycle: 'WEEKLY', startDate: '2026-11-25' },
      {
        ...bill,
        id: 'usd',
        currency: 'USD',
        kind: 'VARIABLE',
        minAmount: 1.1,
        maxAmount: 2.2,
      },
      { ...bill, id: 'paused', paused: true },
      { ...bill, id: 'archived', archived: true },
    ],
    periods: [{ billId: bill.id, dueDate: today, status: 'SKIPPED' }],
  };
  expect(upcomingBillSummary(data, today)).toEqual({
    end: '2026-11-26',
    totals: [
      { currency: 'USD', min: 1.1, max: 2.2, periods: 1, bills: 1 },
      { currency: 'VND', min: 100000, max: 100000, periods: 1, bills: 1 },
    ],
  });
});
it('keeps fractional sums exact and reports overflow rather than rounding an unsafe total', () => {
  const weekly = {
    ...bill,
    cycle: 'WEEKLY' as const,
    currency: 'USD',
    minAmount: 0.1,
    maxAmount: 0.1,
  };
  expect(
    upcomingBillSummary({ ...book, bills: [weekly] }, today).totals[0],
  ).toMatchObject({ min: 0.5, max: 0.5, periods: 5 });
  const huge = Array.from({ length: 3 }, (_, i) => ({
    ...weekly,
    id: `huge${i}`,
    minAmount: 9999999999999.99,
    maxAmount: 9999999999999.99,
  }));
  expect(
    upcomingBillSummary({ ...book, bills: huge }, today).totals[0],
  ).toMatchObject({ min: null, max: null, periods: 15 });
});
