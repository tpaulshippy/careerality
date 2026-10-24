import { scoreNarrative } from '../jevQa';

describe('scoreNarrative', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the narrative and returns the score', async () => {
    const mockJson = {
      score: { salary_hallucinated: 0.05, contradicts_onet: 0.1, authenticity: 1.0, regenerate: false, confidence: 0.5, provider: 'fallback' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const score = await scoreNarrative({ narrative: 'Debugged prod.', onet_tasks: ['Debug'], occupation_code: '15-1252.00' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/qa_score'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(score?.regenerate).toBe(false);
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(scoreNarrative({ narrative: 'x', onet_tasks: [], occupation_code: 'y' })).resolves.toBeNull();
  });
});
