import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import NotificationSettingsScreen from '../src/screens/home/NotificationSettingsScreen';
import { bankAiConsent } from '../src/services/bankAiConsent';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'qa', user: { id: 71 } }),
}));
jest.mock('../src/services/notifications', () => ({
  notificationsService: {
    getSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn(),
  },
}));
jest.mock('../src/native/financialReminder', () => ({
  financialReminder: { isSupported: false },
  defaultFinancialReminderSettings: { enabled: false },
  requestFinancialReminderPermission: jest.fn(),
}));
jest.mock('../src/services/bankAiConsent', () => ({
  bankAiConsent: { reset: jest.fn().mockResolvedValue(undefined) },
}));

it('moves AI consent reset to notification settings and requires confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <NotificationSettingsScreen navigation={{ goBack: jest.fn() } as never} route={{} as never} />,
    );
  });
  const resetButton = renderer.root.findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === 'Đặt lại quyền AI đọc thông báo');
  expect(resetButton).toBeDefined();
  await act(async () => resetButton!.props.onPress());
  expect(bankAiConsent.reset).not.toHaveBeenCalled();
  const choices = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
  await act(async () => choices.find(choice => choice.text === 'Đặt lại')!.onPress!());
  expect(bankAiConsent.reset).toHaveBeenCalledWith(71);
  await act(async () => renderer.unmount());
  alert.mockRestore();
});
