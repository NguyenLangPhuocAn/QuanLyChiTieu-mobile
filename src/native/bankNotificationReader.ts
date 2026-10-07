import { NativeModules, Platform } from 'react-native';
import type {
  BankNotificationEvent,
  LaunchableAndroidApp,
} from '../types/bankNotification';

type BankNotificationReaderNative = {
  isNotificationAccessGranted(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<boolean>;
  getLaunchableAppsJson(): Promise<string>;
  getPendingEventsJson(activeUser: string): Promise<string>;
  setConfiguration(activeUser: string | null, packages: string[]): Promise<boolean>;
  markProcessed(activeUser: string, eventId: string): Promise<boolean>;
  dismissEvent(activeUser: string, eventId: string): Promise<boolean>;
};

const nativeReader = NativeModules.BankNotificationReader as
  | BankNotificationReaderNative
  | undefined;

const requireAndroidReader = () => {
  if (Platform.OS !== 'android' || !nativeReader) {
    throw new Error('Đọc thông báo ngân hàng chỉ hỗ trợ trên Android.');
  }
  return nativeReader;
};

const parseJsonArray = <T>(value: string): T[] => {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
};

export const bankNotificationReader = {
  isSupported: Platform.OS === 'android' && Boolean(nativeReader),
  isNotificationAccessGranted: () =>
    requireAndroidReader().isNotificationAccessGranted(),
  openNotificationAccessSettings: () =>
    requireAndroidReader().openNotificationAccessSettings(),
  async getLaunchableApps() {
    return parseJsonArray<LaunchableAndroidApp>(
      await requireAndroidReader().getLaunchableAppsJson(),
    );
  },
  async getPendingEvents(userId: number) {
    return parseJsonArray<BankNotificationEvent>(
      await requireAndroidReader().getPendingEventsJson(String(userId)),
    );
  },
  setConfiguration: (userId: number | null, packages: string[]) =>
    requireAndroidReader().setConfiguration(
      userId === null ? null : String(userId),
      packages,
    ),
  markProcessed: (userId: number, eventId: string) =>
    requireAndroidReader().markProcessed(String(userId), eventId),
  dismissEvent: (userId: number, eventId: string) =>
    requireAndroidReader().dismissEvent(String(userId), eventId),
};
