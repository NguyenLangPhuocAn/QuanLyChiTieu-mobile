import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkBillPayment, paymentKey } from '../src/utils/billPaymentChecks';
import {
  checkPaymentLinks,
  refreshPaymentLink,
} from '../src/services/billPaymentChecks';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { transactionsService } from '../src/services/transactions';
import type { ApiTransaction } from '../src/types/transaction';
import type { BillPaymentTarget } from '../src/utils/billPaymentChecks';

jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getLinkedPayments: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));
const scope = { userId: 28, server: 'https://checks.invalid' };
const storageKey = 'recurring-bills:v1:https://checks.invalid:28';
const transaction: ApiTransaction = {
  id: 12,
  wallet_id: 2,
  amount: -240000,
  currency: 'VND',
  type: 'EXPENSE',
  note: 'Internet',
  transaction_date: '2026-10-28T00:00:00Z',
};
const target: BillPaymentTarget = {
  bill: {
    id: 'internet',
    label: 'Internet',
    cycle: 'MONTHLY',
    anchorDate: '2026-10-31',
    kind: 'FIXED',
    minAmount: 240000,
    maxAmount: 240000,
    currency: 'VND',
    note: '',
    paused: false,
    archived: false,
  },
  period: {
    billId: 'internet',
    dueDate: '2026-10-31',
    status: 'PAID',
    payment: {
      id: 12,
      amount: 240000,
      currency: 'VND',
      date: '2026-10-28',
      note: 'Internet',
    },
  },
};
const response = (ids: number[], data: ApiTransaction[] = [transaction]) => ({
  requestedIds: ids,
  data,
  missingIds: ids.filter(id => !data.some(row => row.id === id)),
});
const seed = async () => {
  await AsyncStorage.removeItem(
    storageKey.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({
      version: 1,
      bills: [target.bill],
      periods: [target.period],
    }),
  );
};
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.removeItem(storageKey);
});
it('distinguishes unchanged, modified, unavailable, and ineligible sources without mutating snapshots', () => {
  expect(checkBillPayment(target, transaction).kind).toBe('MATCHED');
  expect(
    checkBillPayment(target, { ...transaction, amount: -260000 }).kind,
  ).toBe('CHANGED');
  expect(
    checkBillPayment(target, {
      ...transaction,
      note: 'Mới',
      transaction_date: '2026-10-29',
    }).kind,
  ).toBe('CHANGED');
  expect(checkBillPayment(target, undefined)).toEqual({ kind: 'UNAVAILABLE' });
  for (const patch of [
    { type: 'INCOME' },
    { currency: 'USD' },
    { amount: 0 },
    { amount: 'NaN' },
    { amount: 1.5 },
    { transaction_date: 'bad' },
    { transaction_date: '2026-10-28garbage' },
    { transaction_date: '2026-02-30T00:00:00Z' },
    { amount: true },
    { transaction_date: '2026-08-01' },
    { category: { cash_flow_group: 'LOAN_DEBT' } },
    { category: { cash_flow_group: 'SAVING_TRANSFER' } },
    { category: { cash_flow_group: 'UNKNOWN' } },
  ])
    expect(
      checkBillPayment(target, { ...transaction, ...patch } as ApiTransaction)
        .kind,
    ).toBe('INELIGIBLE');
  expect(target.period.payment.amount).toBe(240000);
});
it('uses bounded batches by exact IDs and never scans transaction history', async () => {
  const targets = Array.from({ length: 101 }, (_, i) => ({
    ...target,
    period: {
      ...target.period,
      payment: { ...target.period.payment, id: i + 1 },
    },
  }));
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockImplementation(async (_token, ids) =>
      response(
        ids,
        ids.map(id => ({ ...transaction, id })),
      ),
    );
  const progress = jest.fn();
  expect(
    Object.values(
      await checkPaymentLinks('token', targets, () => true, progress),
    ).every(result => result.kind === 'MATCHED'),
  ).toBe(true);
  expect(
    jest
      .mocked(transactionsService.getLinkedPayments)
      .mock.calls.map(call => call[1].length),
  ).toEqual([100, 1]);
  expect(progress).toHaveBeenLastCalledWith(101, 101);
  expect(transactionsService.update).not.toHaveBeenCalled();
});
it('rejects partial, duplicate, unrelated and incompatible server responses instead of reporting deletion', async () => {
  for (const value of [
    {},
    { requestedIds: [12], data: [], missingIds: [] },
    { requestedIds: [12], data: [transaction], missingIds: [12] },
    { requestedIds: [12], data: [], missingIds: [13] },
    { requestedIds: [13], data: [transaction], missingIds: [] },
  ]) {
    jest
      .mocked(transactionsService.getLinkedPayments)
      .mockResolvedValueOnce(value as never);
    await expect(
      checkPaymentLinks('token', [target], () => true, jest.fn()),
    ).rejects.toThrow('đầy đủ');
  }
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockRejectedValueOnce(new Error('404'));
  await expect(
    checkPaymentLinks('token', [target], () => true, jest.fn()),
  ).rejects.toThrow('404');
});
it('cancellation after an in-flight batch stops the next batch and drops results', async () => {
  let live = true;
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockImplementationOnce(async (_token, ids) => {
      live = false;
      return response(ids, []);
    });
  const targets = Array.from({ length: 101 }, (_, i) => ({
    ...target,
    period: {
      ...target.period,
      payment: { ...target.period.payment, id: i + 1 },
    },
  }));
  await expect(
    checkPaymentLinks('token', targets, () => live, jest.fn()),
  ).rejects.toThrow('Đã dừng');
  expect(transactionsService.getLinkedPayments).toHaveBeenCalledTimes(1);
});
it('refreshes only the saved payment snapshot, keeping reservations, schedules and transaction data untouched', async () => {
  await seed();
  const current = { ...transaction, amount: -260000, note: 'Đã chỉnh' };
  const shown = { ...target.period.payment, amount: 260000, note: 'Đã chỉnh' };
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response([12], [current]));
  await refreshPaymentLink(scope, 'token', target, shown, () => true);
  const book = await service.load(scope);
  expect(book.bills).toEqual([target.bill]);
  expect(book.periods).toEqual([{ ...target.period, payment: shown }]);
  expect(paymentKey(target.period.payment)).not.toBe(paymentKey(shown));
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect(transactionsService.remove).not.toHaveBeenCalled();
});
it('refetches before committing and rejects changed/deleted/ineligible sources or cancelled confirmation', async () => {
  await seed();
  for (const rows of [
    [],
    [{ ...transaction, amount: -270000 }],
    [{ ...transaction, currency: 'USD' }],
  ]) {
    jest
      .mocked(transactionsService.getLinkedPayments)
      .mockResolvedValueOnce(response([12], rows));
    await expect(
      refreshPaymentLink(
        scope,
        'token',
        target,
        { ...target.period.payment, amount: 260000 },
        () => true,
      ),
    ).rejects.toThrow('vừa thay đổi');
    expect((await service.load(scope)).periods).toEqual([target.period]);
  }
  await expect(
    refreshPaymentLink(
      scope,
      'token',
      target,
      target.period.payment,
      () => false,
    ),
  ).rejects.toThrow('Đã dừng');
});
it('serializes updates with reopen and detects obsolete snapshots; storage failure preserves history', async () => {
  await seed();
  await service.reopen(
    scope,
    target.bill.id,
    target.period.dueDate,
    target.period.payment,
  );
  await expect(
    service.refreshPayment(scope, target, transaction, () => true),
  ).rejects.toThrow('vừa thay đổi');
  await seed();
  await service.refreshPayment(
    scope,
    target,
    { ...transaction, amount: -260000 },
    () => true,
  );
  await expect(
    service.reopen(
      scope,
      target.bill.id,
      target.period.dueDate,
      target.period.payment,
    ),
  ).rejects.toThrow('vừa thay đổi');
  await seed();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    service.refreshPayment(
      scope,
      target,
      { ...transaction, amount: -260000 },
      () => true,
    ),
  ).rejects.toThrow('Disk full');
  expect((await service.load(scope)).periods).toEqual([target.period]);
  await expect(
    service.refreshPayment(scope, target, transaction, () => false),
  ).rejects.toThrow('Đã dừng');
});
