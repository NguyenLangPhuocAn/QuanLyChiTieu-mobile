import { Platform } from 'react-native';

const API_BASE_URLS =
  Platform.OS === 'android'
    ? ['http://10.0.2.2:3000', 'http://192.168.1.3:3000', 'http://localhost:3000']
    : ['http://localhost:3000', 'http://192.168.1.3:3000'];

const REFRESH_THRESHOLD_SECONDS = 4 * 60;

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
};

type AuthSessionHandlers = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getAccessTokenExpiresAt: () => number | null;
  onTokens: (tokens: {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    expiresIn?: number;
  }) => void;
  onLogout: () => void;
};

let authSession: AuthSessionHandlers | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const configureAuthSession = (handlers: AuthSessionHandlers | null) => {
  authSession = handlers;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const parseErrorMessage = (payload: unknown) => {
  if (!payload) {
    return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object') {
    const record = payload as { message?: string | string[] };

    if (Array.isArray(record.message)) {
      return record.message.join('\n');
    }

    if (typeof record.message === 'string') {
      return record.message;
    }
  }

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};

const parseResponseBody = (text: string) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isNetworkError = (error: unknown) => {
  return error instanceof TypeError;
};

const postRefresh = async (baseUrl: string, refreshToken: string) => {
  const response = await fetch(`${baseUrl}/users/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  const text = await response.text();
  const payload = parseResponseBody(text) as {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    expiresIn?: number;
  } | null;

  if (!response.ok || !payload) {
    throw new ApiError(parseErrorMessage(payload), response.status);
  }

  authSession?.onTokens(payload);
  return payload.accessToken ?? payload.token ?? null;
};

const refreshAccessToken = async () => {
  const refreshToken = authSession?.getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      let lastError: unknown;

      for (const baseUrl of API_BASE_URLS) {
        try {
          return await postRefresh(baseUrl, refreshToken);
        } catch (error) {
          lastError = error;

          if (!isNetworkError(error)) {
            break;
          }
        }
      }

      authSession?.onLogout();

      if (lastError instanceof Error) {
        throw lastError;
      }

      return null;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const getValidToken = async (explicitToken?: string | null) => {
  const token = explicitToken ?? authSession?.getAccessToken() ?? null;
  const expiresAt = authSession?.getAccessTokenExpiresAt() ?? null;

  if (!authSession) {
    return token;
  }

  if (
    token &&
    expiresAt &&
    Math.floor((expiresAt - Date.now()) / 1000) > REFRESH_THRESHOLD_SECONDS
  ) {
    return token;
  }

  return refreshAccessToken();
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}) => {
  const { token, headers, body, ...restOptions } = options;
  let lastError: unknown;
  let authToken = await getValidToken(token);

  for (const baseUrl of API_BASE_URLS) {
    try {
      let response = await fetch(`${baseUrl}${path}`, {
        ...restOptions,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && authSession?.getRefreshToken()) {
        authToken = await refreshAccessToken();
        response = await fetch(`${baseUrl}${path}`, {
          ...restOptions,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      }

      const text = await response.text();
      const payload = parseResponseBody(text);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          authSession?.onLogout();
        }

        throw new ApiError(parseErrorMessage(payload), response.status);
      }

      return payload as T;
    } catch (error) {
      lastError = error;

      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new Error('Không kết nối được backend. Kiểm tra server Nest và địa chỉ API.');
  }

  throw new Error('Không kết nối được backend.');
};

export const apiUploadRequest = async <T>(
  path: string,
  token: string,
  file: {
    uri: string;
    name: string;
    type: string;
  },
) => {
  let lastError: unknown;
  let authToken = await getValidToken(token);

  for (const baseUrl of API_BASE_URLS) {
    try {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);

      let response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      if (response.status === 401 && authSession?.getRefreshToken()) {
        authToken = await refreshAccessToken();
        response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: formData,
        });
      }

      const text = await response.text();
      const payload = parseResponseBody(text);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          authSession?.onLogout();
        }

        throw new ApiError(parseErrorMessage(payload), response.status);
      }

      return payload as T;
    } catch (error) {
      lastError = error;

      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new Error('Không kết nối được backend để upload ảnh.');
  }

  throw new Error('Không kết nối được backend.');
};

export { API_BASE_URLS };
