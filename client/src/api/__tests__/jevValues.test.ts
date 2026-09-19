import { fetchValuesProfile } from '../jevValues';

describe('fetchValuesProfile', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts swipe history and returns the values profile', async () => {
    const mockJson = {
      profile: { salary_driven: 0.67, credential_averse: 0, stability_need: 0.33, hands_on: 1.0, confidence: 0.5, provider: 'fallback' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const profile = await fetchValuesProfile([{ feedback: 'salary' }]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/values'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(profile?.salary_driven).toBeCloseTo(0.67);
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(fetchValuesProfile([])).resolves.toBeNull();
  });
});
