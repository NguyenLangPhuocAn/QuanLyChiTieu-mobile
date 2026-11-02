import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, AppState } from 'react-native';
import { useLatestBankNotification } from '../src/hooks/useLatestBankNotification';
import { bankNotificationReader } from '../src/native/bankNotificationReader';
import { bankNotificationExtraction } from '../src/services/bankNotificationExtraction';
jest.mock('../src/services/bankNotificationExtraction', () => ({
  ...jest.requireActual('../src/services/bankNotificationExtraction'),
  bankNotificationExtraction: { isAvailable: jest.fn(), analyze: jest.fn() },
}));
jest.mock('../src/native/bankNotificationReader', () => ({
  bankNotificationReader: {
    isSupported: true,
    isNotificationAccessGranted: jest.fn(),
    openNotificationAccessSettings: jest.fn().mockResolvedValue(true),
    setConfiguration: jest.fn().mockResolvedValue(true),
    getPendingEvents: jest.fn(),
    markProcessed: jest.fn(),
    startShakeDetection: jest.fn().mockResolvedValue(true),
    stopShakeDetection: jest.fn().mockResolvedValue(true),
    onShake: jest.fn(),
  },
}));
let hook: ReturnType<typeof useLatestBankNotification>;
const delivered = jest.fn();
let blocked = false;
function Harness({
  enabled = true,
  userId = 7,
}: {
  enabled?: boolean;
  userId?: number;
}) {
  hook = useLatestBankNotification(
    enabled,
    userId,
    delivered,
    () => !blocked,
    'test-token',
  );
  return null;
}
let tree: TestRenderer.ReactTestRenderer;
let shake: () => void;
let appState: (state: string) => void;
const event = {
  id: 'a'.repeat(64),
  packageName: 'bank.test',
  appName: 'Bank',
  title: 'Giao dịch',
  text: 'Thanh toán -79.000 VND. Số dư 5.000.000 VND',
  postedAt: Date.now(),
};
beforeEach(async () => {
  jest.clearAllMocks();
  blocked = false;
  (bankNotificationExtraction.isAvailable as jest.Mock).mockResolvedValue(true);
  (bankNotificationExtraction.analyze as jest.Mock).mockResolvedValue({
    status: 'READY',
    type: 'EXPENSE',
    amount: '79000',
    currency: 'VND',
    note: 'CAFE',
    transactionDate: '2026-10-23',
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    appState = callback as typeof appState;
    return { remove: jest.fn() };
  });
  (
    bankNotificationReader.isNotificationAccessGranted as jest.Mock
  ).mockResolvedValue(true);
  (bankNotificationReader.getPendingEvents as jest.Mock).mockResolvedValue([
    event,
  ]);
  (bankNotificationReader.onShake as jest.Mock).mockImplementation(callback => {
    shake = callback;
    return { remove: jest.fn() };
  });
  await act(async () => {
    tree = TestRenderer.create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

it('arms the sensor without reading any notification until a shake or button', async () => {
  expect(bankNotificationReader.startShakeDetection).toHaveBeenCalled();
  expect(bankNotificationReader.getPendingEvents).not.toHaveBeenCalled();
  await act(async () => shake());
  expect(delivered).toHaveBeenCalledWith(
    expect.objectContaining({
      parsed: expect.objectContaining({ type: 'EXPENSE', amount: '79000' }),
    }),
    expect.any(Function),
  );
  expect(bankNotificationReader.markProcessed).not.toHaveBeenCalled();
  expect(
    (bankNotificationReader.setConfiguration as jest.Mock).mock.calls.at(-1),
  ).toEqual([null, []]);
});
it('asks for access once before reading and does not capture or read denied notifications', async () => {
  (
    bankNotificationReader.isNotificationAccessGranted as jest.Mock
  ).mockResolvedValue(false);
  await act(async () => {
    await hook.read();
  });
  expect(bankNotificationReader.getPendingEvents).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Cho phép đọc thông báo',
    expect.stringContaining('không chụp màn hình'),
    expect.any(Array),
    expect.objectContaining({ onDismiss: expect.any(Function) }),
  );
  await act(async () => {
    shake();
    await hook.read();
  });
  expect(
    (Alert.alert as jest.Mock).mock.calls.filter(
      call => call[0] === 'Cho phép đọc thông báo',
    ),
  ).toHaveLength(1);
});
it('blocks concurrent shake/button reads', async () => {
  let finish!: (value: (typeof event)[]) => void;
  (bankNotificationReader.getPendingEvents as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.read();
  });
  await act(async () => {
    shake();
    await hook.read();
  });
  expect(bankNotificationReader.getPendingEvents).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish([event]);
    await pending;
  });
});
it.each(['close', 'account', 'background'])(
  'discards late results after %s',
  async change => {
    let finish!: (value: (typeof event)[]) => void;
    (
      bankNotificationReader.getPendingEvents as jest.Mock
    ).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.read();
    });
    await act(async () => {
      if (change === 'close') hook.cancel();
      if (change === 'account') tree.update(<Harness userId={8} />);
      if (change === 'background') appState('background');
    });
    await act(async () => {
      finish([event]);
      await pending;
    });
    expect(delivered).not.toHaveBeenCalled();
  },
);
it('does not read while a form replacement prompt or saving screen blocks it', async () => {
  blocked = true;
  await act(async () => {
    await hook.read();
    shake();
  });
  expect(bankNotificationReader.getPendingEvents).not.toHaveBeenCalled();
  blocked = false;
  await act(async () => tree.update(<Harness enabled={false} />));
  await act(async () => {
    await hook.read();
    shake();
  });
  expect(bankNotificationReader.getPendingEvents).not.toHaveBeenCalled();
});
it('reports disconnected reader errors instead of claiming there are no notifications', async () => {
  (bankNotificationReader.getPendingEvents as jest.Mock).mockRejectedValueOnce(
    new Error('Bộ đọc chưa kết nối'),
  );
  await act(async () => {
    await hook.read();
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa đọc được thông báo',
    'Bộ đọc chưa kết nối',
  );
  expect(delivered).not.toHaveBeenCalled();
});
it('unregisters when backgrounded and re-arms without auto-reading on resume', async () => {
  await act(async () => appState('background'));
  expect(bankNotificationReader.stopShakeDetection).toHaveBeenCalled();
  await act(async () => appState('active'));
  expect(bankNotificationReader.startShakeDetection).toHaveBeenCalledTimes(2);
  expect(bankNotificationReader.getPendingEvents).not.toHaveBeenCalled();
});

it('uses AI immediately after notification access without another prompt', async () => {
  await act(async () => {
    await hook.read();
  });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(bankNotificationExtraction.analyze).toHaveBeenCalledTimes(1);
  expect((bankNotificationExtraction.analyze as jest.Mock).mock.calls[0][1]).not.toContain('5.000.000');
  expect(delivered.mock.calls[0][0].parsed).toMatchObject({ status: 'READY', amount: '79000' });
});
it('uses a short in-memory cache for the same event', async () => {
  await act(async () => {
    await hook.read();
    await hook.read();
  });
  expect(bankNotificationExtraction.analyze).toHaveBeenCalledTimes(1);
  expect(delivered).toHaveBeenCalledTimes(2);
});
it('does not interpret fields locally when AI is unavailable or fails', async () => {
  (bankNotificationExtraction.isAvailable as jest.Mock).mockResolvedValue(
    false,
  );
  await act(async () => {
    await hook.read();
  });
  expect(bankNotificationExtraction.analyze).not.toHaveBeenCalled();
  expect(delivered.mock.calls[0][0].parsed).toMatchObject({ status: 'REVIEW' });
  expect(delivered.mock.calls[0][0].parsed.amount).toBeUndefined();
  (bankNotificationExtraction.isAvailable as jest.Mock).mockResolvedValue(true);
  (bankNotificationExtraction.analyze as jest.Mock).mockRejectedValueOnce(
    new Error('AI timeout'),
  );
  await act(async () => {
    await hook.read();
  });
  expect(delivered.mock.calls[1][0].parsed).toMatchObject({
    status: 'REVIEW',
    reason: 'AI timeout',
  });
  expect(delivered.mock.calls[1][0].parsed.amount).toBeUndefined();
});
it('shows the AI phase, then ignores a model response after cancellation', async () => {
  let finish!: (value: unknown) => void;
  (bankNotificationExtraction.analyze as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.read();
  });
  expect(hook.phase).toBe('ai');
  await act(async () => hook.cancel());
  expect(hook.phase).toBe('idle');
  await act(async () => {
    finish({ status: 'READY', type: 'EXPENSE', amount: '79000' });
    await pending;
  });
  expect(delivered).not.toHaveBeenCalled();
});
