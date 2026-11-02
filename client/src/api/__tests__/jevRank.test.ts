import { rankCareers } from '../jevRank';
import { findLocalById, findOccupationName, isCatalogEmpty } from '../../data/catalog';
import type { CareerROI } from '../../types';

jest.mock('../../data/catalog', () => ({
  findLocalById: jest.fn(),
  findOccupationName: jest.fn(),
  isCatalogEmpty: jest.fn(),
}));

const mockIsCatalogEmpty = isCatalogEmpty as jest.Mock;
const mockFindLocalById = findLocalById as jest.Mock;
const mockFindOccupationName = findOccupationName as jest.Mock;

describe('rankCareers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Default: empty bundle -> legacy payload shape.
    mockIsCatalogEmpty.mockReturnValue(true);
    mockFindLocalById.mockReturnValue(undefined);
    mockFindOccupationName.mockReturnValue(undefined);
  });

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

    const outcome = await rankCareers([{ career_id: 7 }], [{ occupation_code: '29-1141.00', occupation_name: 'Registered Nurses' }]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/jev/rank'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.candidates).toEqual([{ occupation_code: '29-1141.00', occupation_name: 'Registered Nurses' }]);
    expect(outcome?.results[0].occupation_code).toBe('29-1141.00');
    expect(outcome?.provider).toBe('fallback');
  });

  it('returns null when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(rankCareers([], [{ occupation_code: '15-1252.00' }])).resolves.toBeNull();
  });

  it('sends exactly the legacy shape when the bundle is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    }) as unknown as typeof fetch;

    await rankCareers(
      [{ career_id: 7, direction: 'right' }],
      [{ occupation_code: '15-1252.00' }]
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      swipes: [{ career_id: 7, direction: 'right' }],
      candidates: [{ occupation_code: '15-1252.00' }],
    });
    expect(mockFindLocalById).not.toHaveBeenCalled();
    expect(mockFindOccupationName).not.toHaveBeenCalled();
  });

  it('attaches careerLookup and candidateNames resolved from the bundle', async () => {
    mockIsCatalogEmpty.mockReturnValue(false);
    mockFindLocalById.mockImplementation((id: number) =>
      id === 7
        ? ({ id: 7, occupation_code: '15-1252.00', occupation_name: 'Software Developers' } as unknown as CareerROI)
        : undefined
    );
    mockFindOccupationName.mockImplementation((code: string) =>
      code === '29-1141.00' ? 'Registered Nurses' : undefined
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    }) as unknown as typeof fetch;

    await rankCareers(
      [{ career_id: 7, direction: 'right' }, { career_id: 8, direction: 'left' }],
      [{ occupation_code: '29-1141.00' }, { occupation_code: '15-1252.00', occupation_name: 'Software Developers' }]
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.careerLookup).toEqual({
      '7': { occupation_code: '15-1252.00', occupation_name: 'Software Developers' },
    });
    expect(body.candidateNames).toEqual({ '29-1141.00': 'Registered Nurses' });
    // Swipes/candidates serialization is unchanged; enrichment is additive.
    expect(body.swipes).toEqual([{ career_id: 7, direction: 'right' }, { career_id: 8, direction: 'left' }]);
    expect(body.candidates).toEqual([
      { occupation_code: '29-1141.00' },
      { occupation_code: '15-1252.00', occupation_name: 'Software Developers' },
    ]);
  });

  it('omits lookup fields when nothing resolves locally', async () => {
    mockIsCatalogEmpty.mockReturnValue(false);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    }) as unknown as typeof fetch;

    await rankCareers([{ career_id: 7 }], [{ occupation_code: '99-9999.00' }]);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      swipes: [{ career_id: 7 }],
      candidates: [{ occupation_code: '99-9999.00' }],
    });
  });
});
