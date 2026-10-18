import { defaultFinancialReminderSettings } from '../../native/financialReminder';
import {
  formatReminderSchedule,
  reminderMessages,
  withReminderFrequency,
} from '../financialReminder';

describe('financialReminder', () => {
  it('uses privacy-safe copy without exposing an amount', () => {
    expect(
      Object.values(reminderMessages).every(message => !/\d/.test(message)),
    ).toBe(true);
  });

  it('changes the message with the selected frequency', () => {
    expect(
      withReminderFrequency(defaultFinancialReminderSettings, 'MONTHLY'),
    ).toMatchObject({
      frequency: 'MONTHLY',
      message: reminderMessages.MONTHLY,
    });
  });

  it('describes the next reminder schedule clearly', () => {
    expect(
      formatReminderSchedule({
        ...defaultFinancialReminderSettings,
        frequency: 'WEEKLY',
        hour: 20,
      }),
    ).toBe('Chủ nhật hằng tuần lúc 20:00');
  });
});
