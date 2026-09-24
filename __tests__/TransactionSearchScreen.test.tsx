import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import TransactionSearchScreen from '../src/screens/home/TransactionSearchScreen';
import { transactionsService } from '../src/services/transactions';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(transactionsService.getPage).mockReset();
});

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test' }),
}));
jest.mock('../src/context/FinanceContext', () => {
  const state = {
    categories: [
      { id: 9, name: 'Di chuyển', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    ],
    preferredCurrency: 'VND',
    setCategories: jest.fn(),
  };
  return { useFinance: () => state };
});

it('shows a retry action after a network failure and repeats the current filters', async () => {
  jest.useFakeTimers();
  const getPage = jest.mocked(transactionsService.getPage);
  getPage.mockRejectedValueOnce(new Error('Không thể kết nối hệ thống.'));
  getPage.mockResolvedValueOnce({
    data: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const props = {
    navigation: { goBack: jest.fn() },
    route: { params: { wallets: [] } },
  } as unknown as React.ComponentProps<typeof TransactionSearchScreen>;
  try {
    await act(() => {
      renderer = ReactTestRenderer.create(
        <TransactionSearchScreen {...props} />,
      );
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(
      renderer.root.findAllByProps({ children: 'Không có kết quả phù hợp' }),
    ).toHaveLength(0);
    await act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Thử tìm lại' })
        .props.onPress(),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(getPage.mock.calls[1]).toEqual(getPage.mock.calls[0]);
    expect(
      renderer.root.findAllByProps({ children: 'Không có kết quả phù hợp' })
        .length,
    ).toBeGreaterThan(0);
  } finally {
    await act(() => renderer?.unmount());
    jest.useRealTimers();
  }
});
jest.mock('../src/services/categories', () => ({
  categoriesService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: { getPage: jest.fn() },
}));

it('switches from a loan search to normal income and removes an expense category', async () => {
  jest.useFakeTimers();
  const getPage = jest.mocked(transactionsService.getPage);
  getPage.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const props = {
    navigation: { goBack: jest.fn() },
    route: { params: { wallets: [], cashFlow: 'loan_debt' } },
  } as unknown as React.ComponentProps<typeof TransactionSearchScreen>;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(() => {
      renderer = ReactTestRenderer.create(
        <TransactionSearchScreen {...props} />,
      );
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(getPage).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({ cash_flow: 'loan_debt' }),
    );
    // Open the category selector through the control with this explanatory text.
    const hint = renderer.root.findByProps({
      children: 'Chọn riêng theo Thu/Chi/Vay nợ',
    });
    let control = hint.parent;
    while (control && !control.props.onPress) control = control.parent;
    await act(() => control!.props.onPress());
    await act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Chọn danh mục Di chuyển' })
        .props.onPress(),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(getPage).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({
        category_id: 9,
        type: 'EXPENSE',
        cash_flow: 'normal',
      }),
    );
    await act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Lọc thu nhập' })
        .props.onPress(),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(getPage).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({
        category_id: undefined,
        type: 'INCOME',
        cash_flow: 'normal',
      }),
    );
  } finally {
    await act(() => renderer?.unmount());
    jest.useRealTimers();
  }
});

it('debounces typing and keeps the newest search when responses arrive out of order', async () => {
  jest.useFakeTimers();
  const getPage = jest.mocked(transactionsService.getPage);
  type Page = Awaited<ReturnType<typeof transactionsService.getPage>>;
  let resolveOld!: (value: Page) => void;
  getPage.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      }),
  );
  getPage.mockResolvedValueOnce({
    data: [],
    meta: { page: 1, limit: 10, total: 23, totalPages: 3 },
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const props = {
    navigation: { goBack: jest.fn() },
    route: { params: { wallets: [] } },
  } as unknown as React.ComponentProps<typeof TransactionSearchScreen>;
  try {
    await act(() => {
      renderer = ReactTestRenderer.create(
        <TransactionSearchScreen {...props} />,
      );
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    await act(() =>
      renderer.root
        .findByProps({ placeholder: 'Ví dụ: ăntrưa' })
        .props.onChangeText('di'),
    );
    await act(() =>
      renderer.root
        .findByProps({ placeholder: 'Ví dụ: ăntrưa' })
        .props.onChangeText('#  DI   CHUYỂN'),
    );
    expect(getPage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(getPage).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({ tag: 'di chuyển' }),
    );
    await act(() =>
      resolveOld({
        data: [],
        meta: { page: 1, limit: 10, total: 91, totalPages: 10 },
      }),
    );
    expect(
      renderer.root.findAllByProps({ children: 23 }).length,
    ).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ children: 91 })).toHaveLength(0);
  } finally {
    await act(() => renderer?.unmount());
    jest.useRealTimers();
  }
});
