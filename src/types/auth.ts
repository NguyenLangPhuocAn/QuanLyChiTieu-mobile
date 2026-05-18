export type UserRole = 'BASIC' | 'PREMIUM' | 'ADMIN' | null;

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  full_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  address?: string | null;
  avatar?: string | null;
  currency_default?: string | null;
  must_change_password?: boolean | number | null;
  profile_setup_completed?: boolean | number | null;
  wallet_count: number;
};

export type LoginResponse = {
  message: string;
  token: string;
  accessToken?: string;
  refreshToken: string;
  expiresIn?: number;
  refreshTokenExpiresAt?: string;
  mustChangePassword?: boolean;
};
