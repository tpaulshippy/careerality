import { triageMessage, taskLabel } from '../jevTriage';

describe('triageMessage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the message and returns the triage', async () => {
    const mockJson = {
      triage: { intent: 'next_steps', needs_human: false, jailbreak_attempt: false, confidence: 0.5, recommended_task: 'shadow', provider: 'fallback' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }) as unknown as typeof fetch;

    const triage = await triageMessage('What should I do next?');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/triage'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(triage?.intent).toBe('next_steps');
    expect(taskLabel(triage?.recommended_task ?? '')).toBe('Shadow someone in the field');
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(triageMessage('hi')).resolves.toBeNull();
  });
});
