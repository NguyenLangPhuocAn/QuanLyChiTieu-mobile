import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApiError,
  configureAuthSession,
  invalidateAuthSession,
  getApiBaseUrl,
} from '../services/api';
import { authService } from '../services/auth';
import type { AuthUser, ProfileUpdatePayload } from '../types/auth';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';
import { bankNotificationReader } from '../native/bankNotificationReader';
import { billReminderSession } from '../services/billReminderSession';
import { createSharedProvider } from './sharedProvider';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoringSession: boolean;
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isCurrencySetupRequired: boolean;
  sessionRestoreError: string | null;
  isOfflineSession: boolean;
  retryRestoreSession: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  uploadAvatar: (file: {
    uri: string;
    name: string;
    type: string;
  }) => Promise<void>;
  completeCurrencySetup: (payload: {
    currency_default: string;
    full_name: string;
    phone?: string;
  }) => Promise<void>;
  completePasswordSetup: (
    newPassword: string,
    confirmPassword: string,
  ) => Promise<void>;
  completeResetPassword: (
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = 'quan_ly_chi_tieu_auth_session';

type StoredAuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  user?: AuthUser | null;
  server?: string;
};

const AuthController = ({
  children,
  publish,
}: React.PropsWithChildren<{ publish: (value: AuthContextValue) => void }>) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isCurrencySetupRequired, setIsCurrencySetupRequired] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(
    null,
  );
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const retryRef = useRef<Promise<boolean> | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const accessTokenExpiresAtRef = useRef<number | null>(null);
  const sessionVersionRef = useRef(0);
  const mountedRef = useRef(true);
  const storageQueueRef = useRef(Promise.resolve());

  const persistSession = (value: string | null) => {
    storageQueueRef.current = storageQueueRef.current
      .catch(() => undefined)
      .then(() =>
        value === null
          ? AsyncStorage.removeItem(AUTH_STORAGE_KEY)
          : AsyncStorage.setItem(AUTH_STORAGE_KEY, value),
      )
      .catch(() => undefined);
  };

  const isCurrentSession = (version: number) =>
    mountedRef.current && version === sessionVersionRef.current;
  const assertCurrentSession = (version: number) => {
    if (!isCurrentSession(version))
      throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
  };

  const saveTokens = (next: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }) => {
    if (!mountedRef.current) return;
    const nextAccessToken = next.accessToken ?? next.token ?? null;
    const nextRefreshToken = next.refreshToken ?? refreshTokenRef.current;

    if (nextAccessToken) {
      tokenRef.current = nextAccessToken;
      accessTokenExpiresAtRef.current =
        Date.now() + (next.expiresIn ?? 600) * 1000;
      setToken(nextAccessToken);
    }

    if (nextRefreshToken) {
      refreshTokenRef.current = nextRefreshToken;
      setRefreshToken(nextRefreshToken);
    }

    persistSession(
      JSON.stringify({
        accessToken: tokenRef.current,
        refreshToken: refreshTokenRef.current,
        accessTokenExpiresAt: accessTokenExpiresAtRef.current,
        user: userRef.current,
        server: getApiBaseUrl(),
      } satisfies StoredAuthSession),
    );
  };

  const clearSession = () => {
    billReminderSession.set(null).catch(() => undefined);
    sessionVersionRef.current += 1;
    retryRef.current = null;
    invalidateAuthSession();
    tokenRef.current = null;
    refreshTokenRef.current = null;
    accessTokenExpiresAtRef.current = null;
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    userRef.current = null;
    setIsOfflineSession(false);
    setSessionRestoreError(null);
    setIsLoading(false);
    setIsCurrencySetupRequired(false);
    persistSession(null);
    if (bankNotificationReader.isSupported) {
      bankNotificationReader.setConfiguration(null, []).catch(() => undefined);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const version = sessionVersionRef.current;
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });

    configureAuthSession({
      getAccessToken: () => tokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      getAccessTokenExpiresAt: () => accessTokenExpiresAtRef.current,
      onTokens: saveTokens,
      onLogout: clearSession,
    });

    const restoreSession = async () => {
      try {
        const rawSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (!isCurrentSession(version)) return;

        if (!rawSession) {
          return;
        }

        const stored = JSON.parse(rawSession) as StoredAuthSession;

        if (stored.server && stored.server !== getApiBaseUrl()) {
          clearSession();
          return;
        }

        if (
          typeof stored?.accessToken !== 'string' ||
          !stored.accessToken ||
          (stored.refreshToken !== null &&
            typeof stored.refreshToken !== 'string') ||
          (stored.accessTokenExpiresAt !== null &&
            !Number.isFinite(stored.accessTokenExpiresAt))
        ) {
          clearSession();
          return;
        }

        tokenRef.current = stored.accessToken;
        refreshTokenRef.current = stored.refreshToken;
        accessTokenExpiresAtRef.current = stored.accessTokenExpiresAt;
        setToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
        // A previously verified profile opens local data while the API revalidates.
        // A first login still needs the server; cached data grants no API authority.
        if (
          stored.server === getApiBaseUrl() &&
          stored.user &&
          Number.isSafeInteger(stored.user.id) &&
          stored.user.id > 0 &&
          typeof stored.user.email === 'string' &&
          stored.user.profile_setup_completed &&
          !stored.user.must_change_password
        ) {
          userRef.current = stored.user;
          setUser(stored.user);
          setIsOfflineSession(true);
          setIsLoading(false);
          setIsRestoringSession(false);
        }
        await hydrateUser(stored.accessToken, version);
      } catch (error) {
        if (isCurrentSession(version)) {
          if (
            !tokenRef.current ||
            error instanceof SyntaxError ||
            (error instanceof ApiError && [401, 403].includes(error.status))
          )
            clearSession();
          else if (userRef.current) setIsOfflineSession(true);
          else
            setSessionRestoreError(
              'Chưa kết nối được máy chủ để tải tài khoản. Kiểm tra mạng rồi thử lại.',
            );
        }
      } finally {
        if (isCurrentSession(version)) {
          setIsLoading(false);
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      mountedRef.current = false;
      sessionVersionRef.current += 1;
      configureAuthSession(null);
    };
    // hydrateUser is stable for this bootstrapping effect; adding it would recreate the restore flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateUser = async (
    nextToken: string,
    version = sessionVersionRef.current,
  ) => {
    const profile = await authService.getProfile(nextToken);
    assertCurrentSession(version);
    setUser(profile);
    userRef.current = profile;
    setIsOfflineSession(false);
    setSessionRestoreError(null);
    persistSession(
      JSON.stringify({
        accessToken: tokenRef.current,
        refreshToken: refreshTokenRef.current,
        accessTokenExpiresAt: accessTokenExpiresAtRef.current,
        user: profile,
        server: getApiBaseUrl(),
      } satisfies StoredAuthSession),
    );

    setIsCurrencySetupRequired(!profile.profile_setup_completed);
  };

  const performRestoreRetry = async () => {
    const version = sessionVersionRef.current;
    const currentToken = tokenRef.current;
    if (!currentToken) {
      clearSession();
      return false;
    }
    if (!userRef.current) setIsLoading(true);
    setSessionRestoreError(null);
    try {
      await hydrateUser(currentToken, version);
      return true;
    } catch (error) {
      if (isCurrentSession(version)) {
        if (error instanceof ApiError && [401, 403].includes(error.status))
          clearSession();
        else if (userRef.current) setIsOfflineSession(true);
        else
          setSessionRestoreError(
            'Chưa kết nối được máy chủ để tải tài khoản. Kiểm tra mạng rồi thử lại.',
          );
      }
      return false;
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const retryRestoreSession = () => {
    if (!retryRef.current) {
      const pending = performRestoreRetry().finally(() => {
        if (retryRef.current === pending) retryRef.current = null;
      });
      retryRef.current = pending;
    }
    return retryRef.current;
  };

  const signIn = async (email: string, password: string) => {
    clearSession();
    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      assertCurrentSession(version);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token, version);
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    confirmPassword: string,
  ) => {
    clearSession();
    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      await authService.register(email, password, confirmPassword);
      assertCurrentSession(version);
      const response = await authService.login(email, password);
      assertCurrentSession(version);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token, version);
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (
      !GOOGLE_WEB_CLIENT_ID ||
      GOOGLE_WEB_CLIENT_ID.includes('YOUR_WEB_CLIENT_ID')
    ) {
      throw new Error(
        'Đăng nhập Google chưa sẵn sàng. Vui lòng dùng email và mật khẩu.',
      );
    }

    clearSession();
    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      assertCurrentSession(version);
      await GoogleSignin.signOut().catch(() => undefined);
      assertCurrentSession(version);
      const result = await GoogleSignin.signIn();
      assertCurrentSession(version);
      const idToken = result.data?.idToken;

      if (!idToken) {
        console.warn(
          'Google Sign-In did not return idToken. Check GOOGLE_WEB_CLIENT_ID.',
        );
        throw new Error(
          'Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.',
        );
      }

      const response = await authService.loginWithGoogle(idToken);
      assertCurrentSession(version);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token, version);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }

      if (code === statusCodes.IN_PROGRESS) {
        throw new Error(
          'Đăng nhập Google đang được xử lý. Vui lòng chờ một chút.',
        );
      }

      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          'Google Play Services chưa sẵn sàng. Vui lòng cập nhật rồi thử lại.',
        );
      }

      console.warn('Google Sign-In failed', error);
      throw new Error(
        'Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.',
      );
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };
  const updateProfile = async (payload: ProfileUpdatePayload) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(
        tokenRef.current,
        payload,
      );
      assertCurrentSession(version);
      setUser(updatedUser);
      userRef.current = updatedUser;
      saveTokens({});
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const uploadAvatar = async (file: {
    uri: string;
    name: string;
    type: string;
  }) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const updatedUser = await authService.uploadAvatar(
        tokenRef.current,
        file,
      );
      assertCurrentSession(version);
      setUser(updatedUser);
      userRef.current = updatedUser;
      saveTokens({});
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }
    await hydrateUser(tokenRef.current);
  };

  const completeCurrencySetup = async (payload: {
    currency_default: string;
    full_name: string;
    phone?: string;
  }) => {
    if (!tokenRef.current || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(tokenRef.current, {
        currency_default: payload.currency_default,
        full_name: payload.full_name,
        phone: payload.phone,
        profile_setup_completed: true,
      });
      assertCurrentSession(version);
      setUser(updatedUser);
      userRef.current = updatedUser;
      saveTokens({});
      setIsCurrencySetupRequired(false);
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const completePasswordSetup = async (
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const response = await authService.completePasswordSetup(
        tokenRef.current,
        newPassword,
        confirmPassword,
      );
      assertCurrentSession(version);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token, version);
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const completeResetPassword = async (
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    clearSession();
    const version = sessionVersionRef.current;
    setIsLoading(true);

    try {
      const response = await authService.resetPassword(
        resetToken,
        newPassword,
        confirmPassword,
      );
      assertCurrentSession(version);
      saveTokens(response);

      if (response.user) {
        setUser(response.user);
        userRef.current = response.user;
        saveTokens({});
        setIsCurrencySetupRequired(!response.user.profile_setup_completed);
        return;
      }

      await hydrateUser(response.accessToken ?? response.token, version);
    } finally {
      if (isCurrentSession(version)) setIsLoading(false);
    }
  };

  const signOut = () => {
    const currentToken = tokenRef.current;
    const currentRefreshToken = refreshTokenRef.current;

    clearSession();

    if (currentToken) {
      authService
        .logout(currentToken, currentRefreshToken)
        .catch(() => undefined);
    }
  };

  const value: AuthContextValue = {
    isAuthenticated: Boolean(user && token),
    isLoading,
    isRestoringSession,
    user,
    token,
    refreshToken,
    isCurrencySetupRequired,
    sessionRestoreError,
    isOfflineSession,
    retryRestoreSession,
    signIn,
    signUp,
    signInWithGoogle,
    updateProfile,
    refreshProfile,
    uploadAvatar,
    completeCurrencySetup,
    completePasswordSetup,
    completeResetPassword,
    signOut,
  };
  useLayoutEffect(() => {
    publish(value);
  });
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider = createSharedProvider(AuthContext, AuthController);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
