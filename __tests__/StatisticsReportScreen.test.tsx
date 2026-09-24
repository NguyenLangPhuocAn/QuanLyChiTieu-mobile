import React from 'react';
import { Alert, Modal } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import StatisticsScreen from '../src/screens/home/StatisticsScreen';
import { statisticsService } from '../src/services/statistics';
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'test',
    user: { id: 1, email: 'owner@example.com', role: 'PREMIUM' },
  }),
}));
jest.mock('../src/context/FinanceContext', () => {
  const transactions: unknown[] = [];
  return { useFinance: () => ({ transactions, preferredCurrency: 'VND' }) };
});
jest.mock('../src/services/statistics', () => ({
  statisticsService: {
    get: jest.fn().mockRejectedValue(new Error('offline')),
    sendExcelReport: jest.fn(),
    exportReport: jest.fn(),
  },
}));
const service = jest.mocked(statisticsService);
let renderer: TestRenderer.ReactTestRenderer;
const field = (label: string) =>
  renderer.root.findByProps({ accessibilityLabel: label });
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    renderer = TestRenderer.create(
      <StatisticsScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ params: {} } as never}
      />,
    );
  });
  await act(async () => {
    await field('Mở gửi báo cáo Excel').props.onPress();
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
it('rejects an invalid email without submitting', async () => {
  await act(async () => {
    field('Email nhận báo cáo').props.onChangeText('bad');
  });
  await act(async () => {
    await field('Gửi báo cáo Excel').props.onPress();
  });
  expect(service.sendExcelReport).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Email chưa hợp lệ',
    expect.any(String),
  );
});
it('sends once and keeps the modal open while the report is pending', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof statisticsService.sendExcelReport>>,
  ) => void;
  service.sendExcelReport.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  let pending!: Promise<unknown>;
  await act(async () => {
    const send = field('Gửi báo cáo Excel').props.onPress;
    pending = send();
    await send();
  });
  expect(service.sendExcelReport).toHaveBeenCalledTimes(1);
  const modal = renderer.root.findByType(Modal);
  await act(async () => {
    modal.props.onRequestClose();
  });
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => {
    resolve({
      message: 'Đã tiếp nhận',
      filename: 'report.xlsx',
      mail: { accepted: true, delivered: false, devOnly: false },
    });
    await pending;
  });
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
});
it('does not claim email was sent when an older backend returns dev-only', async () => {
  service.sendExcelReport.mockResolvedValue({
    message: 'dev',
    filename: 'report.xlsx',
    mail: { delivered: false, devOnly: true },
  });
  await act(async () => {
    await field('Gửi báo cáo Excel').props.onPress();
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa gửi báo cáo',
    expect.any(String),
  );
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
});
