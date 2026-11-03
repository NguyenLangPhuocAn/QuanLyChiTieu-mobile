import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import BillPaidTransactionLink from '../src/components/BillPaidTransactionLink';
import { transactionsService } from '../src/services/transactions';
import { walletsService } from '../src/services/wallets';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'qa-token' }),
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: { getLinkedPayments: jest.fn(), getAll: jest.fn() },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));

const payment = {
  id: 47,
  amount: 300000,
  currency: 'VND',
  date: '2026-11-03',
  note: 'Tên cũ',
};
const current = {
  id: 47,
  wallet_id: 8,
  amount: '300000',
  currency: 'VND',
  type: 'EXPENSE' as const,
  transaction_date: '2026-11-03T04:00:00.000Z',
  note: 'Tên mới',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(transactionsService.getLinkedPayments).mockResolvedValue({
    requestedIds: [47],
    missingIds: [],
    data: [current],
  });
  jest.mocked(transactionsService.getAll).mockResolvedValue([
    { ...current, receipt_image: '/uploads/receipt.jpg', tags: ['internet'] },
  ]);
  jest.mocked(walletsService.getAll).mockResolvedValue([
    { id: 8, name: 'Ví chính', currency: 'VND' },
  ] as Awaited<ReturnType<typeof walletsService.getAll>>);
});
afterEach(() => jest.restoreAllMocks());

it('opens the current full transaction without showing its internal ID', async () => {
  const onOpen = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BillPaidTransactionLink payment={payment} onOpen={onOpen} />,
    );
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Đã trả · ');
  expect(JSON.stringify(renderer.toJSON())).toContain('300.000');
  expect(JSON.stringify(renderer.toJSON())).toContain('03/11/2026');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('#47');
  const link = renderer.root.findAllByProps({ accessibilityRole: 'button' })
    .find(node => String(node.props.accessibilityLabel).startsWith('Xem giao dịch đã trả'))!;
  await act(async () => link.props.onPress());
  expect(transactionsService.getLinkedPayments).toHaveBeenCalledWith(
    'qa-token',
    [47],
  );
  expect(transactionsService.getAll).toHaveBeenCalledWith(
    'qa-token',
    expect.objectContaining({ wallet_id: 8 }),
  );
  expect(onOpen).toHaveBeenCalledWith(
    expect.objectContaining({
      id: '47',
      note: 'Tên mới',
      wallet: 'Ví chính',
      receiptImage: '/uploads/receipt.jpg',
      tags: ['internet'],
    }),
  );
  await act(async () => renderer.unmount());
});

it('does not navigate using a stale bill snapshot if the transaction was deleted', async () => {
  jest.mocked(transactionsService.getLinkedPayments).mockResolvedValueOnce({
    requestedIds: [47],
    missingIds: [47],
    data: [],
  });
  const onOpen = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BillPaidTransactionLink payment={payment} onOpen={onOpen} />,
    );
  });
  await act(async () =>
    renderer.root
      .findAllByProps({ accessibilityRole: 'button' })
      .find(node => String(node.props.accessibilityLabel).startsWith('Xem giao dịch đã trả'))!
      .props.onPress(),
  );
  expect(onOpen).not.toHaveBeenCalled();
  expect(transactionsService.getAll).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa mở được giao dịch',
    'Giao dịch đã trả không còn trong tài khoản này.',
  );
  await act(async () => renderer.unmount());
});
