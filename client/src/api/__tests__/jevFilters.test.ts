import { routeNaturalLanguage, routeKeywords, looksLikeNaturalLanguage } from '../jevFilters';

describe('routeNaturalLanguage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts text and returns parsed filters', async () => {
    const mockJson = {
      filters: { education_pathway: 'no_degree', work_env: 'remote', min_salary: 80000, requires_clarification: false, confidence: 0.5, provider: 'fallback' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const filters = await routeNaturalLanguage('I hate school but want $80k+ remote');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/route_filters'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(filters?.work_env).toBe('remote');
    expect(filters?.min_salary).toBe(80000);
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(routeNaturalLanguage('hi')).resolves.toBeNull();
  });
});

describe('looksLikeNaturalLanguage', () => {
  it('routes long multi-word input, skips short keywords', () => {
    expect(looksLikeNaturalLanguage('I hate school but want $80k+ remote')).toBe(true);
    expect(looksLikeNaturalLanguage('nurse')).toBe(false);
    expect(looksLikeNaturalLanguage('remote')).toBe(false);
    expect(looksLikeNaturalLanguage('no degree jobs')).toBe(true);
    expect(looksLikeNaturalLanguage('  ')).toBe(false);
  });
});

describe('routeKeywords', () => {
  it('builds keywords from matched options only', () => {
    expect(routeKeywords({ work_env: 'remote' } as never)).toBe('remote');
    expect(routeKeywords({ work_env: 'no_match' } as never)).toBe('');
  });
});
