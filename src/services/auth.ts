import { apiRequest, apiUploadRequest } from './api';
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

  loginWithGoogle(idToken: string) {
    return apiRequest<LoginResponse>('/auth/google/mobile', {
      method: 'POST',
      body: { idToken },
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
      profile_setup_completed?: boolean;
    },
  ) {
    return apiRequest<AuthUser>('/users/me', {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  upgradeToPremium(token: string) {
    return apiRequest<AuthUser>('/users/me/upgrade-premium', {
      method: 'PUT',
      token,
    });
  },

  uploadAvatar(
    token: string,
    file: {
      uri: string;
      name: string;
      type: string;
    },
  ) {
    return apiUploadRequest<AuthUser>('/users/me/avatar', token, file, 'PUT');
  },

  changePassword(
    token: string,
    payload: {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
  ) {
    return apiRequest<{ message: string; forceLogout?: boolean }>('/users/change-password', {
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
    return apiRequest<{ message: string }>('/users/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  verifyResetOtp(email: string, otp: string) {
    return apiRequest<{ message: string; reset_token: string }>('/users/verify-reset-otp', {
      method: 'POST',
      body: { email, otp },
    });
  },

  resetPassword(resetToken: string, newPassword: string, confirmPassword: string) {
    return apiRequest<LoginResponse>('/users/reset-password', {
      method: 'POST',
      body: {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      },
    });
  },

  completePasswordSetup(token: string, newPassword: string, confirmPassword: string) {
    return apiRequest<LoginResponse>(
      '/users/complete-password-setup',
      {
        method: 'PUT',
        token,
        body: { newPassword, confirmPassword },
      },
    );
  },
};
