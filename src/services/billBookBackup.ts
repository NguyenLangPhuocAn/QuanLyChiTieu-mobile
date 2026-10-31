import RNFS from 'react-native-fs';
import type { PickedDocument } from '../native/documentPicker';
import { parseBillBook, type BillScope } from './recurringBills';
import type { BillBook } from '../utils/recurringBills';
import { planningLocalStore } from './planningLocalStore';
import { parseMoneyPlans } from './moneyCalendarPlans';
import { replacePlanningSnapshot, snapshotOf } from './planningSnapshot';
import type { MoneyPlan } from '../utils/moneyCalendar';
const format = 'SO_THU_CHI_NOVA_BILL_BOOK';
export type BillBackupPreview = {
  createdAt: string;
  text: string;
  expected: string;
  book: BillBook;
  currentCount: { bills: number; periods: number };
  plans: MoneyPlan[] | null;
  expectedPlans: string;
  currentPlanCount: number;
};
const boundedBook = (value: unknown) => {
  const json = JSON.stringify(value);
  if (!json || json.length > 256 * 1024)
    throw new Error(
      'File lịch quá lớn hoặc chưa hợp lệ. Giữ nguyên dữ liệu trên máy.',
    );
  const book = parseBillBook(json);
  if (
    book.bills.length > 1000 ||
    book.periods.length > 5000 ||
    (book.suggestions?.length ?? 0) > 2000 ||
    (book.reviewedAlerts?.length ?? 0) > 2000 ||
    book.bills.some(b => b.id.length > 256)
  )
    throw new Error(
      'File vượt giới hạn lịch hỗ trợ. Dữ liệu trên máy được giữ nguyên.',
    );
  return book;
};
// Base64 transports UTF-8 bytes to Android SAF. The saved file is ordinary JSON.
export const encodeBackupBase64 = (text: string) => {
  const bytes = encodeURIComponent(text).replace(
    /%([0-9A-F]{2})/g,
    (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)),
  );
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes.charCodeAt(i),
      b = bytes.charCodeAt(i + 1),
      c = bytes.charCodeAt(i + 2);
    result +=
      alphabet[Math.floor(a / 4)] +
      alphabet[(a % 4) * 16 + (Number.isNaN(b) ? 0 : Math.floor(b / 16))] +
      (Number.isNaN(b)
        ? '='
        : alphabet[(b % 16) * 4 + (Number.isNaN(c) ? 0 : Math.floor(c / 64))]) +
      (Number.isNaN(c) ? '=' : alphabet[c % 64]);
  }
  return result;
};
export const billBackupPreview = (
  scope: BillScope,
  current: BillBook,
  text: string,
  currentPlans: MoneyPlan[] = [],
): BillBackupPreview => {
  if (typeof text !== 'string' || text.length > 512 * 1024)
    throw new Error('File lịch quá lớn.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File lịch không phải JSON hợp lệ.');
  }
  if (
    data?.format !== format ||
    ![2, 3].includes(data.version) ||
    typeof data.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt))
  )
    throw new Error('File không phải bản sao lưu lịch hỗ trợ.');
  if (
    data.source?.userId !== scope.userId ||
    data.source.server !== scope.server.replace(/\/$/, '')
  )
    throw new Error(
      'File thuộc tài khoản hoặc máy chủ khác. Hãy chọn đúng nơi trước khi khôi phục.',
    );
  return {
    createdAt: data.createdAt,
    text,
    expected: JSON.stringify(current),
    book: boundedBook(data.book),
    plans:
      data.version === 3 ? parseMoneyPlans(JSON.stringify(data.plans)) : null,
    expectedPlans: JSON.stringify(currentPlans),
    currentPlanCount: currentPlans.length,
    currentCount: {
      bills: current.bills.length,
      periods: current.periods.length,
    },
  };
};
const readFile = async (file: PickedDocument) => {
  const stat = await RNFS.stat(file.uri);
  if (Number(stat.size) > 512 * 1024)
    throw new Error('File lịch vượt quá 512 KB.');
  return RNFS.readFile(file.uri, 'utf8');
};
export const billBookBackupService = {
  async export(scope: BillScope) {
    const snapshot = snapshotOf(await planningLocalStore.read(scope));
    const book = boundedBook(snapshot.book),
      createdAt = new Date().toISOString();
    const text = JSON.stringify({
      format,
      version: 3,
      source: { userId: scope.userId, server: scope.server.replace(/\/$/, '') },
      createdAt,
      book,
      plans: snapshot.plans,
    });
    const base64 = encodeBackupBase64(text);
    if (base64.length > Math.ceil((512 * 1024) / 3) * 4)
      throw new Error(
        'File lịch vượt quá 512 KB. Dữ liệu trên máy được giữ nguyên.',
      );
    return {
      filename: `nova-lich-tien-${createdAt.slice(0, 10)}.stcn-backup`,
      mimeType: 'application/json',
      base64,
    };
  },
  async preview(scope: BillScope, file: PickedDocument) {
    const current = snapshotOf(await planningLocalStore.read(scope));
    return billBackupPreview(
      scope,
      current.book,
      await readFile(file),
      current.plans,
    );
  },
  async restore(
    scope: BillScope,
    file: PickedDocument,
    preview: BillBackupPreview,
    isCurrent: () => boolean,
  ) {
    if (!isCurrent()) throw new Error('Hãy xem trước lại file.');
    const text = await readFile(file),
      checked = billBackupPreview(
        scope,
        parseBillBook(preview.expected),
        text,
        parseMoneyPlans(preview.expectedPlans),
      );
    if (text !== preview.text)
      throw new Error('File đã thay đổi. Hãy xem trước lại.');
    await planningLocalStore.update(
      scope,
      state => {
        const current = snapshotOf(state);
        if (
          JSON.stringify(current.book) !== preview.expected ||
          (checked.plans !== null &&
            JSON.stringify(current.plans) !== preview.expectedPlans)
        )
          throw Error(
            'Lịch trên máy đã thay đổi. Hãy xem trước lại trước khi khôi phục.',
          );
        replacePlanningSnapshot(
          state,
          {
            version: 1,
            book: checked.book,
            plans: checked.plans ?? current.plans,
          },
          false,
        );
      },
      isCurrent,
    );
  },
};
