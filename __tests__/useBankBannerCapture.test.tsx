import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, AppState } from 'react-native';
import { useBankBannerCapture } from '../src/hooks/useBankBannerCapture';
import { bankScreenCapture } from '../src/native/bankScreenCapture';
jest.mock('../src/native/bankScreenCapture', () => ({
  bankScreenCapture: {
    isReady: jest.fn(),
    prepare: jest.fn(),
    capture: jest.fn(),
    stop: jest.fn().mockResolvedValue(true),
    deleteCapture: jest.fn().mockResolvedValue(true),
  },
}));
let hook: ReturnType<typeof useBankBannerCapture>;
function Harness({
  enabled = true,
  userId = 7,
}: {
  enabled?: boolean;
  userId?: number;
}) {
  hook = useBankBannerCapture(enabled, userId);
  return null;
}
let tree: TestRenderer.ReactTestRenderer;
let stateChange: (state: string) => void;
const image = {
  uri: 'file:///screen.png',
  width: 1080,
  height: 2400,
  capturedAt: 1,
};
beforeEach(async () => {
  jest.clearAllMocks();
  (bankScreenCapture.isReady as jest.Mock).mockResolvedValue(false);
  (bankScreenCapture.prepare as jest.Mock).mockResolvedValue(true);
  (bankScreenCapture.capture as jest.Mock).mockResolvedValue(image);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    stateChange = callback as typeof stateChange;
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
async function consent() {
  await act(async () => {
    await hook.read();
  });
  const choices = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Đọc banner trên màn hình',
  )[2];
  await act(async () =>
    choices
      .find((choice: { text: string }) => choice.text === 'Cấp quyền chụp')
      .onPress(),
  );
}

it('prepares consent without silently capturing, then captures only on the next bell', async () => {
  await consent();
  expect(hook.ready).toBe(true);
  expect(bankScreenCapture.capture).not.toHaveBeenCalled();
  (bankScreenCapture.isReady as jest.Mock).mockResolvedValue(true);
  await act(async () => {
    await hook.read();
  });
  expect(bankScreenCapture.capture).toHaveBeenCalledTimes(1);
  expect(hook.capture).toEqual(image);
});

it('cancelling system permission does not capture', async () => {
  (bankScreenCapture.prepare as jest.Mock).mockResolvedValue(false);
  await consent();
  expect(hook.ready).toBe(false);
  expect(bankScreenCapture.capture).not.toHaveBeenCalled();
});

it('ignores readiness that resolves after another form has opened', async () => {
  let finish!: (ready: boolean) => void;
  (bankScreenCapture.isReady as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let reading!: Promise<void>;
  await act(async () => {
    reading = hook.read();
  });
  await act(async () => tree.update(<Harness enabled={false} />));
  await act(async () => tree.update(<Harness />));
  await act(async () => {
    finish(true);
    await reading;
  });
  expect(bankScreenCapture.capture).not.toHaveBeenCalled();
});

it('does not open a permission request from an obsolete disclosure', async () => {
  await act(async () => {
    await hook.read();
  });
  const choices = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Đọc banner trên màn hình',
  )[2];
  await act(async () => tree.update(<Harness enabled={false} />));
  await act(async () =>
    choices
      .find((choice: { text: string }) => choice.text === 'Cấp quyền chụp')
      .onPress(),
  );
  expect(bankScreenCapture.prepare).not.toHaveBeenCalled();
});

it('ignores delayed capture after the form closes and deletes its image', async () => {
  (bankScreenCapture.isReady as jest.Mock).mockResolvedValue(true);
  let finish!: (value: typeof image) => void;
  (bankScreenCapture.capture as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let reading!: Promise<void>;
  await act(async () => {
    reading = hook.read();
  });
  await act(async () => tree.update(<Harness enabled={false} />));
  await act(async () => {
    finish(image);
    await reading;
  });
  expect(hook.capture).toBeNull();
  expect(bankScreenCapture.deleteCapture).toHaveBeenCalledWith(image.uri);
});

it('stops and clears the preview when the app backgrounds or account changes', async () => {
  (bankScreenCapture.isReady as jest.Mock).mockResolvedValue(true);
  await act(async () => {
    await hook.read();
  });
  expect(hook.capture).toEqual(image);
  await act(async () => stateChange('background'));
  expect(hook.capture).toBeNull();
  expect(bankScreenCapture.stop).toHaveBeenCalled();
  await act(async () => tree.update(<Harness userId={8} />));
  expect(hook.ready).toBe(false);
});

it('prevents double captures while a request is pending', async () => {
  (bankScreenCapture.isReady as jest.Mock).mockResolvedValue(true);
  let finish!: (value: typeof image) => void;
  (bankScreenCapture.capture as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let reading!: Promise<void>;
  await act(async () => {
    reading = hook.read();
  });
  await act(async () => {
    await hook.read();
  });
  expect(bankScreenCapture.capture).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(image);
    await reading;
  });
});
