import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useVoiceInput } from '../src/hooks/useVoiceInput';
import { RNSpeechRecognitionModule as speech } from 'rn-speech-recognition';

jest.mock('rn-speech-recognition', () => ({
  RNSpeechRecognitionModule: {
    isAvailable: true,
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));

const mocked = speech as jest.Mocked<typeof speech>;
let hook: ReturnType<typeof useVoiceInput>;
let renderer: TestRenderer.ReactTestRenderer;
let events: Record<string, (event?: any) => void>;
const transcript = jest.fn();
function Harness() {
  hook = useVoiceInput(transcript);
  return null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  events = {};
  mocked.isRecognitionAvailable.mockReturnValue(true);
  mocked.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  mocked.addListener.mockImplementation((name, callback) => {
    events[name] = callback;
    return { remove: jest.fn() };
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await act(async () => {
    renderer = TestRenderer.create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('preserves the typed prefix, replaces interim speech and stops without sending', async () => {
  await act(async () => hook.toggle('Tháng này'));
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mocked.start).toHaveBeenCalledWith(
    expect.objectContaining({
      lang: 'vi-VN',
      recordingOptions: { persist: false },
    }),
  );
  await act(async () => events.start());
  await act(async () => events.result({ results: [{ transcript: 'chi' }] }));
  await act(async () =>
    events.result({ results: [{ transcript: 'chi bao nhiêu' }] }),
  );
  expect(transcript).toHaveBeenLastCalledWith('Tháng này chi bao nhiêu');
  await act(async () => hook.toggle(''));
  expect(mocked.stop).toHaveBeenCalledTimes(1);
  await act(async () => events.end());
  expect(hook.isBusy).toBe(false);
});

it('does not start recording after permission denial', async () => {
  mocked.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await act(async () => hook.toggle(''));
  expect(mocked.start).not.toHaveBeenCalled();
  expect(hook.isBusy).toBe(false);
  expect(Alert.alert).toHaveBeenCalled();
});

it('ignores delayed permission results after leaving the screen', async () => {
  let resolve!: (value: any) => void;
  mocked.requestPermissionsAsync.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.toggle('');
  });
  await act(async () => hook.cancel());
  await act(async () => {
    resolve({ granted: true });
    await pending;
  });
  expect(mocked.start).not.toHaveBeenCalled();
});

it('ignores recognition events from a canceled session', async () => {
  await act(async () => hook.toggle(''));
  const lateResult = events.result;
  await act(async () => hook.cancel());
  await act(async () =>
    lateResult({ results: [{ transcript: 'không được thêm' }] }),
  );
  expect(transcript).not.toHaveBeenCalled();
  expect(mocked.abort).toHaveBeenCalled();
});
