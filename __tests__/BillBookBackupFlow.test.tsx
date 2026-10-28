import React from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import BillBookBackup from '../src/components/BillBookBackup';
import {
  billBookBackupService as backup,
  billBackupPreview,
} from '../src/services/billBookBackup';
import { localDocumentPicker as picker } from '../src/native/documentPicker';
import type { BillBook } from '../src/utils/recurringBills';
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('../src/services/billBookBackup', () => ({
  ...jest.requireActual('../src/services/billBookBackup'),
  billBookBackupService: {
    export: jest.fn(),
    preview: jest.fn(),
    restore: jest.fn(),
  },
}));
jest.mock('../src/native/documentPicker', () => ({
  localDocumentPicker: { pickBackupFile: jest.fn(), saveBase64File: jest.fn() },
}));
jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
  apiUploadRequest: jest.fn(),
}));
const scope = { userId: 588, server: 'https://backup-ui.invalid' };
const book: BillBook = {
  version: 1,
  bills: [
    {
      id: 'b1',
      label: 'Internet QA',
      cycle: 'MONTHLY',
      anchorDate: '2026-10-28',
      kind: 'FIXED',
      minAmount: 100000,
      maxAmount: 100000,
      currency: 'VND',
      note: '',
      paused: false,
      archived: false,
    },
  ],
  periods: [],
};
const fixture = billBackupPreview(
  scope,
  { ...book, bills: [] },
  JSON.stringify({
    format: 'SO_THU_CHI_NOVA_BILL_BOOK',
    version: 2,
    source: scope,
    createdAt: '2026-10-28T06:00:00.000Z',
    book,
  }),
);
const file = {
  uri: 'file:///bill.stcn-backup',
  name: 'bill.stcn-backup',
  type: 'application/octet-stream',
};
let renderer: TestRenderer.ReactTestRenderer;
let listeners: Array<(state: AppStateStatus) => void>;
const onRestored = jest.fn(async () => {});
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(n => typeof n.props.onPress === 'function')!
    .props.onPress();
const contents = () => JSON.stringify(renderer.toJSON());
const open = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <BillBookBackup scope={scope} onRestored={onRestored} />,
    );
  });
  await act(async () => press('Sao lưu và khôi phục lịch'));
};
const prepare = async () => {
  await open();
  await act(async () => {
    press('Chọn file sao lưu lịch');
  });
  await act(async () => press('Xem trước lịch trong file'));
};
const accept = () => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2] as Array<{
    text: string;
    onPress?: () => void;
  }>;
  return buttons.find(b => b.text === 'Khôi phục lịch')!.onPress!;
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
  (backup.export as jest.Mock).mockResolvedValue({
    filename: file.name,
    mimeType: file.type,
    base64: 'plain',
  });
  (backup.preview as jest.Mock).mockResolvedValue(fixture);
  (backup.restore as jest.Mock).mockResolvedValue(undefined);
  (picker.pickBackupFile as jest.Mock).mockResolvedValue(file);
  (picker.saveBase64File as jest.Mock).mockResolvedValue(file);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
it('exports readable file without password fields and guards a double tap', async () => {
  await open();
  expect(contents()).not.toContain('TextInput');
  await act(async () => {
    press('Lưu file lịch');
    press('Lưu file lịch');
  });
  expect(backup.export).toHaveBeenCalledTimes(1);
  expect(backup.export).toHaveBeenCalledWith(scope);
  expect(picker.saveBase64File).toHaveBeenCalledWith(
    file.name,
    file.type,
    'plain',
  );
  expect(contents()).toContain('Đã lưu');
});
it('shows local/file counts and preview but only restores after explicit confirmation; double tap stays single flight', async () => {
  await prepare();
  expect(contents()).toContain('Internet QA');
  expect(contents()).toContain('Thay toàn bộ');
  expect(backup.restore).not.toHaveBeenCalled();
  await act(async () => press('Khôi phục lịch từ file'));
  expect(backup.restore).not.toHaveBeenCalled(); // cancel by leaving the alert unanswered
  const confirm = accept();
  await act(async () => {
    confirm();
    confirm();
  });
  expect(backup.restore).toHaveBeenCalledTimes(1);
  expect(onRestored).toHaveBeenCalledTimes(1);
  expect(contents()).toContain('Đã khôi phục lịch');
});
it('invalidates pending confirmation when file changes, app backgrounds or screen unmounts', async () => {
  await prepare();
  await act(async () => press('Khôi phục lịch từ file'));
  const stale = accept();
  await act(async () => press('Chọn file sao lưu lịch'));
  await act(async () => stale());
  expect(backup.restore).not.toHaveBeenCalled();
  await act(async () => press('Xem trước lịch trong file'));
  await act(async () => press('Khôi phục lịch từ file'));
  const background = accept();
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => background());
  expect(backup.restore).not.toHaveBeenCalled();
  await act(async () => press('Xem trước lịch trong file'));
  await act(async () => press('Khôi phục lịch từ file'));
  const unmounted = accept();
  await act(async () => renderer.unmount());
  unmounted();
  expect(backup.restore).not.toHaveBeenCalled();
});
it('discards late preview after background, keeps original file on picker cancel and supports native picker backgrounding', async () => {
  await open();
  let resolvePicker!: (value: typeof file | null) => void;
  (picker.pickBackupFile as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePicker = resolve;
      }),
  );
  await act(async () => {
    press('Chọn file sao lưu lịch');
  });
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => {
    listeners.forEach(l => l('active'));
    resolvePicker(file);
  });
  expect(contents()).toContain(file.name);
  (picker.pickBackupFile as jest.Mock).mockResolvedValueOnce(null);
  await act(async () => press('Chọn file sao lưu lịch'));
  expect(contents()).toContain(file.name);
  let resolvePreview!: (value: typeof fixture) => void;
  (backup.preview as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePreview = resolve;
      }),
  );
  await act(async () => press('Xem trước lịch trong file'));
  await act(async () => listeners.forEach(l => l('background')));
  await act(async () => resolvePreview(fixture));
  expect(contents()).not.toContain('Internet QA');
  expect(backup.restore).not.toHaveBeenCalled();
});
it('retains preview on restore error so user can review, then retries without losing the local book', async () => {
  await prepare();
  (backup.restore as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => press('Khôi phục lịch từ file'));
  await act(async () => accept()());
  expect(contents()).toContain('Internet QA');
  expect(onRestored).not.toHaveBeenCalled();
  await act(async () => press('Khôi phục lịch từ file'));
  await act(async () => accept()());
  expect(onRestored).toHaveBeenCalledTimes(1);
});
