import { Platform } from 'react-native';

const API_BASE_URLS =
  Platform.OS === 'android'
    ? ['http://10.0.2.2:3000', 'http://192.168.1.3:3000', 'http://localhost:3000']
    : ['http://localhost:3000', 'http://192.168.1.3:3000'];

const REFRESH_THRESHOLD_SECONDS = 4 * 60;
const REQUEST_TIMEOUT_MS = 5000;
const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
const NETWORK_ERROR_MESSAGE =
  'Không thể kết nối hệ thống. Vui lòng kiểm tra mạng hoặc thử lại sau.';
const SERVER_ERROR_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
const INVALID_INPUT_MESSAGE = 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.';

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
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const parseErrorCode = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as { code?: unknown };

  return typeof record.code === 'string' ? record.code : undefined;
};

const parseErrorMessage = (payload: unknown) => {
  if (!payload) {
    return GENERIC_ERROR_MESSAGE;
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

  return GENERIC_ERROR_MESSAGE;
};

const sanitizeErrorMessage = (message: string) => {
  const trimmed = message.trim();

  if (!trimmed) {
    return GENERIC_ERROR_MESSAGE;
  }

  if (/jwt|token|bearer|unauthorized|forbidden|\b401\b|\b403\b/i.test(trimmed)) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (
    /network request failed|failed to fetch|abort|timeout|econn|enotfound|socket|networkerror/i.test(
      trimmed,
    )
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    /internal server|prisma|sql|database|exception|stack trace|\b500\b|cannot read|undefined|null|nan|\[object object\]|is not a function|request failed/i.test(
      trimmed,
    )
  ) {
    return SERVER_ERROR_MESSAGE;
  }

  if (/must be|should not|property .* should|constraint|validation failed/i.test(trimmed)) {
    return INVALID_INPUT_MESSAGE;
  }

  return trimmed;
};

const getFriendlyErrorMessage = (status: number, payload: unknown) => {
  if (status === 401 || status === 403) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  return sanitizeErrorMessage(parseErrorMessage(payload));
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
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
};

const fetchWithTimeout = async (input: RequestInfo, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const postRefresh = async (baseUrl: string, refreshToken: string) => {
  const response = await fetchWithTimeout(`${baseUrl}/users/refresh`, {
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
    throw new ApiError(
      getFriendlyErrorMessage(response.status, payload),
      response.status,
      parseErrorCode(payload),
    );
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

      if (lastError instanceof ApiError) {
          throw new ApiError(SESSION_EXPIRED_MESSAGE, lastError.status, lastError.code);
      }

      throw new Error(NETWORK_ERROR_MESSAGE);
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
      let response = await fetchWithTimeout(`${baseUrl}${path}`, {
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
        response = await fetchWithTimeout(`${baseUrl}${path}`, {
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

        throw new ApiError(
          getFriendlyErrorMessage(response.status, payload),
          response.status,
          parseErrorCode(payload),
        );
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
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  throw new Error(NETWORK_ERROR_MESSAGE);
};

export const apiUploadRequest = async <T>(
  path: string,
  token: string,
  file: {
    uri: string;
    name: string;
    type: string;
  },
  method = 'POST',
) => {
  let lastError: unknown;
  let authToken = await getValidToken(token);

  for (const baseUrl of API_BASE_URLS) {
    try {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);

      let response = await fetchWithTimeout(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      if (response.status === 401 && authSession?.getRefreshToken()) {
        authToken = await refreshAccessToken();
        response = await fetchWithTimeout(`${baseUrl}${path}`, {
          method,
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

        throw new ApiError(
          getFriendlyErrorMessage(response.status, payload),
          response.status,
          parseErrorCode(payload),
        );
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
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  throw new Error(NETWORK_ERROR_MESSAGE);
};

export { API_BASE_URLS };
