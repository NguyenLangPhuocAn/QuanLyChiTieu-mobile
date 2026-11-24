import React from 'react';
import { Alert, AppState, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import OfflineSessionSync from '../src/components/OfflineSessionSync';
import { homeWidget } from '../src/native/homeWidget';
import {
  offlineTransactionQueue as queue,
  type OfflineTransactionDraft,
} from '../src/services/offlineTransactionQueue';
import { financeRefresh } from '../src/services/financeRefresh';
import { offlineTransactionChanges as changes } from '../src/services/offlineTransactionChanges';
import { offlineBudgetQueue as budgetQueue } from '../src/services/offlineBudgetQueue';
import { offlineSavingsGoalQueue as savingsQueue } from '../src/services/offlineSavingsGoalQueue';
import { savingsService } from '../src/services/savings';
import { offlineLoanDebtQueue as loanQueue } from '../src/services/offlineLoanDebtQueue';
import { loanDebtsService } from '../src/services/loanDebts';
import { offlineLoanCreateQueue as loanCreateQueue } from '../src/services/offlineLoanCreateQueue';
import { walletsService } from '../src/services/wallets';

const mockRetry = jest.fn();
let mockUserId = 9;
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUserId },
    token: 'qa',
    isRestoringSession: false,
    retryRestoreSession: mockRetry,
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiStorageBaseUrl: () => 'https://qa.test',
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: { connected: jest.fn(), subscribe: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  offlineTransactionQueue: {
    isSyncing: jest.fn(),
    list: jest.fn(),
    sync: jest.fn(),
    discardLocal: jest.fn(),
    subscribe: jest.fn(),
  },
}));
jest.mock('../src/services/financeRefresh', () => ({
  financeRefresh: { emit: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionChanges', () => ({
  offlineTransactionChanges: {
    list: jest.fn(),
    preview: jest.fn(),
    discard: jest.fn(),
    sync: jest.fn(),
    subscribe: jest.fn(),
  },
}));
jest.mock('../src/services/offlineBudgetQueue', () => ({
  offlineBudgetQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    rebaseReviewed: jest.fn(),
    sync: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/offlineSavingsGoalQueue', () => ({
  offlineSavingsGoalQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    rebaseReviewed: jest.fn(),
    sync: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/savings', () => ({
  savingsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/offlineLoanDebtQueue', () => ({
  offlineLoanDebtQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    rebaseReviewed: jest.fn(),
    sync: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/offlineLoanCreateQueue', () => ({
  offlineLoanCreateQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    rebaseReviewed: jest.fn(),
    sync: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));

const draft = {
  server: 'https://qa.test',
  id: 'txn_qa_1234567890',
  updatedAt: '2026-11-13T08:00:00.000Z',
  createdAt: '2026-11-13T08:00:00.000Z',
  status: 'PENDING',
  attempts: 0,
  payload: {
    wallet_id: 2,
    amount: '5000',
    type: 'EXPENSE',
    client_request_id: 'txn_qa_1234567890',
  },
} as OfflineTransactionDraft;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let online: () => void;
let queueChanged: () => void;
const choice = (label: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = buttons?.find(item => item.text === label);
  expect(button).toBeDefined();
  return button!;
};
const pressReview = (label: string) => {
  const target = renderer!.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  expect(target).toBeDefined();
  let parent = target!.parent;
  while (parent && typeof parent.props.onPress !== 'function')
    parent = parent.parent;
  expect(parent).toBeDefined();
  parent!.props.onPress();
};

beforeEach(() => {
  mockUserId = 9;
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  jest.mocked(homeWidget.connected).mockResolvedValue(true);
  jest.mocked(homeWidget.subscribe).mockImplementation(listener => {
    online = listener;
    return jest.fn();
  });
  jest.mocked(queue.subscribe).mockImplementation(listener => {
    queueChanged = listener;
    return jest.fn();
  });
  jest.mocked(queue.list).mockResolvedValue([]);
  jest.mocked(queue.isSyncing).mockReturnValue(false);
  jest
    .mocked(queue.sync)
    .mockResolvedValue({ synced: 1, pending: 0, needsReview: 0 });
  jest.mocked(queue.discardLocal).mockResolvedValue(1);
  jest.mocked(changes.list).mockResolvedValue([]);
  jest.mocked(changes.subscribe).mockReturnValue(jest.fn());
  jest.mocked(changes.preview).mockResolvedValue([]);
  jest.mocked(changes.discard).mockResolvedValue(0);
  jest
    .mocked(changes.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(budgetQueue.list).mockResolvedValue([]);
  jest.mocked(budgetQueue.preview).mockResolvedValue([]);
  jest.mocked(budgetQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(budgetQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(budgetQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(budgetQueue.discard).mockResolvedValue(undefined);
  jest.mocked(savingsQueue.list).mockResolvedValue([]);
  jest.mocked(savingsQueue.preview).mockResolvedValue([]);
  jest.mocked(savingsQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(savingsQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(savingsQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(savingsQueue.discard).mockResolvedValue(undefined);
  jest.mocked(savingsService.getAll).mockResolvedValue([]);
  jest.mocked(loanQueue.list).mockResolvedValue([]);
  jest.mocked(loanQueue.preview).mockResolvedValue([]);
  jest.mocked(loanQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(loanQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(loanQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(loanQueue.discard).mockResolvedValue(undefined);
  jest.mocked(loanDebtsService.getAll).mockResolvedValue([]);
  jest.mocked(loanCreateQueue.list).mockResolvedValue([]);
  jest.mocked(loanCreateQueue.preview).mockResolvedValue([]);
  jest.mocked(loanCreateQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(loanCreateQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(loanCreateQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(loanCreateQueue.discard).mockResolvedValue(undefined);
  jest.mocked(walletsService.getAll).mockResolvedValue([]);
  mockRetry.mockResolvedValue(true);
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('refreshes server data when no offline writes are pending', async () => {
  const refreshed = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync onSynced={refreshed} />);
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(refreshed.mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(financeRefresh.emit).mock.invocationCallOrder[0],
  );
});

it('previews a local loan against its server wallet before sending it', async () => {
  const wallet = {
    id: 2,
    name: 'Ví gia đình',
    currency: 'VND',
    balance: 500000,
    wallet_type: 'BANK',
  };
  const pending = {
    id: 'loan_20261124_abcdef123456',
    revision: 1,
    attempts: 0,
    status: 'PENDING' as const,
    updatedAt: '2026-11-24T05:00:00.000Z',
    wallet: {
      id: 2,
      name: wallet.name,
      currency: wallet.currency,
      balance: '500000',
    },
    payload: {
      person_name: 'Anh Minh',
      type: 'BORROWED' as const,
      principal_amount: '200000',
      wallet_id: 2,
      client_request_id: 'loan_20261124_abcdef123456',
    },
  };
  jest.mocked(loanCreateQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(loanCreateQueue.preview)
    .mockResolvedValue([{ id: pending.id, revision: 1 }]);
  jest
    .mocked(loanCreateQueue.rebaseReviewed)
    .mockResolvedValue([{ id: pending.id, revision: 1 }]);
  jest.mocked(walletsService.getAll).mockResolvedValue([wallet] as never);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Vay/Nợ mới'),
  ).toBe(true);
  expect(loanCreateQueue.sync).not.toHaveBeenCalled();
  await act(async () => pressReview('Dùng thay đổi trên máy'));
  expect(loanCreateQueue.sync).toHaveBeenCalledWith(
    'qa',
    9,
    [{ id: pending.id, revision: 1 }],
    { 2: wallet },
    expect.any(Function),
  );
});

it('shows a pending budget and waits for the user before syncing it', async () => {
  const pending = {
    id: -12,
    action: 'CREATE' as const,
    status: 'PENDING' as const,
    payload: {
      name: 'Ăn uống gia đình',
      scope: 'WALLET' as const,
      wallet_id: 2,
      category_id: null,
      limit_amount: '1500000',
      period: 'CUSTOM' as const,
      start_date: '2026-11-01',
      end_date: '2026-11-30',
    },
    requestId: 'budget_november_2026',
    attempts: 0,
    revision: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
  };
  jest.mocked(budgetQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(budgetQueue.preview)
    .mockResolvedValue([{ id: -12, revision: 1 }]);
  jest
    .mocked(budgetQueue.rebaseReviewed)
    .mockResolvedValue([{ id: -12, revision: 1 }]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Ngân sách mới'),
  ).toBe(true);
  expect(budgetQueue.sync).not.toHaveBeenCalled();
  await act(async () => {
    pressReview('Dùng thay đổi trên máy');
  });
  expect(budgetQueue.sync).toHaveBeenCalledTimes(1);
});

it('shows a saved goal edit and waits for the local choice', async () => {
  const pending = {
    id: 4,
    revision: 1,
    attempts: 0,
    status: 'PENDING' as const,
    updatedAt: '2026-11-24T05:00:00.000Z',
    base: {
      name: 'Quỹ dự phòng',
      target_amount: '2000000.00',
      target_date: null,
      note: null,
      status: 'ACTIVE' as const,
    },
    payload: {
      name: 'Quỹ gia đình',
      target_amount: '3000000',
      target_date: null,
      note: 'Sinh hoạt',
    },
  };
  jest.mocked(savingsQueue.list).mockResolvedValue([pending]);
  jest.mocked(savingsQueue.preview).mockResolvedValue([{ id: 4, revision: 1 }]);
  jest
    .mocked(savingsQueue.rebaseReviewed)
    .mockResolvedValue([{ id: 4, revision: 1 }]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Sửa mục tiêu tiết kiệm'),
  ).toBe(true);
  expect(savingsQueue.sync).not.toHaveBeenCalled();
  await act(async () => pressReview('Dùng thay đổi trên máy'));
  expect(savingsQueue.sync).toHaveBeenCalledTimes(1);
});

it('reviews a saved Vay/Nợ edit before sending it', async () => {
  const pending = {
    id: 5,
    revision: 1,
    attempts: 0,
    status: 'PENDING' as const,
    updatedAt: '2026-11-24T05:00:00.000Z',
    base: {
      person_name: 'Anh Minh',
      principal_amount: '500000.00',
      opening_wallet_id: 2,
      type: 'BORROWED' as const,
      due_date: null,
      note: null,
      settled_amount: '100000.00',
    },
    payload: { person_name: 'Chị Lan', due_date: null, note: null },
  };
  jest.mocked(loanQueue.list).mockResolvedValue([pending]);
  jest.mocked(loanQueue.preview).mockResolvedValue([{ id: 5, revision: 1 }]);
  jest
    .mocked(loanQueue.rebaseReviewed)
    .mockResolvedValue([{ id: 5, revision: 1 }]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Sửa thông tin Vay/Nợ'),
  ).toBe(true);
  expect(loanQueue.sync).not.toHaveBeenCalled();
  await act(async () => pressReview('Dùng thay đổi trên máy'));
  expect(loanQueue.sync).toHaveBeenCalledWith(
    'qa',
    9,
    [{ id: 5, revision: 1 }],
    expect.any(Function),
  );
});

it('waits for an explicit local choice before sending any money to the server', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
  await act(async () => {
    online();
    online();
  });
  expect(queue.sync).not.toHaveBeenCalled();
  await act(async () => {
    pressReview('Dùng thay đổi trên máy');
  });
  expect(queue.sync).toHaveBeenCalledTimes(1);
  expect(queue.discardLocal).not.toHaveBeenCalled();
});

it('requires a second confirmation before discarding local writes', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Giữ dữ liệu máy chủ');
  });
  expect(queue.discardLocal).not.toHaveBeenCalled();
  await act(async () => {
    choice('Bỏ thay đổi').onPress?.();
  });
  expect(queue.discardLocal).toHaveBeenCalledWith(9, [
    { id: draft.id, updatedAt: draft.updatedAt },
  ]);
  expect(changes.discard).toHaveBeenCalledWith(9, []);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('prompts again for a later write with the same draft identifier and timestamp', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Giữ dữ liệu máy chủ');
    choice('Bỏ thay đổi').onPress?.();
  });
  await act(async () => {
    online();
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
});

it('keeps drafts untouched when the user chooses later or auth cannot revalidate', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Để sau');
  });
  await act(async () => {
    online();
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(() => renderer!.unmount());
  renderer = undefined;
  mockRetry.mockResolvedValue(false);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
});

it('does not prompt while offline', async () => {
  jest.mocked(homeWidget.connected).mockResolvedValue(false);
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockRetry).not.toHaveBeenCalled();
});

it('reviews a persisted syncing marker after an app restart without auto-sending', async () => {
  jest
    .mocked(queue.list)
    .mockResolvedValue([
      { ...draft, status: 'SYNCING', attempts: 1 } as OfflineTransactionDraft,
    ]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('reacts to Android network recovery without writing before confirmation', async () => {
  jest
    .mocked(homeWidget.connected)
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(mockRetry).not.toHaveBeenCalled();
  await act(async () => {
    online();
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('offers the choice after the API recovers without a Wi-Fi change or app restart', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(queue.list).mockResolvedValue([draft]);
    mockRetry.mockResolvedValueOnce(false).mockResolvedValue(true);
    await act(async () => {
      renderer = TestRenderer.create(<OfflineSessionSync />);
    });
    expect(queue.sync).not.toHaveBeenCalled();
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(true);
    expect(queue.sync).not.toHaveBeenCalled();

    await act(async () => {
      pressReview('Để sau');
      jest.advanceTimersByTime(60_000);
    });
    expect(mockRetry).toHaveBeenCalledTimes(2);
    expect(queue.sync).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('asks again after a confirmed sync loses its network response and keeps the draft', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(queue.list).mockResolvedValue([draft]);
    jest
      .mocked(queue.sync)
      .mockResolvedValue({ synced: 0, pending: 1, needsReview: 0 });
    await act(async () => {
      renderer = TestRenderer.create(<OfflineSessionSync />);
    });
    await act(async () => {
      pressReview('Dùng thay đổi trên máy');
    });
    expect(queue.sync).toHaveBeenCalledTimes(1);
    expect(queue.discardLocal).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(true);
    expect(queue.sync).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('does not show a stale choice after a manual sync clears the queue', async () => {
  jest
    .mocked(queue.list)
    .mockResolvedValueOnce([draft])
    .mockResolvedValueOnce([]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(false);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('closes an already visible choice when another screen discards its draft', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);

  jest.mocked(queue.list).mockResolvedValue([]);
  await act(async () => queueChanged());
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(false);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('ignores an old account review after switching accounts', async () => {
  jest
    .mocked(queue.list)
    .mockImplementation(async userId => (userId === 9 ? [draft] : []));
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  const target = renderer!.root
    .findAllByType(Text)
    .find(node => node.props.children === 'Dùng thay đổi trên máy');
  expect(target).toBeDefined();
  let parent = target!.parent;
  while (parent && typeof parent.props.onPress !== 'function')
    parent = parent.parent;
  const staleChoice = parent!.props.onPress;

  mockUserId = 10;
  await act(async () => renderer!.update(<OfflineSessionSync />));
  await act(async () => staleChoice());

  expect(queue.list).toHaveBeenCalledWith(10);
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
});
