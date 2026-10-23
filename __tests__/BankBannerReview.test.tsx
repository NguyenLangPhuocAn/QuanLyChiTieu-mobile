import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import BankBannerReview from '../src/components/BankBannerReview';
import { bankScreenCapture } from '../src/native/bankScreenCapture';
import { bankScreenExtraction } from '../src/services/bankScreenExtraction';
jest.mock('../src/native/bankScreenCapture', () => ({
  bankScreenCapture: {
    recognize: jest.fn(),
    deleteCapture: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../src/services/bankScreenExtraction', () => ({
  ...jest.requireActual('../src/services/bankScreenExtraction'),
  bankScreenExtraction: { analyze: jest.fn() },
}));
let tree: TestRenderer.ReactTestRenderer;
const confirm = jest.fn();
const close = jest.fn();
const screen = {
  uri: 'file:///screen.png',
  width: 1080,
  height: 2400,
  capturedAt: Date.now(),
};
const crop = {
  uri: 'file:///crop.png',
  width: 1080,
  height: 400,
  sourceRef: 'a'.repeat(64),
  text: 'ACB: TK 87654321(VND) +752,790. Số dư 14,533,072 VND',
};
const button = (label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    )!;
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (bankScreenCapture.recognize as jest.Mock).mockResolvedValue(crop);
  await act(async () => {
    tree = TestRenderer.create(
      <BankBannerReview
        capture={screen}
        token="token"
        onClose={close}
        onConfirm={confirm}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

it('only reads the selected crop locally and waits for explicit draft confirmation', async () => {
  expect(bankScreenCapture.recognize).not.toHaveBeenCalled();
  await act(async () => button('Đọc vùng đã chọn').props.onPress());
  expect(bankScreenCapture.recognize).toHaveBeenCalledWith(
    screen.uri,
    expect.objectContaining({ top: 0.025, bottom: 0.35 }),
  );
  expect(bankScreenExtraction.analyze).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Điền banner vào bản nháp' })
      .props.onPress(),
  );
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({
      parsed: expect.objectContaining({ type: 'INCOME', amount: '752790' }),
    }),
  );
  expect(confirm.mock.calls[0][0].parsed.note).not.toMatch(
    /87654321|14,533,072/,
  );
});

it('does not call AI before the user accepts the sanitized-text disclosure', async () => {
  (bankScreenCapture.recognize as jest.Mock).mockResolvedValue({
    ...crop,
    text: 'TK 87654321 giao dịch 125.000 VND. Số dư 15.000.000 VND',
  });
  await act(async () => button('Đọc vùng đã chọn').props.onPress());
  await act(async () => button('Nhờ AI đọc phần chữ này').props.onPress());
  expect(bankScreenExtraction.analyze).not.toHaveBeenCalled();
  const disclosure = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Gửi phần chữ để phân tích?',
  );
  expect(disclosure[1]).not.toMatch(/87654321|15.000.000/);
  (bankScreenExtraction.analyze as jest.Mock).mockResolvedValue({
    status: 'REVIEW',
    transactionDate: '2026-10-23',
    note: '',
    reason: 'Chưa rõ chiều.',
  });
  await act(async () =>
    disclosure[2]
      .find((choice: { text: string }) => choice.text === 'Đồng ý gửi')
      .onPress(),
  );
  expect(bankScreenExtraction.analyze).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});

it('does not apply delayed OCR after closing the preview', async () => {
  let finish!: (result: typeof crop) => void;
  (bankScreenCapture.recognize as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => button('Đọc vùng đã chọn').props.onPress());
  await act(async () => {
    tree.unmount();
  });
  await act(async () => {
    finish(crop);
  });
  expect(confirm).not.toHaveBeenCalled();
  expect(bankScreenCapture.deleteCapture).toHaveBeenCalledWith(crop.uri);
});
