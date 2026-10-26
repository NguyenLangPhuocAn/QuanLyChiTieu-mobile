import AsyncStorage from '@react-native-async-storage/async-storage';
import { recurringBillsService as service } from '../src/services/recurringBills';
import {
  billDueDate,
  billOccurrences,
  isBillDueDate,
  validateBillInput,
  type BillInput,
} from '../src/utils/recurringBills';
import type { ApiTransaction } from '../src/types/transaction';

const scope = { userId: 56, server: 'https://test.invalid' };
const key = 'recurring-bills:v1:https://test.invalid:56';
const input: BillInput = {
  label: 'Tiền điện',
  cycle: 'MONTHLY',
  anchorDate: '2026-01-31',
  kind: 'FIXED',
  minAmount: 100000,
  maxAmount: 100000,
  currency: 'VND',
  note: '',
};
const payment: ApiTransaction = {
  id: 10,
  wallet_id: 1,
  amount: 100000,
  currency: 'VND',
  type: 'EXPENSE',
  transaction_date: '2026-02-28T16:00:00Z',
  note: 'Điện tháng 2',
};
const create = async (patch: Partial<BillInput> = {}) => {
  await service.save(scope, { ...input, ...patch });
  return (await service.load(scope)).bills.at(-1)!;
};
beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.removeItem(key);
  jest.clearAllMocks();
});

describe('bill recurrence calendar', () => {
  it('clamps 31 to February without drifting in March', () => {
    expect([0, 1, 2, 3].map(index => billDueDate(input, index))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(isBillDueDate(input, '2026-03-28')).toBe(false);
    expect(isBillDueDate(input, '2026-02-28')).toBe(true);
  });
  it('restores February 29 for leap years on yearly schedules', () => {
    const bill = { anchorDate: '2024-02-29', cycle: 'YEARLY' as const };
    expect([0, 1, 4].map(index => billDueDate(bill, index))).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2028-02-29',
    ]);
  });
  it('weekly schedules cross month and year boundaries using calendar dates', () => {
    expect(billDueDate({ anchorDate: '2026-12-28', cycle: 'WEEKLY' }, 1)).toBe(
      '2027-01-04',
    );
    expect(
      isBillDueDate(
        { ...input, anchorDate: '2026-12-28', cycle: 'WEEKLY' },
        '2027-01-05',
      ),
    ).toBe(false);
  });
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', 'invalid'])(
    'rejects invalid civil date %s',
    anchorDate => {
      expect(() => validateBillInput({ ...input, anchorDate })).toThrow();
    },
  );
  it.each([
    { minAmount: 0 },
    { minAmount: NaN },
    { minAmount: 1, maxAmount: 2 },
    { kind: 'VARIABLE', minAmount: 3, maxAmount: 2 },
    { minAmount: 1.1, maxAmount: 1.1 },
    { currency: 'USDD' },
    { label: '  ' },
    { currency: 'USD', minAmount: 1.001, maxAmount: 1.001 },
  ])('rejects invalid bill input %j', patch => {
    expect(() =>
      validateBillInput({ ...input, ...patch } as BillInput),
    ).toThrow();
  });
});

describe('account-scoped bill storage and settlements', () => {
  it('serializes concurrent creation without losing schedules and rejects normalized duplicates', async () => {
    await Promise.all([
      service.save(scope, input),
      service.save(scope, { ...input, label: 'Tiền nhà' }),
    ]);
    expect((await service.load(scope)).bills).toHaveLength(2);
    await expect(
      service.save(scope, { ...input, label: ' TIEN   DIEN ' }),
    ).rejects.toThrow('Đã có lịch');
    expect((await service.load(scope)).bills).toHaveLength(2);
  });
  it('separates account and backend namespaces', async () => {
    await create();
    expect((await service.load({ ...scope, userId: 57 })).bills).toEqual([]);
    expect(
      (await service.load({ ...scope, server: 'https://other.invalid' })).bills,
    ).toEqual([]);
  });
  it('links idempotently once and never changes any transaction or wallet', async () => {
    const bill = await create();
    await Promise.all([
      service.linkPayment(scope, bill.id, '2026-02-28', payment),
      service.linkPayment(scope, bill.id, '2026-02-28', payment),
    ]);
    const book = await service.load(scope);
    expect(book.periods).toHaveLength(1);
    expect(book.periods[0]).toMatchObject({
      status: 'PAID',
      payment: { id: 10, date: '2026-02-28', amount: 100000 },
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, expect.any(String));
    expect(book.bills[0]).toEqual(bill);
  });
  it('rejects the same transaction in different periods even when submissions race', async () => {
    const bill = await create();
    const result = await Promise.allSettled([
      service.linkPayment(scope, bill.id, '2026-02-28', payment),
      service.linkPayment(scope, bill.id, '2026-03-31', payment),
    ]);
    expect(result.map(item => item.status)).toEqual(['fulfilled', 'rejected']);
    expect((await service.load(scope)).periods).toHaveLength(1);
  });
  it('keeps transaction reservations when archiving and allows explicit reopen without deleting money', async () => {
    const bill = await create();
    await service.linkPayment(scope, bill.id, '2026-02-28', payment);
    await service.reopen(scope, bill.id, '2026-02-28');
    expect((await service.load(scope)).periods).toHaveLength(0);
    await service.linkPayment(scope, bill.id, '2026-02-28', payment);
    await service.archive(scope, bill.id);
    const other = await create({ label: 'Internet' });
    await expect(
      service.linkPayment(scope, other.id, '2026-02-28', payment),
    ).rejects.toThrow('đã được dùng');
    const history = billOccurrences(
      await service.load(scope),
      '2026-01-01',
      '2026-03-31',
      '2026-02-28',
    );
    expect(history.filter(item => item.bill.id === bill.id)).toMatchObject([
      { status: 'PAID', bill: { archived: true } },
    ]);
    await service.reopen(scope, bill.id, '2026-02-28');
    await service.linkPayment(scope, other.id, '2026-02-28', payment);
  });
  it('skips exactly one period; pause hides unresolved periods and resume preserves original dates', async () => {
    const bill = await create();
    await service.skip(scope, bill.id, '2026-02-28');
    await service.skip(scope, bill.id, '2026-02-28');
    await service.setPaused(scope, bill.id, true);
    let rows = billOccurrences(
      await service.load(scope),
      '2026-01-01',
      '2026-04-30',
      '2026-03-01',
    );
    expect(rows.map(row => row.status)).toEqual(['SKIPPED']);
    await expect(
      service.linkPayment(scope, bill.id, '2026-03-31', payment),
    ).rejects.toThrow('không hoạt động');
    await service.setPaused(scope, bill.id, false);
    rows = billOccurrences(
      await service.load(scope),
      '2026-01-01',
      '2026-04-30',
      '2026-03-01',
    );
    expect(rows.map(row => [row.dueDate, row.status])).toEqual([
      ['2026-01-31', 'OVERDUE'],
      ['2026-02-28', 'SKIPPED'],
      ['2026-03-31', 'PENDING'],
      ['2026-04-30', 'PENDING'],
    ]);
  });
  it('does not let skip overwrite a paid period or change its anchor/currency', async () => {
    const bill = await create();
    await service.linkPayment(scope, bill.id, '2026-02-28', payment);
    await expect(service.skip(scope, bill.id, '2026-02-28')).rejects.toThrow(
      'đã liên kết',
    );
    await expect(
      service.save(scope, { ...input, anchorDate: '2026-01-30' }, bill.id),
    ).rejects.toThrow('tạo lịch mới');
    await service.save(scope, { ...input, label: 'Điện căn hộ' }, bill.id);
    expect((await service.load(scope)).periods).toHaveLength(1);
  });
  it.each([
    { type: 'INCOME' },
    { currency: 'USD' },
    { amount: 0 },
    { id: -1 },
    {
      category: {
        id: 1,
        name: 'Vay nợ',
        type: 'EXPENSE',
        cash_flow_group: 'LOAN_DEBT',
      },
    },
    { category: { id: 1, name: 'Tiết kiệm', type: 'EXPENSE' } },
  ])('rejects invalid or non-normal payment %j', async patch => {
    const bill = await create();
    await expect(
      service.linkPayment(scope, bill.id, '2026-02-28', {
        ...payment,
        ...patch,
      } as ApiTransaction),
    ).rejects.toThrow('giao dịch chi');
    expect((await service.load(scope)).periods).toEqual([]);
  });
  it('variable schedules retain actual payment separately from expected range', async () => {
    const bill = await create({
      kind: 'VARIABLE',
      minAmount: 50000,
      maxAmount: 90000,
    });
    await service.linkPayment(scope, bill.id, '2026-02-28', payment);
    const rows = billOccurrences(
      await service.load(scope),
      '2026-02-28',
      '2026-02-28',
      '2026-02-28',
    );
    expect(rows[0]).toMatchObject({
      status: 'PAID',
      bill: { maxAmount: 90000 },
      payment: { amount: 100000 },
    });
  });
  it('preserves corrupted storage instead of resetting it on save', async () => {
    await AsyncStorage.setItem(key, '{broken');
    await expect(service.load(scope)).rejects.toThrow('Giữ nguyên dữ liệu');
    await expect(service.save(scope, input)).rejects.toThrow(
      'Giữ nguyên dữ liệu',
    );
    expect(await AsyncStorage.getItem(key)).toBe('{broken');
  });
  it('a failed write keeps the old book and does not poison the next mutation', async () => {
    const bill = await create();
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error('Disk full'));
    await expect(service.skip(scope, bill.id, '2026-02-28')).rejects.toThrow(
      'Disk full',
    );
    expect((await service.load(scope)).periods).toEqual([]);
    await service.skip(scope, bill.id, '2026-02-28');
    expect((await service.load(scope)).periods).toHaveLength(1);
  });
});
