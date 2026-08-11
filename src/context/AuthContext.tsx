import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureAuthSession } from '../services/api';
import { authService } from '../services/auth';
import type { AuthUser } from '../types/auth';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isCurrencySetupRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, confirmPassword: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (payload: {
    full_name?: string;
    phone?: string;
    address?: string;
    birthday?: string;
    currency_default?: string;
  }) => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  uploadAvatar: (file: { uri: string; name: string; type: string }) => Promise<void>;
  completeCurrencySetup: (payload: {
    currency_default: string;
    full_name: string;
    phone?: string;
  }) => Promise<void>;
  completePasswordSetup: (newPassword: string, confirmPassword: string) => Promise<void>;
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
};

export const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrencySetupRequired, setIsCurrencySetupRequired] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const accessTokenExpiresAtRef = useRef<number | null>(null);

  const saveTokens = (next: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }) => {
    const nextAccessToken = next.accessToken ?? next.token ?? null;
    const nextRefreshToken = next.refreshToken ?? refreshTokenRef.current;

    if (nextAccessToken) {
      tokenRef.current = nextAccessToken;
      accessTokenExpiresAtRef.current = Date.now() + (next.expiresIn ?? 600) * 1000;
      setToken(nextAccessToken);
    }

    if (nextRefreshToken) {
      refreshTokenRef.current = nextRefreshToken;
      setRefreshToken(nextRefreshToken);
    }

    AsyncStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: tokenRef.current,
        refreshToken: refreshTokenRef.current,
        accessTokenExpiresAt: accessTokenExpiresAtRef.current,
      } satisfies StoredAuthSession),
    ).catch(() => undefined);
  };

  const clearSession = () => {
    tokenRef.current = null;
    refreshTokenRef.current = null;
    accessTokenExpiresAtRef.current = null;
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsCurrencySetupRequired(false);
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);
  };

  useEffect(() => {
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

        if (!rawSession) {
          return;
        }

        const stored = JSON.parse(rawSession) as StoredAuthSession;

        if (!stored.accessToken) {
          return;
        }

        tokenRef.current = stored.accessToken;
        refreshTokenRef.current = stored.refreshToken;
        accessTokenExpiresAtRef.current = stored.accessTokenExpiresAt;
        setToken(stored.accessToken);
        setRefreshToken(stored.refreshToken);
        await hydrateUser(stored.accessToken);
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    return () => configureAuthSession(null);
    // hydrateUser is stable for this bootstrapping effect; adding it would recreate the restore flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateUser = async (nextToken: string) => {
    const profile = await authService.getProfile(nextToken);
    tokenRef.current = nextToken;
    accessTokenExpiresAtRef.current = Date.now() + 600 * 1000;
    setToken(nextToken);
    setUser(profile);
    saveTokens({ accessToken: nextToken, refreshToken: refreshTokenRef.current ?? undefined });

    setIsCurrencySetupRequired(!profile.profile_setup_completed);
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);

    try {
      await authService.register(email, password, confirmPassword);
      const response = await authService.login(email, password);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!GOOGLE_WEB_CLIENT_ID || GOOGLE_WEB_CLIENT_ID.includes('YOUR_WEB_CLIENT_ID')) {
      throw new Error('Đăng nhập Google chưa sẵn sàng. Vui lòng dùng email và mật khẩu.');
    }

    setIsLoading(true);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      await GoogleSignin.signOut().catch(() => undefined);
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;

      if (!idToken) {
        console.warn('Google Sign-In did not return idToken. Check GOOGLE_WEB_CLIENT_ID.');
        throw new Error('Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.');
      }

      const response = await authService.loginWithGoogle(idToken);
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }

      if (code === statusCodes.IN_PROGRESS) {
        throw new Error('Đăng nhập Google đang được xử lý. Vui lòng chờ một chút.');
      }

      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services chưa sẵn sàng. Vui lòng cập nhật rồi thử lại.');
      }

      console.warn('Google Sign-In failed', error);
      throw new Error('Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc dùng email và mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };
  const updateProfile = async (payload: {
    full_name?: string;
    phone?: string;
    address?: string;
    birthday?: string;
    currency_default?: string;
  }) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(tokenRef.current, payload);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadAvatar = async (file: { uri: string; name: string; type: string }) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.uploadAvatar(tokenRef.current, file);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeToPremium = async () => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.upgradeToPremium(tokenRef.current);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const completeCurrencySetup = async (payload: {
    currency_default: string;
    full_name: string;
    phone?: string;
  }) => {
    if (!tokenRef.current || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(tokenRef.current, {
        currency_default: payload.currency_default,
        full_name: payload.full_name,
        phone: payload.phone,
        profile_setup_completed: true,
      });
      setUser(updatedUser);
      setIsCurrencySetupRequired(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completePasswordSetup = async (newPassword: string, confirmPassword: string) => {
    if (!tokenRef.current) {
      throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const response = await authService.completePasswordSetup(
        tokenRef.current,
        newPassword,
        confirmPassword,
      );
      saveTokens(response);
      await hydrateUser(response.accessToken ?? response.token);
    } finally {
      setIsLoading(false);
    }
  };

  const completeResetPassword = async (
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    setIsLoading(true);

    try {
      const response = await authService.resetPassword(
        resetToken,
        newPassword,
        confirmPassword,
      );
      saveTokens(response);

      if (response.user) {
        setUser(response.user);
        setIsCurrencySetupRequired(!response.user.profile_setup_completed);
        return;
      }

      await hydrateUser(response.accessToken ?? response.token);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    const currentToken = tokenRef.current;
    const currentRefreshToken = refreshTokenRef.current;

    clearSession();

    if (currentToken) {
      authService.logout(currentToken, currentRefreshToken).catch(() => undefined);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(user && token),
        isLoading,
        user,
        token,
        refreshToken,
        isCurrencySetupRequired,
        signIn,
        signUp,
        signInWithGoogle,
      updateProfile,
      upgradeToPremium,
      uploadAvatar,
        completeCurrencySetup,
        completePasswordSetup,
        completeResetPassword,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
