import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ProfileScreen from '../src/screens/home/ProfileScreen';
import { authService } from '../src/services/auth';

const mockUpdateProfile = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/utils/avatar', () => ({ resolveAvatarUrl: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'test', isLoading: false,
    user: { full_name: 'Nguyễn An', phone: '0901234567', address: 'Hà Nội', birthday: '2003-02-12', currency_default: 'VND' },
    updateProfile: mockUpdateProfile, signOut: jest.fn(), uploadAvatar: jest.fn(),
  }),
}));
jest.mock('../src/services/auth', () => ({ authService: { changePassword: jest.fn() } }));
let renderer: TestRenderer.ReactTestRenderer;
const goBack = jest.fn();
const field = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUpdateProfile.mockResolvedValue({});
  await act(async () => {
    renderer = TestRenderer.create(<ProfileScreen navigation={{ goBack, setParams: jest.fn() } as never} route={{ params: {} } as never} />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('sends explicit nulls to clear saved optional fields and saves once for two immediate taps', async () => {
  await act(async () => {
    field('Số điện thoại hồ sơ').props.onChangeText('');
    field('Địa chỉ hồ sơ').props.onChangeText('  ');
    field('Xóa ngày sinh').props.onPress();
  });
  await act(async () => {
    const save = field('Lưu hồ sơ').props.onPress;
    await Promise.all([save(), save()]);
  });
  expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: 'Nguyễn An', phone: null, address: null, birthday: null, currency_default: 'VND' });
  expect(goBack).toHaveBeenCalledTimes(1);
});

it('keeps edited data available when saving fails and allows a retry', async () => {
  mockUpdateProfile.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await act(async () => { await field('Lưu hồ sơ').props.onPress(); });
  expect(goBack).not.toHaveBeenCalled();
  expect(field('Số điện thoại hồ sơ').props.value).toBe('0901234567');
  await act(async () => { await field('Lưu hồ sơ').props.onPress(); });
  expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
  expect(goBack).toHaveBeenCalledTimes(1);
});

it('changes the password once for two immediate taps', async () => {
  jest.mocked(authService.changePassword).mockResolvedValue({ message: 'Đã đổi mật khẩu' });
  await act(async () => { field('Mở đổi mật khẩu').props.onPress(); });
  await act(async () => {
    field('Mật khẩu hiện tại').props.onChangeText('OldTest123');
    field('Mật khẩu mới').props.onChangeText('NewTest456');
    field('Xác nhận mật khẩu mới').props.onChangeText('NewTest456');
  });
  await act(async () => {
    const save = field('Lưu mật khẩu mới').props.onPress;
    await Promise.all([save(), save()]);
  });
  expect(authService.changePassword).toHaveBeenCalledTimes(1);
  expect(authService.changePassword).toHaveBeenCalledWith('test', { oldPassword: 'OldTest123', newPassword: 'NewTest456', confirmPassword: 'NewTest456' });
});
