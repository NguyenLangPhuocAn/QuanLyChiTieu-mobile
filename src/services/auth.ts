import { apiRequest } from './api';
import type { AuthUser, LoginResponse } from '../types/auth';

export const authService = {
  login(email: string, password: string) {
    return apiRequest<LoginResponse>('/users/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    });
  },

  register(email: string, password: string, confirmPassword: string) {
    return apiRequest('/users', {
      method: 'POST',
      body: {
        email,
        password,
        confirmPassword,
      },
    });
  },

  getProfile(token: string) {
    return apiRequest<AuthUser>('/users/me', {
      method: 'GET',
      token,
    });
  },

  updateProfile(
    token: string,
    payload: {
      full_name?: string;
      phone?: string;
      address?: string;
      birthday?: string;
      currency_default?: string;
    },
  ) {
    return apiRequest<AuthUser>('/users/me', {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  deactivateMe(token: string) {
    return apiRequest<{ message: string; forceLogout?: boolean }>('/users/me', {
      method: 'DELETE',
      token,
    });
  },

  refresh(refreshToken: string) {
    return apiRequest<LoginResponse>('/users/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  },

  logout(token: string, refreshToken?: string | null) {
    return apiRequest('/users/logout', {
      method: 'POST',
      token,
      body: { refreshToken },
    });
  },

  forgotPassword(email: string) {
    return apiRequest<{ message: string; resetToken?: string }>('/users/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return apiRequest<{ message: string }>('/users/reset-password', {
      method: 'POST',
      body: { token, newPassword, confirmPassword },
    });
  },

  completePasswordSetup(token: string, newPassword: string, confirmPassword: string) {
    return apiRequest<{ message: string; forceLogout?: boolean }>(
      '/users/complete-password-setup',
      {
        method: 'PUT',
        token,
        body: { newPassword, confirmPassword },
      },
    );
  },
};
