import {
  CatalogBundle,
  findLocalById,
  findLocalCareer,
  findOccupationName,
  getCatalogMeta,
  getLikedCareersOrFallback,
  getMapSummary,
  hydrateLikedFromCatalog,
  isCatalogEmpty,
  listStates,
  loadCatalog,
  queryCareers,
  queryCatalog,
  toCareerROI,
} from '../catalog';
import { apiClient } from '../../api/client';

jest.mock('../../api/client', () => ({
  apiClient: {
    getSwipeHistory: jest.fn(),
    getLikedCareers: jest.fn(),
    getCareers: jest.fn(),
    searchCareers: jest.fn(),
  },
}));

const getSwipeHistory = apiClient.getSwipeHistory as jest.Mock;
const getLikedCareers = apiClient.getLikedCareers as jest.Mock;

// Inline mini-catalog fixture: tests must NOT depend on the real bundle.
// rows: [occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone,
//        eduLevel, indIdx, demandRank, demandScore, openings, growth,
//        colIndex, adjSalary]
const fixture: CatalogBundle = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  source: 'test',
  counts: { areas: 3, industries: 1, occupations: 3, rows: 6 },
  areas: [
    { c: '99', n: 'National' },
    { c: '6', n: 'California' },
    { c: '36', n: 'New York' },
  ],
  occupations: [
    { c: '15-1252.00', n: 'Software Engineers' },
    { c: '29-1141.00', n: 'Registered Nurses' },
    { c: '25-2031.00', n: 'Teachers' },
  ],
  industries: [{ c: '51', n: 'Tech' }],
  rows: [
    [0, 0, 1, 120000, 80000, 4, 40, 4, "Bachelor's", 0, 3, 0.9, 50000, 15.5, 1.0, 120000],
    [1, 0, 2, 80000, 60000, 6, 25, 4, "Bachelor's", 0, 1, 0.95, 100000, 9, 1.0, 80000],
    [2, 0, 3, 60000, 50000, 8, 10, 4, "Bachelor's", 0, null, null, null, null, 1.0, 60000],
    [0, 1, 4, 150000, 90000, 3, 50, 4, "Bachelor's", 0, 2, 0.92, 20000, 18, 1.2, 125000],
    [1, 1, 5, 85000, 65000, 7, 20, 4, "Bachelor's", 0, null, null, 30000, null, 1.2, 70000],
    [2, 2, 6, 65000, 55000, 9, 12, 4, "Bachelor's", 0, null, null, null, null, 1.1, 59000],
  ],
  map: {
    '0': { count: 3, avgSalary: 86666.7, adjSalary: 86666.7, medianRoi: 25, highRoi: 2, demandCount: 2, demandAvgRank: 2 },
    '1': { count: 2, avgSalary: 117500, adjSalary: 97500, medianRoi: 35, highRoi: 2, demandCount: 1, demandAvgRank: 2 },
  },
};

const ids = (records: Array<{ id: number }>): number[] => records.map(r => r.id);

beforeEach(() => {
  loadCatalog(fixture);
});

describe('catalog', () => {
  it('exposes meta and non-empty state from the fixture', () => {
    expect(isCatalogEmpty()).toBe(false);
    expect(getCatalogMeta()).toEqual({ version: 1, generated_at: '2026-01-01T00:00:00Z', rowCount: 6, isEmpty: false });
  });

  it('reports empty for a zero-row bundle', () => {
    loadCatalog({ ...fixture, rows: [], map: {}, counts: { areas: 0, industries: 0, occupations: 0, rows: 0 } });
    expect(isCatalogEmpty()).toBe(true);
    expect(getCatalogMeta().rowCount).toBe(0);
  });

  it('scopes to area, defaulting to all bundled areas like the unscoped server feed', () => {
    // No area_code returns every area (roi desc across the bundle), exactly
    // like the server feed without an area param — never national-only.
    expect(ids(queryCatalog({}).records)).toEqual([4, 1, 2, 5, 6, 3]);
    expect(ids(queryCatalog({ area_code: '6' }).records)).toEqual([4, 5]);
    expect(ids(queryCatalog({ area_code: '36' }).records)).toEqual([6]);
  });

  it('applies inclusive salary bounds across all areas when unscoped', () => {
    expect(ids(queryCatalog({ min_salary: 80000 }).records)).toEqual([4, 1, 2, 5]);
    expect(ids(queryCatalog({ max_salary: 80000 }).records)).toEqual([2, 6, 3]);
    expect(ids(queryCatalog({ min_salary: 70000, max_salary: 90000 }).records)).toEqual([2, 5]);
  });

  it('sorts by roi desc by default', () => {
    expect(ids(queryCatalog({ sort: 'roi' }).records)).toEqual([4, 1, 2, 5, 6, 3]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'roi' }).records)).toEqual([4, 5]);
  });

  it('sorts by salary desc', () => {
    expect(ids(queryCatalog({ sort: 'salary' }).records)).toEqual([4, 1, 5, 2, 6, 3]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'salary' }).records)).toEqual([4, 5]);
  });

  it('sorts by breakeven asc', () => {
    expect(ids(queryCatalog({ sort: 'breakeven' }).records)).toEqual([4, 1, 2, 5, 3, 6]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'breakeven' }).records)).toEqual([4, 5]);
  });

  it('sorts by demand and drops rows without demand data', () => {
    // Across all areas: nurse-national (0.95) before software-CA (0.92)
    // before software-national (0.9); rows without demand data are dropped.
    expect(ids(queryCatalog({ sort: 'demand' }).records)).toEqual([2, 4, 1]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'demand' }).records)).toEqual([4]);
  });

  it('falls back to roi desc when no rows have demand data', () => {
    expect(ids(queryCatalog({ area_code: '36', sort: 'demand' }).records)).toEqual([6]);
  });

  it('searches q case-insensitively across areas when unscoped', () => {
    expect(ids(queryCatalog({ q: 'nurse' }).records)).toEqual([2, 5]);
    expect(ids(queryCatalog({ q: 'NURSE' }).records)).toEqual([2, 5]);
    expect(ids(queryCatalog({ q: '  software ' }).records)).toEqual([4, 1]);
    expect(ids(queryCatalog({ q: 'teacher' }).records)).toEqual([6, 3]);
    expect(ids(queryCatalog({ q: 'teacher', area_code: '6' }).records)).toEqual([]);
    expect(ids(queryCatalog({ q: 'teacher', area_code: '36' }).records)).toEqual([6]);
  });

  it('paginates with a pagy shape', () => {
    const first = queryCatalog({ per_page: 2, page: 1 });
    expect(ids(first.records)).toEqual([4, 1]);
    expect(first.pagy).toEqual({ page: 1, items: 2, count: 6, pages: 3 });
    const second = queryCatalog({ per_page: 2, page: 2 });
    expect(ids(second.records)).toEqual([2, 5]);
    expect(second.pagy).toEqual({ page: 2, items: 2, count: 6, pages: 3 });
    const overflow = queryCatalog({ per_page: 2, page: 99 });
    expect(overflow.records).toEqual([]);
    expect(overflow.pagy.pages).toBe(3);
    const empty = queryCatalog({ q: 'zzz-no-match' });
    expect(empty.records).toEqual([]);
    expect(empty.pagy).toEqual({ page: 1, items: 20, count: 0, pages: 1 });
  });

  it('excludes ids', () => {
    expect(ids(queryCatalog({ excludeIds: [1] }).records)).toEqual([4, 2, 5, 6, 3]);
    expect(ids(queryCatalog({ excludeIds: [1, 2, 3, 4, 5, 6] }).records)).toEqual([]);
  });

  it('finds careers by code+area and by id, with misses', () => {
    expect(findLocalCareer('15-1252.00', '99')?.id).toBe(1);
    expect(findLocalCareer('15-1252.00', '6')?.id).toBe(4);
    // Same occupation code in another area is a different record.
    expect(findLocalCareer('15-1252.00', '36')).toBeUndefined();
    expect(findLocalCareer('99-9999.00', '99')).toBeUndefined();
    expect(findLocalById(2)?.occupation_name).toBe('Registered Nurses');
    expect(findLocalById(999)).toBeUndefined();
  });

  it('denormalizes decimal fields as strings with server ".0" shaping and no detail columns', () => {
    const career = findLocalById(1);
    expect(career?.annual_median_salary).toBe('120000.0');
    expect(career?.education_cost).toBe('80000.0');
    expect(career?.roi_percentage).toBe('40.0');
    expect(career?.skills).toEqual([]);
    expect(career?.day_in_life_summary).toBeUndefined();
    expect(career?.day_in_life_full).toBeUndefined();
    expect(career?.video_url).toBeUndefined();
    expect(toCareerROI).toBeDefined();
  });

  it('lists states with national "99" first', () => {
    const { states } = listStates();
    expect(states[0]).toEqual({ area_code: '99', area_name: 'National' });
    expect(states.map(s => s.area_code)).toEqual(['99', '6', '36']);
  });

  it('lists non-national states alphabetically regardless of bundle order', () => {
    // The exporter writes areas code-ordered; the server lists them
    // name-ordered. listStates must match the server for both pickers.
    loadCatalog({
      version: 1,
      generated_at: '2026-01-01T00:00:00Z',
      source: 'test',
      counts: { areas: 3, industries: 1, occupations: 1, rows: 1 },
      areas: [
        { c: '99', n: 'National' },
        { c: '36', n: 'New York' },
        { c: '6', n: 'California' },
      ],
      occupations: [{ c: '15-1252.00', n: 'Software Engineers' }],
      industries: [{ c: '51', n: 'Tech' }],
      rows: [
        [0, 0, 1, 120000, 80000, 4, 40, 4, "Bachelor's", 0, 3, 0.9, 50000, 15.5, 1.0, 120000],
      ],
      map: {},
    });
    expect(listStates().states).toEqual([
      { area_code: '99', area_name: 'National' },
      { area_code: '6', area_name: 'California' },
      { area_code: '36', area_name: 'New York' },
    ]);
  });

  it('maps bundle map cells to area codes', () => {
    const summary = getMapSummary();
    expect(summary.states['99']).toEqual({
      hasRecords: true,
      avgSalary: 86666.7,
      adjustedSalary: 86666.7,
      medianRoi: 25,
      highRoiCount: 2,
      demandCount: 2,
      demandAvgRank: 2,
    });
    expect(summary.states['6']?.highRoiCount).toBe(2);
    // Areas without a map cell are absent.
    expect(summary.states['36']).toBeUndefined();
  });

  it('preserves a missing break-even as null instead of substituting 0', () => {
    loadCatalog({
      ...fixture,
      rows: [
        ...fixture.rows,
        [0, 0, 7, 90000, 50000, null, 30, 4, "Bachelor's", 0, 4, 0.8, 10000, 5, 1.0, 90000],
      ],
      counts: { ...fixture.counts, rows: 7 },
    });
    expect(findLocalById(7)?.years_to_breakeven).toBeNull();
  });

  it('returns a whole state on one large-per_page roi query with nulls first', () => {
    // MapScreen slices the top-5 client-side: roi-desc sorts null-ROI rows
    // first (Postgres NULLS FIRST), so a paged 15-row cut would strand the
    // highest-ROI rows past 15+ null-ROI rows. The whole state must be
    // retrievable in a single query.
    const nullRows = Array.from(
      { length: 20 },
      (_, i) =>
        [
          0, 0, 100 + i, 50000, 30000, null, null, 3, "Bachelor's", 0,
          null, null, null, null, 1.0, 50000,
        ] as CatalogBundle['rows'][number]
    );
    loadCatalog({
      version: 1,
      generated_at: '2026-01-01T00:00:00Z',
      source: 'test',
      counts: { areas: 1, industries: 1, occupations: 1, rows: 21 },
      areas: [{ c: '6', n: 'California' }],
      occupations: [{ c: '15-1252.00', n: 'Software Engineers' }],
      industries: [{ c: '51', n: 'Tech' }],
      rows: [
        ...nullRows,
        [0, 0, 200, 200000, 100000, 2, 99, 4, "Bachelor's", 0, 1, 0.99, 90000, 20, 1.0, 200000],
      ],
      map: {},
    });
    const all = queryCatalog({ area_code: '6', sort: 'roi', per_page: Number.MAX_SAFE_INTEGER }).records;
    expect(all).toHaveLength(21);
    // Null-ROI rows sort first; the highest-ROI row sits past position 15.
    expect(all[20]?.id).toBe(200);
    expect(
      ids(queryCatalog({ area_code: '6', sort: 'roi', per_page: 15 }).records)
    ).not.toContain(200);
  });

  describe('hydrateLikedFromCatalog', () => {
    const right = (id: number, career_id: number) => ({
      id,
      career_id,
      direction: 'right' as const,
      created_at: '2026-01-01T00:00:00Z',
    });

    it('returns null for an empty bundle', () => {
      loadCatalog({
        ...fixture,
        rows: [],
        map: {},
        counts: { areas: 0, industries: 0, occupations: 0, rows: 0 },
      });
      expect(hydrateLikedFromCatalog([right(1, 1)])).toBeNull();
    });

    it('hydrates right swipes and skips other directions', () => {
      const out = hydrateLikedFromCatalog([
        right(1, 1),
        { id: 2, career_id: 2, direction: 'left' as const, created_at: '2026-01-01T00:00:00Z' },
      ]);
      expect(out?.map(r => r.swipe_id)).toEqual([1]);
      expect(out?.[0]?.id).toBe(1);
    });

    it('returns null when any right swipe is outside the feed-only bundle', () => {
      // A metro like must fall back to the server list, never vanish.
      expect(hydrateLikedFromCatalog([right(1, 1), right(2, 999)])).toBeNull();
    });
  });

  describe('getLikedCareersOrFallback', () => {
    const right = (id: number, career_id: number) => ({
      id,
      career_id,
      direction: 'right' as const,
      created_at: '2026-01-01T00:00:00Z',
    });

    beforeEach(() => {
      getSwipeHistory.mockReset().mockResolvedValue({ swipes: [] });
      getLikedCareers.mockReset().mockResolvedValue({ records: [] });
    });

    it('goes straight to the server list when the bundle is empty', async () => {
      loadCatalog({
        ...fixture,
        rows: [],
        map: {},
        counts: { areas: 0, industries: 0, occupations: 0, rows: 0 },
      });
      getLikedCareers.mockResolvedValue({ records: [{ id: 9 }] });
      await expect(getLikedCareersOrFallback()).resolves.toEqual({ records: [{ id: 9 }] });
      expect(getSwipeHistory).not.toHaveBeenCalled();
      expect(getLikedCareers).toHaveBeenCalled();
    });

    it('hydrates locally with no list call when every like is bundled', async () => {
      getSwipeHistory.mockResolvedValue({ swipes: [right(7, 1), right(8, 2)] });
      const json = await getLikedCareersOrFallback();
      expect(json.records.map(r => r.id)).toEqual([1, 2]);
      expect(json.records.map(r => r.swipe_id)).toEqual([7, 8]);
      expect(getLikedCareers).not.toHaveBeenCalled();
    });

    it('falls back to the server list when a like is outside the bundle', async () => {
      getSwipeHistory.mockResolvedValue({ swipes: [right(7, 999)] });
      getLikedCareers.mockResolvedValue({ records: [{ id: 999 }] });
      await expect(getLikedCareersOrFallback()).resolves.toEqual({ records: [{ id: 999 }] });
      expect(getLikedCareers).toHaveBeenCalled();
    });
  });

  describe('queryCareers server fallback', () => {
    beforeEach(() => {
      loadCatalog({
        ...fixture,
        rows: [],
        map: {},
        counts: { areas: 0, industries: 0, occupations: 0, rows: 0 },
      });
      (apiClient.getCareers as jest.Mock).mockReset().mockResolvedValue({ records: [] });
    });

    it('forwards an explicit roi sort so both paths order unsorted requests identically', async () => {
      await queryCareers({ page: 1, area_code: '99' });
      expect(apiClient.getCareers).toHaveBeenCalledWith({ page: 1, area_code: '99', sort: 'roi' });
    });

    it('forwards no area when none is given, matching the unscoped server feed', async () => {
      await queryCareers({});
      expect(apiClient.getCareers).toHaveBeenCalledWith({ sort: 'roi' });
    });
  });

  describe('findOccupationName', () => {
    it('resolves occupation names by code from the bundle table', () => {
      expect(findOccupationName('15-1252.00')).toBe('Software Engineers');
      expect(findOccupationName('29-1141.00')).toBe('Registered Nurses');
      expect(findOccupationName('99-9999.00')).toBeUndefined();
    });
  });
});
