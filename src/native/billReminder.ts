import { NativeModules, Platform } from 'react-native';
import type { BillScope } from '../services/recurringBills';
import type { BillBook } from '../utils/recurringBills';

export type BillReminderState = {
  enabled: boolean;
  hour: number;
  minute: number;
  permissionGranted: boolean;
  synced: boolean;
  nextAt: number | null;
};
type Bridge = {
  activate(owner: string | null): Promise<void>;
  sync(owner: string, book: string): Promise<void>;
  invalidate(owner: string): Promise<void>;
  getState(owner: string): Promise<string>;
  save(
    owner: string,
    enabled: boolean,
    hour: number,
    minute: number,
  ): Promise<string>;
  validatedLink(owner: string, url: string): Promise<string | null>;
};
const bridge = NativeModules.BillReminder as Bridge | undefined;
export const billReminderOwner = (scope: BillScope) =>
  `${scope.server.replace(/\/$/, '')}|${scope.userId}`;
export const billReminderPayload = (book: BillBook) =>
  JSON.stringify({
    version: 1,
    bills: book.bills.map(bill => ({
      id: bill.id,
      cycle: bill.cycle,
      anchorDate: bill.anchorDate,
      paused: bill.paused,
      archived: bill.archived,
      reminderEnabled: bill.reminderEnabled !== false,
    })),
    periods: book.periods.map(period => ({
      billId: period.billId,
      dueDate: period.dueDate,
      status: period.status,
    })),
  });
const requireBridge = () => {
  if (Platform.OS !== 'android' || !bridge)
    throw new Error('Cần bản Android hỗ trợ nhắc hóa đơn.');
  return bridge;
};
export const billReminder = {
  isSupported: Platform.OS === 'android' && Boolean(bridge),
  activate: (scope: BillScope | null) =>
    requireBridge().activate(scope ? billReminderOwner(scope) : null),
  sync: (scope: BillScope, book: BillBook) =>
    requireBridge().sync(billReminderOwner(scope), billReminderPayload(book)),
  invalidate: (scope: BillScope) =>
    requireBridge().invalidate(billReminderOwner(scope)),
  state: async (scope: BillScope): Promise<BillReminderState> =>
    JSON.parse(await requireBridge().getState(billReminderOwner(scope))),
  save: async (
    scope: BillScope,
    enabled: boolean,
    hour: number,
    minute: number,
  ): Promise<BillReminderState> =>
    JSON.parse(
      await requireBridge().save(
        billReminderOwner(scope),
        enabled,
        hour,
        minute,
      ),
    ),
  validatedLink: (scope: BillScope, url: string) =>
    requireBridge().validatedLink(billReminderOwner(scope), url),
};
