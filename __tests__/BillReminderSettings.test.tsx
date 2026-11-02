import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import BillReminderSettings from '../src/components/BillReminderSettings';
import { billReminder } from '../src/native/billReminder';
import { requestFinancialReminderPermission } from '../src/native/financialReminder';
jest.setTimeout(20000);
jest.mock('../src/native/billReminder', () => ({
  billReminder: { isSupported: true, state: jest.fn(), save: jest.fn() },
}));
jest.mock('../src/native/financialReminder', () => ({
  requestFinancialReminderPermission: jest.fn(),
}));
jest.mock('../src/services/billReminderSession', () => ({
  billReminderSession: { sync: jest.fn(async () => {}) },
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
const scope = { userId: 8, server: 'https://qa.invalid' };
const state = {
  enabled: false,
  hour: 20,
  minute: 0,
  permissionGranted: true,
  synced: true,
  nextAt: null,
};
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(billReminder.state).mockResolvedValue(state);
  jest.mocked(requestFinancialReminderPermission).mockResolvedValue(true);
  jest
    .mocked(billReminder.save)
    .mockImplementation(async (_, enabled, hour, minute) => ({
      ...state,
      enabled,
      hour,
      minute,
    }));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <BillReminderSettings
        scope={scope}
        book={{ version: 1, bills: [], periods: [] }}
      />,
    );
  });
};
const toggle = (enabled: boolean) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: 'Bật nhắc hóa đơn' })
    .find(node => node.props.onValueChange)!
    .props.onValueChange(enabled);
it('requires explicit opt-in and saves the selected account only', async () => {
  await mount();
  expect(billReminder.save).not.toHaveBeenCalled();
  await act(async () => toggle(true));
  expect(billReminder.save).toHaveBeenCalledWith(scope, true, 20, 0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Giờ nhắc');
});
it('shows the next reminder as a date without exposing an hour or battery note', async () => {
  jest.mocked(billReminder.state).mockResolvedValue({
    ...state,
    enabled: true,
    nextAt: new Date(2027, 3, 27, 20, 0).getTime(),
  });
  await mount();
  const content = JSON.stringify(renderer.toJSON());
  expect(content).toContain('Ngày nhắc tới');
  expect(content).not.toContain('20:00');
  expect(content).not.toContain('tiết kiệm pin');
});
it('does not enable reminders when permission is denied', async () => {
  jest.mocked(requestFinancialReminderPermission).mockResolvedValue(false);
  await mount();
  await act(async () => toggle(true));
  expect(billReminder.save).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Chưa có quyền thông báo',
  );
});
it('allows disabling without asking for permission', async () => {
  jest
    .mocked(billReminder.state)
    .mockResolvedValue({ ...state, enabled: true, permissionGranted: false });
  await mount();
  await act(async () => toggle(false));
  expect(requestFinancialReminderPermission).not.toHaveBeenCalled();
  expect(billReminder.save).toHaveBeenCalledWith(scope, false, 20, 0);
});
