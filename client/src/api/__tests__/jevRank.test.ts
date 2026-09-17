import { rankCareers } from '../jevRank';

describe('rankCareers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts swipes and candidates and returns ranked results', async () => {
    const mockJson = {
      results: [
        { occupation_code: '29-1141.00', p_like: 0.6, fit_score: 1.0, driver: 'security', confidence: 0.5, provider: 'fallback' },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const outcome = await rankCareers([{ career_id: 7 }], ['29-1141.00']);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/rank'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(outcome?.results[0].occupation_code).toBe('29-1141.00');
    expect(outcome?.provider).toBe('fallback');
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(rankCareers([], ['15-1252.00'])).resolves.toBeNull();
  });
});
