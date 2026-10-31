import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import Controls from '../src/components/PlanningSyncControls';
import { planningSync } from '../src/services/planningSync';
import { planningLocalStore } from '../src/services/planningLocalStore';
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'qa' }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('../src/services/planningSync', () => ({
  planningSync: { preview: jest.fn(), confirm: jest.fn(), disable: jest.fn() },
}));
jest.mock('../src/services/planningLocalStore', () => ({
  planningLocalStore: { read: jest.fn(), subscribe: jest.fn(() => () => {}) },
}));
const scope = { userId: 8, server: 'http://qa' };
const snapshot = {
  version: 1 as const,
  book: { version: 1 as const, bills: [], periods: [] },
  plans: [
    {
      id: 'salary',
      label: 'Lương QA',
      date: '2026-11-01',
      type: 'INCOME' as const,
      currency: 'VND',
      amount: 5000000,
    },
  ],
};
const preview = {
  local: snapshot,
  cloud: { revision: 1, snapshot, updatedAt: '2026-10-31T00:00:00Z' },
  expected: 'same',
};
let renderer: TestRenderer.ReactTestRenderer;
let listeners: Array<(s: AppStateStatus) => void>;
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(n => typeof n.props.onPress === 'function')!
    .props.onPress();
const contents = () => JSON.stringify(renderer.toJSON());
const accept = () =>
  jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(b => b.text === 'Xác nhận đồng bộ')!.onPress!;
beforeEach(() => {
  jest.clearAllMocks();
  listeners = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_name, listener) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .mocked(planningLocalStore.read)
    .mockResolvedValue({
      version: 1,
      book: null,
      plans: null,
      sync: {
        enabled: false,
        revision: 0,
        baseline: null,
        conflict: false,
        updatedAt: null,
      },
    });
  jest.mocked(planningSync.preview).mockResolvedValue(preview);
  jest.mocked(planningSync.confirm).mockResolvedValue(undefined);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(<Controls scope={scope} />);
  });
};
it('loads locally without network, previews content and only opts in on explicit confirmation', async () => {
  await mount();
  expect(planningSync.preview).not.toHaveBeenCalled();
  await act(async () => press('Đồng bộ lịch giữa thiết bị'));
  expect(contents()).toContain('Lương QA');
  expect(planningSync.confirm).not.toHaveBeenCalled();
  await act(async () => press('Nhận bản từ tài khoản'));
  expect(planningSync.confirm).not.toHaveBeenCalled();
  await act(async () => accept()());
  expect(planningSync.confirm).toHaveBeenCalledWith(
    scope,
    'qa',
    preview,
    'cloud',
    expect.any(Function),
  );
});
it('discards old confirmation after background, closing preview or account change', async () => {
  await mount();
  await act(async () => press('Đồng bộ lịch giữa thiết bị'));
  await act(async () => press('Giữ bản trên máy'));
  const old = accept();
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => old());
  expect(planningSync.confirm).not.toHaveBeenCalled();
  await act(async () => listeners.forEach(l => l('active')));
  await act(async () => press('Đồng bộ lịch giữa thiết bị'));
  await act(async () => press('Giữ bản trên máy'));
  const next = accept();
  await act(async () =>
    renderer.update(<Controls scope={{ ...scope, userId: 9 }} />),
  );
  await act(async () => next());
  expect(planningSync.confirm).not.toHaveBeenCalled();
});
it('preserves local data and shows retryable errors if cloud preview fails', async () => {
  jest
    .mocked(planningSync.preview)
    .mockRejectedValueOnce(Error('Mất kết nối QA'));
  await mount();
  await act(async () => press('Đồng bộ lịch giữa thiết bị'));
  expect(contents()).toContain('Mất kết nối QA');
  expect(planningSync.confirm).not.toHaveBeenCalled();
  await act(async () => press('Đồng bộ lịch giữa thiết bị'));
  expect(contents()).toContain('Lương QA');
});
