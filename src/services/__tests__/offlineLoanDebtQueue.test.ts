import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineLoanDebtQueue } from '../offlineLoanDebtQueue';
import { loanDebtsService } from '../loanDebts';
import type { LoanDebt } from '../../types/loanDebt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../loanDebts', () => ({
  loanDebtsService: { getAll: jest.fn(), update: jest.fn() },
}));
const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const record = (override: Partial<LoanDebt> = {}): LoanDebt => ({
  id: 5,
  user_id: 7,
  person_name: 'Anh Minh',
  type: 'BORROWED',
  principal_amount: 500000,
  settled_amount: 100000,
  remaining_amount: 400000,
  currency: 'VND',
  due_date: null,
  note: null,
  opening_wallet_id: 2,
  opening_transaction_id: 21,
  status: 'OPEN',
  payments: [],
  ...override,
});
const payload = {
  person_name: 'Chị Lan',
  due_date: '2026-12-10',
  note: 'Trả theo tháng',
};
beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
  setItem.mockImplementation(async (key: string, value: string) => {
    storage.set(key, value);
  });
});

it('keeps the original copy across edits on the phone', async () => {
  await offlineLoanDebtQueue.update(7, record(), payload);
  const projected = offlineLoanDebtQueue.apply(
    [record()],
    await offlineLoanDebtQueue.list(7),
  )[0];
  await offlineLoanDebtQueue.update(7, projected, {
    ...payload,
    note: 'Trả cuối tháng',
  });
  const [change] = await offlineLoanDebtQueue.list(7);
  expect(change.base.person_name).toBe('Anh Minh');
  expect(change.base.settled_amount).toBe('100000.00');
  expect(change.payload.note).toBe('Trả cuối tháng');
});

it('updates the visible due date and overdue filter from the local edit', async () => {
  await offlineLoanDebtQueue.update(
    7,
    record({ due_date: '2026-01-01', status: 'OVERDUE' }),
    { ...payload, due_date: null },
  );
  const [visible] = offlineLoanDebtQueue.apply(
    [record({ due_date: '2026-01-01', status: 'OVERDUE' })],
    await offlineLoanDebtQueue.list(7),
  );
  expect(visible.person_name).toBe('Chị Lan');
  expect(visible.due_date).toBeNull();
  expect(visible.status).toBe('OPEN');
});

it('does not overwrite a new payment made on the server', async () => {
  await offlineLoanDebtQueue.update(7, record(), payload);
  jest
    .mocked(loanDebtsService.getAll)
    .mockResolvedValue([record({ settled_amount: 150000 })]);
  const result = await offlineLoanDebtQueue.sync(
    'session',
    7,
    await offlineLoanDebtQueue.preview(7),
    () => true,
  );
  expect(result.needsReview).toBe(1);
  expect(loanDebtsService.update).not.toHaveBeenCalled();
  await expect(
    offlineLoanDebtQueue.update(7, record(), {
      ...payload,
      note: 'Đổi lần nữa',
    }),
  ).rejects.toThrow('đối chiếu');
});

it('recognizes a lost reply before retrying the same metadata edit', async () => {
  await offlineLoanDebtQueue.update(7, record(), payload);
  jest
    .mocked(loanDebtsService.getAll)
    .mockResolvedValueOnce([record()])
    .mockResolvedValueOnce([record(payload)]);
  jest
    .mocked(loanDebtsService.update)
    .mockRejectedValueOnce(Error('reply lost'));
  const expected = await offlineLoanDebtQueue.preview(7);
  expect(
    (await offlineLoanDebtQueue.sync('session', 7, expected, () => true))
      .pending,
  ).toBe(1);
  expect(
    (await offlineLoanDebtQueue.sync('session', 7, expected, () => true))
      .synced,
  ).toBe(1);
  expect(loanDebtsService.update).toHaveBeenCalledTimes(1);
});
