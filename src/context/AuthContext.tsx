import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { configureAuthSession } from '../services/api';
import { authService } from '../services/auth';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
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
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

    if (nextAccessToken) {
      tokenRef.current = nextAccessToken;
      accessTokenExpiresAtRef.current = Date.now() + (next.expiresIn ?? 600) * 1000;
      setToken(nextAccessToken);
    }

    if (next.refreshToken) {
      refreshTokenRef.current = next.refreshToken;
      setRefreshToken(next.refreshToken);
    }
  };

  const clearSession = () => {
    tokenRef.current = null;
    refreshTokenRef.current = null;
    accessTokenExpiresAtRef.current = null;
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  useEffect(() => {
    configureAuthSession({
      getAccessToken: () => tokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      getAccessTokenExpiresAt: () => accessTokenExpiresAtRef.current,
      onTokens: saveTokens,
      onLogout: clearSession,
    });

    return () => configureAuthSession(null);
  }, []);

  const hydrateUser = async (nextToken: string) => {
    const profile = await authService.getProfile(nextToken);
    tokenRef.current = nextToken;
    accessTokenExpiresAtRef.current = Date.now() + 600 * 1000;
    setToken(nextToken);
    setUser(profile);
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
    throw new Error('Đăng nhập Google chưa được cấu hình trong bản mobile này.');
  };

  const updateProfile = async (payload: {
    full_name?: string;
    phone?: string;
    address?: string;
    birthday?: string;
    currency_default?: string;
  }) => {
    if (!tokenRef.current) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(tokenRef.current, payload);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    const currentToken = tokenRef.current;
    const currentRefreshToken = refreshTokenRef.current;

    clearSession();

    if (currentToken) {
      void authService.logout(currentToken, currentRefreshToken).catch(() => undefined);
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
        signIn,
        signUp,
        signInWithGoogle,
        updateProfile,
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
