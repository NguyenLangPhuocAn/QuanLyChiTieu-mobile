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
};
