import AsyncStorage from '@react-native-async-storage/async-storage';
import { financialCaptureInbox } from '../financialCaptureInbox';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

describe('financialCaptureInbox', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async key => storage.get(key) ?? null);
    setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  it('deduplicates a capture by its source key', async () => {
    const first = await financialCaptureInbox.enqueue(7, {
      source: 'VOICE',
      status: 'READY',
      dedupeKey: 'voice:message-12',
      title: 'Ăn trưa',
      transactionDraft: {
        type: 'EXPENSE',
        amount: 50_000,
        currency: 'VND',
        note: 'Ăn trưa',
        transaction_date: '2026-10-17',
        category_name: 'Ăn uống',
        wallet_name: null,
      },
    });
    const updated = await financialCaptureInbox.enqueue(7, {
      source: 'VOICE',
      status: 'NEEDS_REVIEW',
      dedupeKey: 'voice:message-12',
      title: 'Ăn trưa cần kiểm tra',
    });

    expect(updated.id).toBe(first.id);
    await expect(financialCaptureInbox.list(7)).resolves.toEqual([
      expect.objectContaining({
        id: first.id,
        status: 'NEEDS_REVIEW',
        title: 'Ăn trưa cần kiểm tra',
      }),
    ]);
  });

  it('keeps an Excel preview without importing money', async () => {
    await financialCaptureInbox.enqueue(7, {
      source: 'EXCEL',
      status: 'READY',
      dedupeKey: 'excel:file-hash',
      title: 'backup.xlsx',
      excel: {
        file: {
          uri: 'content://backup.xlsx',
          name: 'backup.xlsx',
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        preview: {
          fileHash: 'file-hash',
          totalRows: 3,
          ready: 2,
          duplicates: 1,
          invalid: 0,
          unsupported: 0,
          rows: [],
          warnings: [],
        },
      },
    });

    const [draft] = await financialCaptureInbox.list(7);
    expect(draft.excel?.preview.ready).toBe(2);
  });

  it('removes only the selected capture', async () => {
    const keep = await financialCaptureInbox.enqueue(7, {
      source: 'OCR',
      status: 'READY',
      dedupeKey: 'ocr:1',
      title: 'Hóa đơn 1',
    });
    const remove = await financialCaptureInbox.enqueue(7, {
      source: 'OCR',
      status: 'READY',
      dedupeKey: 'ocr:2',
      title: 'Hóa đơn 2',
    });

    await financialCaptureInbox.remove(7, remove.id);
    await expect(financialCaptureInbox.list(7)).resolves.toEqual([
      expect.objectContaining({ id: keep.id }),
    ]);
  });
});
