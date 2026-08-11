import { API_BASE_URLS, apiRequest, configureAuthSession } from '../src/services/api';

describe('apiRequest', () => {
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

  it('falls back to the next base url when the first request times out', async () => {
    const firstFetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted.');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const secondFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    (globalThis.fetch as jest.Mock)
      .mockImplementationOnce(firstFetch)
      .mockImplementationOnce(secondFetch);

    const requestPromise = apiRequest<{ ok: boolean }>('/health', { method: 'GET' });

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
});
