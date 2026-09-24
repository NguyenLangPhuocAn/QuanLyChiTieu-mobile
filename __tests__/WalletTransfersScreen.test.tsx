import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import WalletTransfersScreen from '../src/screens/home/WalletTransfersScreen';
import { walletsService } from '../src/services/wallets';
import { walletTransfersService } from '../src/services/walletTransfers';
import type { Wallet } from '../src/types/wallet';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test' }),
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/walletTransfers', () => ({
  walletTransfersService: { getAll: jest.fn(), create: jest.fn() },
}));
const wallets = [1, 2, 3].map(id => ({
  id,
  name: `Ví ${id}`,
  currency: 'USD',
  balance: 100,
  wallet_type: 'CASH',
})) as Wallet[];
let renderer: TestRenderer.ReactTestRenderer;
const press = (label: string) =>
  renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(walletsService.getAll).mockResolvedValue(wallets);
  jest.mocked(walletTransfersService.getAll).mockResolvedValue([]);
  jest.mocked(walletTransfersService.create).mockResolvedValue({} as never);
  await act(async () => {
    renderer = TestRenderer.create(
      <WalletTransfersScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{} as never}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('keeps the chosen transfer direction across a refresh and preserves cents', async () => {
  await act(async () => {
    press('Chọn ví nguồn Ví 2');
  });
  await act(async () => {
    press('Chọn ví nhận Ví 3');
  });
  await act(async () => {
    await renderer.root.findByType(RefreshControl).props.onRefresh();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Chọn ví nguồn Ví 2' })
      .props.accessibilityState.selected,
  ).toBe(true);
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Chọn ví nhận Ví 3' }).props
      .accessibilityState.selected,
  ).toBe(true);
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Số tiền chuyển ví' })
      .props.onChangeText('0,50');
  });
  await act(async () => {
    await Promise.all([
      press('Xác nhận chuyển tiền'),
      press('Xác nhận chuyển tiền'),
    ]);
  });
  expect(walletTransfersService.create).toHaveBeenCalledTimes(1);
  expect(walletTransfersService.create).toHaveBeenCalledWith(
    'test',
    expect.objectContaining({
      source_wallet_id: 2,
      destination_wallet_id: 3,
      amount: '0.50',
    }),
  );
});

it('requires a new destination choice if the selected wallet disappears', async () => {
  await act(async () => {
    press('Chọn ví nhận Ví 3');
  });
  jest.mocked(walletsService.getAll).mockResolvedValueOnce(wallets.slice(0, 2));
  await act(async () => {
    await renderer.root.findByType(RefreshControl).props.onRefresh();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Chọn ví nhận Ví 2' }).props
      .accessibilityState.selected,
  ).toBe(false);
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Xác nhận chuyển tiền' })
      .props.disabled,
  ).toBe(true);
  expect(walletTransfersService.create).not.toHaveBeenCalled();
});
