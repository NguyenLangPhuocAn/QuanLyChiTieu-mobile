import type {
  FinancialReminderFrequency,
  FinancialReminderSettings,
} from '../native/financialReminder';

export const reminderMessages: Record<FinancialReminderFrequency, string> = {
  DAILY: 'Hôm nay bạn đã ghi đủ các khoản thu chi chưa?',
  WEEKLY: 'Bạn đã kiểm tra ngân sách tuần này chưa?',
  MONTHLY: 'Tiền lương tháng này còn đủ cho các khoản sắp tới không?',
};

export const withReminderFrequency = (
  current: FinancialReminderSettings,
  frequency: FinancialReminderFrequency,
): FinancialReminderSettings => ({
  ...current,
  frequency,
  message: reminderMessages[frequency],
});

export const formatReminderSchedule = (settings: FinancialReminderSettings) => {
  const time = `${String(settings.hour).padStart(2, '0')}:${String(
    settings.minute,
  ).padStart(2, '0')}`;
  if (settings.frequency === 'DAILY') return `Mỗi ngày lúc ${time}`;
  if (settings.frequency === 'MONTHLY') return `Ngày 25 hằng tháng lúc ${time}`;
  return `Chủ nhật hằng tuần lúc ${time}`;
};
