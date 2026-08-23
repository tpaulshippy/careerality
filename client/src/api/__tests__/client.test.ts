import { apiClient, ApiTimeoutError } from '../client';

jest.mock('../../utils/userId', () => ({
  getUserId: jest.fn().mockResolvedValue('test-user-id'),
}));

const getUserIdMock = jest.requireMock('../../utils/userId').getUserId as jest.MockedFunction<
  typeof import('../../utils/userId').getUserId
>;

describe('ApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    jest.useRealTimers();
    getUserIdMock.mockResolvedValue('test-user-id');
  });

  it('getCareers builds correct URL with params and includes user_id', async () => {
    const mockJson = {
      records: [],
      pagy: { page: 1, items: 0, count: 0, pages: 0 },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const result = await apiClient.getCareers({ page: 1, area_code: 4 });

    const fetchMock = global.fetch as jest.Mock;
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('area_code=4');
    expect(url).toContain('user_id=test-user-id');
    expect(result).toEqual(mockJson);
  });

  it('passes an AbortController signal to fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [] }),
    }) as unknown as typeof fetch;

    await apiClient.getCareers();

    const fetchMock = global.fetch as jest.Mock;
    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('times out and throws ApiTimeoutError when fetch hangs', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch);

    const promise = apiClient.getCareers();
    const errPromise = promise.catch(e => e);
    await jest.advanceTimersByTimeAsync(15000);

    const err = await errPromise;
    expect(err).toBeInstanceOf(ApiTimeoutError);
    expect(err.message).toBe('Request timed out');
  });

  it('rethrows AbortError instead of ApiTimeoutError when the caller aborts', async () => {
    global.fetch = jest.fn(((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch);

    const controller = new AbortController();
    const promise = apiClient.searchCareers('nursing', controller.signal);
    const errPromise = promise.catch(e => e);
    controller.abort();

    const err = await errPromise;
    expect(err).not.toBeInstanceOf(ApiTimeoutError);
    expect(err.name).toBe('AbortError');
  });

  it('submitSwipe includes feedback in the POST body when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;

    await apiClient.submitSwipe(42, 'right', 'very_interested: great pay');

    const fetchMock = global.fetch as jest.Mock;
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/swipes');
    expect(JSON.parse(options.body as string)).toEqual({
      career_id: 42,
      user_id: 'test-user-id',
      direction: 'right',
      feedback: 'very_interested: great pay',
    });
  });

  it('submitSwipe omits feedback from the POST body when not provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;

    await apiClient.submitSwipe(42, 'left');

    const fetchMock = global.fetch as jest.Mock;
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({
      career_id: 42,
      user_id: 'test-user-id',
      direction: 'left',
    });
  });

  it('deleteAllSwipes sends DELETE to destroy_all with user_id and returns deleted count', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ deleted: 3 }),
    }) as unknown as typeof fetch;

    const result = await apiClient.deleteAllSwipes();

    const fetchMock = global.fetch as jest.Mock;
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/swipes/destroy_all');
    expect(url).toContain('user_id=test-user-id');
    expect(options.method).toBe('DELETE');
    expect(result).toEqual({ deleted: 3 });
  });

  it('non-ok response throws API error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(apiClient.getCareers()).rejects.toThrow(/API error: 500/);
  });
});
