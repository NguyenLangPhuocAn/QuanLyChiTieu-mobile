import {
  buildMoneyCalendar,
  validateMoneyPlan,
  type MoneyPlan,
} from '../src/utils/moneyCalendar';
import type { BillBook, RecurringBill } from '../src/utils/recurringBills';
import type { Wallet } from '../src/types/wallet';
import type { OfflineTransactionDraft } from '../src/services/offlineTransactionQueue';
const today = '2026-10-30';
const bill: RecurringBill = {
  id: 'rent',
  label: 'Tiền nhà',
  anchorDate: '2026-10-31',
  cycle: 'MONTHLY',
  kind: 'FIXED',
  minAmount: 300000,
  maxAmount: 300000,
  currency: 'VND',
  note: '',
  paused: false,
  archived: false,
};
const wallet = { id: 1, currency: 'VND', balance: 1000000 } as Wallet;
const plan: MoneyPlan = {
  id: 'salary',
  label: 'Lương',
  date: '2026-11-01',
  amount: 5000000,
  type: 'INCOME',
  currency: 'VND',
};
const build = (
  book: BillBook = { version: 1, bills: [bill], periods: [] },
  extra: Partial<Parameters<typeof buildMoneyCalendar>[0]> = {},
) =>
  buildMoneyCalendar({
    today,
    currency: 'VND',
    wallets: [wallet],
    book,
    plans: [],
    drafts: [],
    ...extra,
  });
it('reserves a confirmed bill and floors a 30-day daily limit without adding future income', () => {
  const result = build(undefined, { plans: [plan] });
  expect(result.billCommitment).toBe(300000);
  expect(result.safeDaily).toBe(23333);
  expect(result.days[1]).toMatchObject({
    date: '2026-11-01',
    income: 5000000,
    balance: 5700000,
  });
  expect(result.end).toBe('2026-11-28');
});
it('excludes paid/skipped/paused/archived bills while reserving variable maximums', () => {
  const bills = [
    bill,
    { ...bill, id: 'skip' },
    { ...bill, id: 'pause', paused: true },
    { ...bill, id: 'archive', archived: true },
    {
      ...bill,
      id: 'electric',
      kind: 'VARIABLE' as const,
      minAmount: 100000,
      maxAmount: 200000,
    },
  ];
  const result = build({
    version: 1,
    bills,
    periods: [
      {
        billId: 'rent',
        dueDate: '2026-10-31',
        status: 'PAID',
        payment: {
          id: 5,
          amount: 300000,
          currency: 'VND',
          date: '2026-10-31',
          note: '',
        },
      },
      { billId: 'skip', dueDate: '2026-10-31', status: 'SKIPPED' },
    ],
  });
  expect(result.billCommitment).toBe(200000);
  expect(result.days[0].events).toHaveLength(1);
  expect(result.days[0].events[0].variable).toBe(true);
});
it('holds overdue bills from today and checks expense before same-day expected salary', () => {
  const result = build(
    { version: 1, bills: [{ ...bill, anchorDate: '2026-10-29' }], periods: [] },
    {
      wallets: [{ ...wallet, balance: 100000 }],
      plans: [{ ...plan, date: today }],
    },
  );
  expect(result.days[0].events[0].originalDate).toBe('2026-10-29');
  expect(result.firstRiskDate).toBe(today);
  expect(result.shortfall).toBe(200000);
  expect(result.safeDaily).toBe(0);
});
it('uses signed native currency balances and excludes savings/other currencies', () => {
  const result = build(
    { version: 1, bills: [{ ...bill, currency: 'USD' }], periods: [] },
    {
      wallets: [
        wallet,
        { ...wallet, id: 2, balance: -200000 },
        { ...wallet, id: 3, balance: 9000000, wallet_type: 'SAVINGS' },
        { ...wallet, id: 4, currency: 'USD', balance: 50000 },
      ],
    },
  );
  expect(result.opening).toBe(800000);
  expect(result.billCommitment).toBe(0);
  expect(result.safeDaily).toBe(26666);
});
it('holds pending expenses and manual expenses without counting pending income', () => {
  const drafts = [
    { payload: { wallet_id: 1, type: 'EXPENSE', amount: '50000' } },
    { payload: { wallet_id: 1, type: 'INCOME', amount: '9999999' } },
  ] as OfflineTransactionDraft[];
  const result = build(undefined, {
    drafts,
    plans: [{ ...plan, id: 'fee', type: 'EXPENSE', amount: 100000 }],
  });
  expect(result.pending).toBe(50000);
  expect(result.manualCommitment).toBe(100000);
  expect(result.safeDaily).toBe(18333);
});
it('includes the last horizon day exactly and follows month clamping without drift', () => {
  const result = build(
    { version: 1, bills: [{ ...bill, anchorDate: '2026-01-31' }], periods: [] },
    { today: '2026-02-01' },
  );
  expect(result.days.some(d => d.date === '2026-02-28')).toBe(true);
  expect(result.days.some(d => d.date === '2026-03-31')).toBe(false);
  const day = build(
    { version: 1, bills: [], periods: [] },
    {
      plans: [
        { ...plan, type: 'EXPENSE', date: '2026-11-28' },
        { ...plan, id: 'outside', type: 'EXPENSE', date: '2026-11-29' },
      ],
    },
  );
  expect(day.manualCommitment).toBe(5000000);
});
it('keeps USD cents and rejects invalid, overflowing or non-finite money', () => {
  expect(
    build(undefined, {
      currency: 'USD',
      wallets: [{ ...wallet, currency: 'USD', balance: 100.01 }],
    }).safeDaily,
  ).toBe(3.33);
  expect(() =>
    build(undefined, { wallets: [{ ...wallet, balance: 'broken' }] }),
  ).toThrow();
  expect(() =>
    build(undefined, {
      wallets: [
        { ...wallet, balance: Number.MAX_SAFE_INTEGER },
        { ...wallet, id: 3, balance: 100 },
      ],
    }),
  ).toThrow();
  expect(() => validateMoneyPlan({ ...plan, date: '2026-02-30' })).toThrow();
  expect(() => validateMoneyPlan({ ...plan, amount: 1.5 })).toThrow();
});
