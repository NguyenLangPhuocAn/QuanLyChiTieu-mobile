import { Platform } from 'react-native';
import apiConfig from '../config/api.config.json';
import { resolveApiEndpoints } from '../config/apiEndpoints';

const API_BASE_URLS = resolveApiEndpoints(Platform.OS, apiConfig);

const REFRESH_THRESHOLD_SECONDS = 4 * 60;
const REQUEST_TIMEOUT_MS = 5000;
const SESSION_EXPIRED_MESSAGE =
  'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
const NETWORK_ERROR_MESSAGE =
  'Không thể kết nối hệ thống. Vui lòng kiểm tra mạng hoặc thử lại sau.';
const SERVER_ERROR_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
const FORBIDDEN_MESSAGE = 'Bạn không có quyền thực hiện thao tác này.';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
const INVALID_INPUT_MESSAGE =
  'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
  authMode?: 'session' | 'none';
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
let sessionRevision = 0;
let connectedBaseUrl: string | null = null;

/** Media loaded after an API response must use the server that answered it. */
export const getApiBaseUrl = () => connectedBaseUrl ?? API_BASE_URLS[0];

export const invalidateAuthSession = () => {
  sessionRevision += 1;
  refreshPromise = null;
};

export const configureAuthSession = (handlers: AuthSessionHandlers | null) => {
  invalidateAuthSession();
  connectedBaseUrl = null;
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

const assertCurrentSession = (revision: number) => {
  if (revision !== sessionRevision) {
    throw new ApiError(
      'Phiên làm việc đã thay đổi. Vui lòng thử lại.',
      0,
      'SESSION_CHANGED',
    );
  }
};

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

  if (
    /jwt|token|bearer|unauthorized|forbidden|\b401\b|\b403\b/i.test(trimmed)
  ) {
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

  if (
    /must be|should not|property .* should|constraint|validation failed/i.test(
      trimmed,
    )
  ) {
    return INVALID_INPUT_MESSAGE;
  }

  return trimmed;
};

const getFriendlyErrorMessage = (status: number, payload: unknown) => {
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (status === 403) return FORBIDDEN_MESSAGE;

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
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'AbortError')
  );
};

const fetchWithTimeout = async (
  input: RequestInfo,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const responseText = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text: async () => responseText,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const orderedBaseUrls = () =>
  connectedBaseUrl
    ? [
        connectedBaseUrl,
        ...API_BASE_URLS.filter(url => url !== connectedBaseUrl),
      ]
    : API_BASE_URLS;

// Only read requests may probe alternate addresses. Never replay a write after
// a timeout: the server might already have committed it before the reply was lost.
const resolveMutationBaseUrl = async (revision: number) => {
  if (connectedBaseUrl) return connectedBaseUrl;
  for (const baseUrl of API_BASE_URLS) {
    assertCurrentSession(revision);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`, {
        method: 'GET',
      });
      const payload = parseResponseBody(await response.text()) as {
        status?: string;
        service?: string;
      } | null;
      assertCurrentSession(revision);
      if (
        response.ok &&
        payload?.status === 'ok' &&
        payload.service === 'quan-ly-chi-tieu'
      ) {
        connectedBaseUrl = baseUrl;
        return baseUrl;
      }
    } catch {
      assertCurrentSession(revision);
    }
  }
  throw new Error(NETWORK_ERROR_MESSAGE);
};

const unknownWriteOutcome = () =>
  new ApiError(
    'Kết nối gián đoạn khi gửi. Chưa xác nhận được kết quả; hãy kiểm tra lịch sử thao tác trước khi thử lại.',
    0,
    'REQUEST_OUTCOME_UNKNOWN',
  );

const postRefresh = async (
  baseUrl: string,
  refreshToken: string,
  revision: number,
) => {
  const response = await fetchWithTimeout(`${baseUrl}/users/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  const text = await response.text();
  assertCurrentSession(revision);
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
  const revision = sessionRevision;
  const refreshToken = authSession?.getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    const pending = (async () => {
      let lastError: unknown;
      const baseUrl = await resolveMutationBaseUrl(revision);
      try {
        assertCurrentSession(revision);
        return await postRefresh(baseUrl, refreshToken, revision);
      } catch (error) {
        lastError = error;
        if (isNetworkError(error) && connectedBaseUrl === baseUrl)
          connectedBaseUrl = null;
      }

      assertCurrentSession(revision);
      if (lastError instanceof ApiError) {
        if (lastError.status === 401 || lastError.status === 403) {
          authSession?.onLogout();
          throw new ApiError(
            SESSION_EXPIRED_MESSAGE,
            lastError.status,
            lastError.code,
          );
        }
        throw lastError;
      }

      throw new Error(NETWORK_ERROR_MESSAGE);
    })().finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    });
    refreshPromise = pending;
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

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
) => {
  const {
    token,
    headers,
    body,
    timeoutMs,
    authMode = 'session',
    ...restOptions
  } = options;
  const revision = sessionRevision;
  let lastError: unknown;
  let authToken = authMode === 'none' ? token : await getValidToken(token);
  assertCurrentSession(revision);

  const readOnly = ['GET', 'HEAD'].includes(
    (restOptions.method ?? 'GET').toUpperCase(),
  );
  const baseUrls = readOnly
    ? orderedBaseUrls()
    : [await resolveMutationBaseUrl(revision)];
  assertCurrentSession(revision);
  for (const baseUrl of baseUrls) {
    try {
      let response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          ...restOptions,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        timeoutMs,
      );

      assertCurrentSession(revision);
      if (
        authMode === 'session' &&
        response.status === 401 &&
        authSession?.getRefreshToken()
      ) {
        authToken = await refreshAccessToken();
        assertCurrentSession(revision);
        response = await fetchWithTimeout(
          `${baseUrl}${path}`,
          {
            ...restOptions,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              ...headers,
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
          },
          timeoutMs,
        );
      }

      const text = await response.text();
      assertCurrentSession(revision);
      const payload = parseResponseBody(text);

      if (!response.ok) {
        if (authMode === 'session' && response.status === 401) {
          authSession?.onLogout();
        }

        throw new ApiError(
          getFriendlyErrorMessage(response.status, payload),
          response.status,
          parseErrorCode(payload),
        );
      }

      connectedBaseUrl = baseUrl;
      return payload as T;
    } catch (error) {
      assertCurrentSession(revision);
      lastError = error;

      if (!isNetworkError(error)) {
        throw error;
      }
      if (connectedBaseUrl === baseUrl) connectedBaseUrl = null;
      if (!readOnly) throw unknownWriteOutcome();
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
  timeoutMs = REQUEST_TIMEOUT_MS,
) => {
  const revision = sessionRevision;
  let authToken = await getValidToken(token);
  assertCurrentSession(revision);

  const baseUrl = await resolveMutationBaseUrl(revision);
  assertCurrentSession(revision);
  try {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);

    let response = await fetchWithTimeout(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: formData,
      },
      timeoutMs,
    );

    if (response.status === 401 && authSession?.getRefreshToken()) {
      assertCurrentSession(revision);
      authToken = await refreshAccessToken();
      assertCurrentSession(revision);
      response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          method,
          headers: {
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: formData,
        },
        timeoutMs,
      );
    }

    const text = await response.text();
    assertCurrentSession(revision);
    const payload = parseResponseBody(text);

    if (!response.ok) {
      if (response.status === 401) {
        authSession?.onLogout();
      }

      throw new ApiError(
        getFriendlyErrorMessage(response.status, payload),
        response.status,
        parseErrorCode(payload),
      );
    }

    connectedBaseUrl = baseUrl;
    return payload as T;
  } catch (error) {
    assertCurrentSession(revision);

    if (!isNetworkError(error)) {
      throw error;
    }
    if (connectedBaseUrl === baseUrl) connectedBaseUrl = null;
    throw unknownWriteOutcome();
  }
};

export { API_BASE_URLS };
