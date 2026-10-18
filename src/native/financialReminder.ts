import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type FinancialReminderFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type FinancialReminderSettings = {
  enabled: boolean;
  frequency: FinancialReminderFrequency;
  hour: number;
  minute: number;
  message: string;
};

type FinancialReminderNative = {
  getSettings(): Promise<FinancialReminderSettings>;
  saveSettings(
    enabled: boolean,
    frequency: FinancialReminderFrequency,
    hour: number,
    minute: number,
    message: string,
  ): Promise<FinancialReminderSettings>;
  showPreview(message: string): Promise<boolean>;
};

const nativeReminder = NativeModules.FinancialReminder as
  | FinancialReminderNative
  | undefined;

export const defaultFinancialReminderSettings: FinancialReminderSettings = {
  enabled: false,
  frequency: 'WEEKLY',
  hour: 20,
  minute: 0,
  message: 'Bạn đã kiểm tra ngân sách tuần này chưa?',
};

const requireReminder = () => {
  if (Platform.OS !== 'android' || !nativeReminder) {
    throw new Error('Nhắc tài chính ngoài ứng dụng chỉ hỗ trợ trên Android.');
  }
  return nativeReminder;
};

export const requestFinancialReminderPermission = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  return (
    (await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Cho phép nhắc tài chính',
        message: 'Sổ Thu Chi Nova cần quyền gửi lời nhắc mà bạn chủ động bật.',
        buttonPositive: 'Cho phép',
        buttonNegative: 'Để sau',
      },
    )) === PermissionsAndroid.RESULTS.GRANTED
  );
};

export const financialReminder = {
  isSupported: Platform.OS === 'android' && Boolean(nativeReminder),
  getSettings: () => requireReminder().getSettings(),
  saveSettings: (settings: FinancialReminderSettings) =>
    requireReminder().saveSettings(
      settings.enabled,
      settings.frequency,
      settings.hour,
      settings.minute,
      settings.message,
    ),
  showPreview: (message: string) => requireReminder().showPreview(message),
};
