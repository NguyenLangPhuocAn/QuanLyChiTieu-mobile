import React from 'react';
import { Alert, AppState, type AppStateStatus, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import PersonalBackupScreen from '../src/screens/home/PersonalBackupScreen';
import { personalBackupService as backup } from '../src/services/personalBackup';
import { localDocumentPicker as picker } from '../src/native/documentPicker';
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  Check: () => null,
  Download: () => null,
  Upload: () => null,
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'qa-token', user: { id: 88 } }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'http://qa.invalid',
}));
jest.mock('../src/services/personalBackup', () => ({
  ...jest.requireActual('../src/services/personalBackup'),
  personalBackupService: {
    export: jest.fn(),
    preview: jest.fn(),
    restore: jest.fn(),
  },
}));
jest.mock('../src/native/documentPicker', () => ({
  localDocumentPicker: { pickBackupFile: jest.fn(), saveBase64File: jest.fn() },
}));
const file = {
  uri: 'file:///qa.stcn-backup',
  name: 'qa.stcn-backup',
  type: 'application/json',
};
const fixture = {
  metadata: {
    createdAt: '2026-10-28T00:00:00Z',
    version: 1,
    dataTypes: ['transactions'],
    fileHash: 'a'.repeat(64),
  },
  summary: { total: 1, ready: 1, duplicate: 0, invalid: 0 },
  rows: [
    {
      row: 1,
      status: 'READY',
      type: 'EXPENSE',
      amount: '79000',
      wallet: { name: 'Ví QA', currency: 'VND' },
      category: null,
      note: 'Cà phê',
      reason: 'Sẵn sàng',
    },
  ],
};
let renderer: TestRenderer.ReactTestRenderer,
  listeners: Array<(state: AppStateStatus) => void>;
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(n => typeof n.props.onPress === 'function')!
    .props.onPress();
const confirm = () =>
  (
    (Alert.alert as jest.Mock).mock.calls.at(-1)![2] as Array<{
      text: string;
      onPress?: () => void;
    }>
  ).find(b => b.text === 'Khôi phục')!.onPress!;
const prepare = async () => {
  await act(async () => {
    renderer = TestRenderer.create(<PersonalBackupScreen />);
  });
  await act(async () => press('Chọn file backup cá nhân'));
  await act(async () => press('Xem trước backup cá nhân'));
};
beforeEach(() => {
  jest.clearAllMocks();
  listeners = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (picker.pickBackupFile as jest.Mock).mockResolvedValue(file);
  (backup.preview as jest.Mock).mockResolvedValue(fixture);
  (backup.restore as jest.Mock).mockResolvedValue({
    restored: 1,
    skipped: 0,
    failed: 0,
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
it('has no password inputs, selects nothing by default, requires confirmation and prevents double writes', async () => {
  await prepare();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(backup.restore).not.toHaveBeenCalled();
  await act(async () => press('Khôi phục backup đã chọn'));
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(async () => press('Chọn dòng backup đang hiện'));
  await act(async () => press('Khôi phục backup đã chọn'));
  expect(backup.restore).not.toHaveBeenCalled();
  const accept = confirm();
  await act(async () => {
    accept();
    accept();
  });
  expect(backup.restore).toHaveBeenCalledTimes(1);
  expect(backup.restore).toHaveBeenCalledWith(
    'qa-token',
    file,
    [1],
    fixture.metadata.fileHash,
  );
});
it('invalidates confirmation after background or file change and discards late preview', async () => {
  await prepare();
  await act(async () => press('Chọn dòng backup đang hiện'));
  await act(async () => press('Khôi phục backup đã chọn'));
  const stale = confirm();
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => stale());
  expect(backup.restore).not.toHaveBeenCalled();
  await act(async () => press('Xem trước backup cá nhân'));
  await act(async () => press('Chọn dòng backup đang hiện'));
  await act(async () => press('Khôi phục backup đã chọn'));
  const changed = confirm();
  await act(async () => press('Chọn file backup cá nhân'));
  await act(async () => changed());
  expect(backup.restore).not.toHaveBeenCalled();
  let resolve!: (value: typeof fixture) => void;
  (backup.preview as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  await act(async () => {
    press('Xem trước backup cá nhân');
  });
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => resolve(fixture));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Bản backup');
});
it('blocks an old backend response without a preview checksum', async () => {
  (backup.preview as jest.Mock).mockResolvedValue({
    ...fixture,
    metadata: { ...fixture.metadata, fileHash: undefined },
  });
  await prepare();
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Bản backup');
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa thực hiện được',
    expect.any(String),
  );
  expect(backup.restore).not.toHaveBeenCalled();
});
