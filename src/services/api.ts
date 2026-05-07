import { Platform } from 'react-native';

const API_BASE_URLS =
  Platform.OS === 'android'
    ? ['http://10.0.2.2:3000', 'http://192.168.1.3:3000', 'http://localhost:3000']
    : ['http://localhost:3000', 'http://192.168.1.3:3000'];

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string | null;
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

export const apiRequest = async <T>(path: string, options: RequestOptions = {}) => {
  const { token, headers, body, ...restOptions } = options;

  let lastError: unknown;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...restOptions,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      const payload = parseResponseBody(text);

      if (!response.ok) {
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
    throw new Error(
      'Không kết nối được backend. Kiểm tra server Nest đang chạy và máy/giả lập có truy cập được địa chỉ API.',
    );
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

  for (const baseUrl of API_BASE_URLS) {
    try {
      const formData = new FormData();
      // React Native nhận object có uri/name/type để đẩy file dạng multipart.
      formData.append('file', file as unknown as Blob);

      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const text = await response.text();
      const payload = parseResponseBody(text);

      if (!response.ok) {
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
