import {
  API_BASE_URLS,
  apiRequest,
  configureAuthSession,
  invalidateAuthSession,
} from '../src/services/api';

describe('apiRequest', () => {
  const healthy = () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ status: 'ok', service: 'quan-ly-chi-tieu' }),
  });
  const session = () => ({
    getAccessToken: () => 'access',
    getRefreshToken: () => 'refresh',
    getAccessTokenExpiresAt: () => Date.now() - 1000,
    onTokens: jest.fn(),
    onLogout: jest.fn(),
  });
  beforeEach(() => {
    jest.useFakeTimers();
    configureAuthSession(null);
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.resetAllMocks();
    configureAuthSession(null);
  });

  it('rejects a stale refresh without writing tokens into the next session', async () => {
    const oldSession = session();
    configureAuthSession(oldSession);
    let complete!: (value: unknown) => void;
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(healthy())
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            complete = resolve;
          }),
      );
    const request = apiRequest('/wallets');
    const rejected = request.catch(error => error as { code: string });
    await jest.advanceTimersByTimeAsync(0);
    const newSession = session();
    configureAuthSession(newSession);
    complete({
      ok: true,
      text: async () => JSON.stringify({ accessToken: 'old-renewed' }),
    });
    expect(await rejected).toMatchObject({ code: 'SESSION_CHANGED' });
    expect(oldSession.onTokens).not.toHaveBeenCalled();
    expect(newSession.onTokens).not.toHaveBeenCalled();
    expect(newSession.onLogout).not.toHaveBeenCalled();
  });

  it('does not log out a new session when an old request returns 401', async () => {
    configureAuthSession({
      ...session(),
      getAccessTokenExpiresAt: () => Date.now() + 3600000,
    });
    let complete!: (value: unknown) => void;
    (globalThis.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );
    const request = apiRequest('/wallets');
    const rejected = request.catch(error => error as { code: string });
    await Promise.resolve();
    invalidateAuthSession();
    const next = session();
    configureAuthSession(next);
    complete({ ok: false, status: 401, text: async () => '' });
    expect(await rejected).toMatchObject({ code: 'SESSION_CHANGED' });
    expect(next.onLogout).not.toHaveBeenCalled();
  });

  it('sends public login requests without trying to refresh a stale session', async () => {
    const handlers = session();
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ status: 'ok', service: 'quan-ly-chi-tieu' }),
      })
      .mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '',
      });
    await expect(
      apiRequest('/users/login', { authMode: 'none', method: 'POST' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(handlers.onLogout).not.toHaveBeenCalled();
    expect(
      (globalThis.fetch as jest.Mock).mock.calls[1][1].headers.Authorization,
    ).toBeUndefined();
  });

  it('discovers a reachable server with GET and does not replay an uncertain write', async () => {
    (globalThis.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ status: 'ok', service: 'quan-ly-chi-tieu' }),
      })
      .mockRejectedValueOnce(new TypeError('Connection lost after sending'));
    await expect(
      apiRequest('/transactions', { method: 'POST', body: { amount: '100' } }),
    ).rejects.toMatchObject({ code: 'REQUEST_OUTCOME_UNKNOWN' });
    const calls = (globalThis.fetch as jest.Mock).mock.calls;
    expect(calls.map(call => call[1].method)).toEqual(['GET', 'GET', 'POST']);
    expect(calls[2][0]).toBe(`${API_BASE_URLS[1]}/transactions`);
  });

  it('keeps the session when the laptop server cannot be reached during refresh', async () => {
    const handlers = session();
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await expect(apiRequest('/wallets')).rejects.toThrow('Không thể kết nối');
    expect(handlers.onLogout).not.toHaveBeenCalled();
  });

  it('keeps the session on a temporary refresh server error', async () => {
    const handlers = session();
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(healthy())
      .mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '',
      });
    await expect(apiRequest('/wallets')).rejects.toThrow(
      'Hệ thống đang gặp sự cố',
    );
    expect(handlers.onLogout).not.toHaveBeenCalled();
  });

  it('does not replay a rotating refresh token when its response is lost', async () => {
    const handlers = session();
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(healthy())
      .mockRejectedValueOnce(new TypeError('lost refresh response'));
    await expect(apiRequest('/wallets')).rejects.toThrow('Không thể kết nối');
    expect(
      (globalThis.fetch as jest.Mock).mock.calls.map(call => call[1].method),
    ).toEqual(['GET', 'POST']);
    expect(handlers.onLogout).not.toHaveBeenCalled();
  });

  it('logs out when the refresh credential is rejected', async () => {
    const handlers = session();
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(healthy())
      .mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '',
      });
    await expect(apiRequest('/wallets')).rejects.toThrow('Phiên đăng nhập');
    expect(handlers.onLogout).toHaveBeenCalledTimes(1);
  });

  it('does not log out for a resource permission denial', async () => {
    const handlers = {
      ...session(),
      getAccessTokenExpiresAt: () => Date.now() + 3600000,
    };
    configureAuthSession(handlers);
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '',
    });
    await expect(apiRequest('/restricted')).rejects.toThrow('không có quyền');
    expect(handlers.onLogout).not.toHaveBeenCalled();
  });

  it('falls back to the next base url when the first request times out', async () => {
    const firstFetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      },
    );

    const secondFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    (globalThis.fetch as jest.Mock)
      .mockImplementationOnce(firstFetch)
      .mockImplementationOnce(secondFetch);

    const requestPromise = apiRequest<{ ok: boolean }>('/health', {
      method: 'GET',
    });

    await jest.advanceTimersByTimeAsync(5000);

    await expect(requestPromise).resolves.toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      `${API_BASE_URLS[0]}/health`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      `${API_BASE_URLS[1]}/health`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('also times out a stalled response body before falling back on a read', async () => {
    (globalThis.fetch as jest.Mock)
      .mockImplementationOnce((_input: RequestInfo, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                const error = new Error('aborted body');
                error.name = 'AbortError';
                reject(error);
              });
            }),
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      });
    const pending = apiRequest('/wallets');
    await jest.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
