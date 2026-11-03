import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  payRecurringBill,
  billPaymentRequestId,
} from '../src/services/payRecurringBill';
import { recurringBillsService } from '../src/services/recurringBills';
import {
  transactionsService,
  type CreateTransactionPayload,
} from '../src/services/transactions';
import type { ApiTransaction } from '../src/types/transaction';
import type { Category } from '../src/types/category';
import { billOccurrences, type BillInput } from '../src/utils/recurringBills';

jest.mock('../src/services/transactions', () => ({
  transactionsService: { create: jest.fn() },
}));

const scope = { userId: 801, server: 'https://bill-payment.test' };
const storageKey = `planning-local:v1:${scope.server}:${scope.userId}`;
const bill: BillInput = {
  label: 'FPT Internet',
  anchorDate: '2026-11-30',
  cycle: 'MONTHLY',
  kind: 'FIXED',
  minAmount: 300000,
  maxAmount: 300000,
  currency: 'VND',
  note: '',
};
const category = {
  id: 7,
  name: 'Hóa đơn',
  type: 'EXPENSE',
  cash_flow_group: 'NORMAL',
} satisfies Category;
const payload: CreateTransactionPayload = {
  wallet_id: 2,
  category_id: 7,
  amount: '300000',
  type: 'EXPENSE',
  note: 'FPT Internet',
  transaction_date: '2026-11-03',
};
const transaction = {
  id: 912,
  wallet_id: 2,
  category_id: 7,
  amount: 300000,
  currency: 'VND',
  type: 'EXPENSE',
  transaction_date: '2026-11-03',
  note: 'FPT Internet',
  category,
} as ApiTransaction;

beforeEach(async () => {
  await AsyncStorage.removeItem(storageKey);
  jest.clearAllMocks();
  jest.mocked(transactionsService.create).mockResolvedValue(transaction);
});

const occurrence = async () => {
  await recurringBillsService.save(scope, bill);
  return billOccurrences(
    await recurringBillsService.load(scope),
    '2026-11-01',
    '2026-12-01',
    '2026-11-03',
  )[0];
};

const pay = (item: Awaited<ReturnType<typeof occurrence>>, overrides = {}) =>
  payRecurringBill({
    scope,
    token: 'qa-token',
    occurrence: item,
    payload,
    category,
    onCreated: jest.fn(),
    isCurrent: () => true,
    ...overrides,
  });

it('creates one ordinary expense then links the intended bill period', async () => {
  const item = await occurrence();
  await pay(item);
  expect(transactionsService.create).toHaveBeenCalledWith('qa-token', {
    ...payload,
    client_request_id: billPaymentRequestId(
      scope.userId,
      item.bill.id,
      item.dueDate,
    ),
  });
  expect(
    billPaymentRequestId(scope.userId, item.bill.id, item.dueDate),
  ).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  expect((await recurringBillsService.load(scope)).periods).toMatchObject([
    {
      billId: item.bill.id,
      dueDate: item.dueDate,
      status: 'PAID',
      payment: { id: 912 },
    },
  ]);
  await expect(pay(item)).rejects.toThrow('đã được xử lý');
  expect(transactionsService.create).toHaveBeenCalledTimes(1);
});

it('does not write money for a skipped or changed bill period', async () => {
  const item = await occurrence();
  await recurringBillsService.skip(scope, item.bill.id, item.dueDate);
  await expect(pay(item)).rejects.toThrow('đã được xử lý');
  await AsyncStorage.removeItem(storageKey);
  await recurringBillsService.save(scope, {
    ...bill,
    anchorDate: '2026-12-30',
  });
  await expect(pay(item)).rejects.toThrow('đã thay đổi');
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('rejects a changed bill category before creating a transaction', async () => {
  const item = await occurrence();
  await recurringBillsService.save(
    scope,
    { ...bill, categoryId: 7 },
    item.bill.id,
  );
  await expect(pay(item)).rejects.toThrow('đã thay đổi');
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('uses the same transaction after a local link failure instead of creating another', async () => {
  const item = await occurrence();
  const link = jest.spyOn(recurringBillsService, 'linkPayment');
  link.mockRejectedValueOnce(new Error('storage unavailable'));
  const onCreated = jest.fn();
  await expect(pay(item, { onCreated })).rejects.toThrow('storage unavailable');
  expect(onCreated).toHaveBeenCalledWith(transaction);
  expect((await recurringBillsService.load(scope)).periods).toEqual([]);
  await pay(item, { created: transaction });
  expect(transactionsService.create).toHaveBeenCalledTimes(1);
  expect((await recurringBillsService.load(scope)).periods).toHaveLength(1);
  link.mockRestore();
});

it('rejects a non-expense category before calling the transaction API', async () => {
  const item = await occurrence();
  await expect(
    pay(item, { category: { ...category, type: 'INCOME' } }),
  ).rejects.toThrow('danh mục chi');
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('links an uncategorized expense when BASIC has no categories', async () => {
  const item = await occurrence();
  jest.mocked(transactionsService.create).mockResolvedValue({
    ...transaction,
    category: null,
  });
  await pay(item, {
    category: undefined,
    payload: { ...payload, category_id: undefined },
  });
  expect((await recurringBillsService.load(scope)).periods).toMatchObject([
    { status: 'PAID', payment: { id: 912 } },
  ]);
});
