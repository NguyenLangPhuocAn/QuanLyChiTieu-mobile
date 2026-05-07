import React, { createContext, useContext, useState } from 'react';
import { authService } from '../services/auth';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
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
  const [isLoading, setIsLoading] = useState(false);

  const hydrateUser = async (nextToken: string) => {
    const profile = await authService.getProfile(nextToken);
    setToken(nextToken);
    setUser(profile);
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      await hydrateUser(response.token);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);

    try {
      await authService.register(email, password, confirmPassword);
      const response = await authService.login(email, password);
      await hydrateUser(response.token);
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
    if (!token) {
      throw new Error('Vui lòng đăng nhập lại.');
    }

    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(token, payload);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(user && token),
        isLoading,
        user,
        token,
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
