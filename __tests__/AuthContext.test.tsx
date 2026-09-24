import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { authService } from '../src/services/auth';
import * as api from '../src/services/api';
import type { AuthUser } from '../src/types/auth';

jest.mock('../src/services/auth', () => ({
  authService: {
    login: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn().mockResolvedValue({}),
    updateProfile: jest.fn(),
  },
}));
const profile: AuthUser = {
  id: 1,
  email: 'one@example.test',
  role: 'BASIC',
  wallet_count: 0,
  profile_setup_completed: true,
};
const login = {
  message: 'ok',
  token: 'initial',
  accessToken: 'initial',
  refreshToken: 'refresh',
  expiresIn: 600,
};
let current!: ReturnType<typeof useAuth>;
const Probe = () => {
  current = useAuth();
  return null;
};
let renderer: ReactTestRenderer.ReactTestRenderer;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('quan_ly_chi_tieu_auth_session');
  jest.mocked(authService.login).mockResolvedValue(login);
  jest.mocked(authService.getProfile).mockResolvedValue(profile);
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  jest.restoreAllMocks();
});

it('does not resurrect a login that finishes after sign out', async () => {
  let resolve!: (value: typeof login) => void;
  jest.mocked(authService.login).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  let pending!: Promise<void>;
  let rejected!: Promise<void>;
  await act(async () => {
    pending = current.signIn('one@example.test', 'password');
    rejected = pending.catch(() => undefined);
  });
  await act(() => current.signOut());
  await act(async () => {
    resolve(login);
    await rejected;
  });
  expect(current.user).toBeNull();
  expect(current.token).toBeNull();
  expect(
    await AsyncStorage.getItem('quan_ly_chi_tieu_auth_session'),
  ).toBeNull();
});

it('does not restore an older access token after profile loading refreshes it', async () => {
  // Remount with a spy so the test can simulate the real API refresh callback.
  await act(() => renderer.unmount());
  const configure = jest.spyOn(api, 'configureAuthSession');
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  jest.mocked(authService.getProfile).mockImplementationOnce(async () => {
    configure.mock.calls.at(-1)?.[0]?.onTokens({
      accessToken: 'renewed',
      refreshToken: 'renewed-refresh',
      expiresIn: 600,
    });
    return profile;
  });
  await act(async () => current.signIn('one@example.test', 'password'));
  expect(current.token).toBe('renewed');
  expect(current.refreshToken).toBe('renewed-refresh');
});

it('ignores an old profile update after switching accounts', async () => {
  await act(async () => current.signIn('one@example.test', 'password'));
  let resolve!: (value: AuthUser) => void;
  jest.mocked(authService.updateProfile).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  let settled!: Promise<void>;
  await act(async () => {
    settled = current
      .updateProfile({ full_name: 'Old' })
      .catch(() => undefined);
  });
  await act(() => current.signOut());
  jest
    .mocked(authService.getProfile)
    .mockResolvedValueOnce({ ...profile, id: 2 });
  await act(async () => current.signIn('two@example.test', 'password'));
  await act(async () => {
    resolve({ ...profile, full_name: 'Old' });
    await settled;
  });
  expect(current.user?.id).toBe(2);
});

it('keeps a stored session during a server outage and restores it on retry', async () => {
  await act(() => renderer.unmount());
  const stored = JSON.stringify({
    accessToken: 'saved',
    refreshToken: 'saved-refresh',
    accessTokenExpiresAt: Date.now() + 600000,
  });
  await AsyncStorage.setItem('quan_ly_chi_tieu_auth_session', stored);
  jest
    .mocked(authService.getProfile)
    .mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  expect(current.sessionRestoreError).toContain('Chưa kết nối');
  expect(current.user).toBeNull();
  expect(await AsyncStorage.getItem('quan_ly_chi_tieu_auth_session')).toBe(
    stored,
  );
  await act(async () => current.retryRestoreSession());
  expect(current.sessionRestoreError).toBeNull();
  expect(current.user?.id).toBe(1);
  expect(current.token).toBe('saved');
});
