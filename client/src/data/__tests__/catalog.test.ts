import {
  CatalogBundle,
  findLocalById,
  findLocalCareer,
  getCatalogMeta,
  getMapSummary,
  isCatalogEmpty,
  listStates,
  loadCatalog,
  queryCatalog,
  toCareerROI,
} from '../catalog';

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

  it('scopes to area, defaulting to national "99"', () => {
    expect(ids(queryCatalog({}).records)).toEqual([1, 2, 3]);
    expect(ids(queryCatalog({ area_code: '6' }).records)).toEqual([4, 5]);
    expect(ids(queryCatalog({ area_code: '36' }).records)).toEqual([6]);
  });

  it('applies inclusive salary bounds', () => {
    expect(ids(queryCatalog({ min_salary: 80000 }).records)).toEqual([1, 2]);
    expect(ids(queryCatalog({ max_salary: 80000 }).records)).toEqual([2, 3]);
    expect(ids(queryCatalog({ min_salary: 70000, max_salary: 90000 }).records)).toEqual([2]);
  });

  it('sorts by roi desc by default', () => {
    expect(ids(queryCatalog({ sort: 'roi' }).records)).toEqual([1, 2, 3]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'roi' }).records)).toEqual([4, 5]);
  });

  it('sorts by salary desc', () => {
    expect(ids(queryCatalog({ sort: 'salary' }).records)).toEqual([1, 2, 3]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'salary' }).records)).toEqual([4, 5]);
  });

  it('sorts by breakeven asc', () => {
    expect(ids(queryCatalog({ sort: 'breakeven' }).records)).toEqual([1, 2, 3]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'breakeven' }).records)).toEqual([4, 5]);
  });

  it('sorts by demand and drops rows without demand data', () => {
    // National: nurse (0.95) before software (0.9); teacher has no demand data.
    expect(ids(queryCatalog({ sort: 'demand' }).records)).toEqual([2, 1]);
    expect(ids(queryCatalog({ area_code: '6', sort: 'demand' }).records)).toEqual([4]);
  });

  it('falls back to roi desc when no rows have demand data', () => {
    expect(ids(queryCatalog({ area_code: '36', sort: 'demand' }).records)).toEqual([6]);
  });

  it('searches q case-insensitively scoped to the area', () => {
    expect(ids(queryCatalog({ q: 'nurse' }).records)).toEqual([2]);
    expect(ids(queryCatalog({ q: 'NURSE' }).records)).toEqual([2]);
    expect(ids(queryCatalog({ q: '  software ' }).records)).toEqual([1]);
    expect(ids(queryCatalog({ q: 'teacher', area_code: '6' }).records)).toEqual([]);
    expect(ids(queryCatalog({ q: 'teacher', area_code: '36' }).records)).toEqual([6]);
  });

  it('paginates with a pagy shape', () => {
    const first = queryCatalog({ per_page: 2, page: 1 });
    expect(ids(first.records)).toEqual([1, 2]);
    expect(first.pagy).toEqual({ page: 1, items: 2, count: 3, pages: 2 });
    const second = queryCatalog({ per_page: 2, page: 2 });
    expect(ids(second.records)).toEqual([3]);
    expect(second.pagy).toEqual({ page: 2, items: 2, count: 3, pages: 2 });
    const overflow = queryCatalog({ per_page: 2, page: 99 });
    expect(overflow.records).toEqual([]);
    expect(overflow.pagy.pages).toBe(2);
    const empty = queryCatalog({ q: 'zzz-no-match' });
    expect(empty.records).toEqual([]);
    expect(empty.pagy).toEqual({ page: 1, items: 20, count: 0, pages: 1 });
  });

  it('excludes ids', () => {
    expect(ids(queryCatalog({ excludeIds: [1] }).records)).toEqual([2, 3]);
    expect(ids(queryCatalog({ excludeIds: [1, 2, 3] }).records)).toEqual([]);
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

  it('denormalizes decimal fields as strings with no detail columns', () => {
    const career = findLocalById(1);
    expect(career?.annual_median_salary).toBe('120000');
    expect(career?.education_cost).toBe('80000');
    expect(career?.roi_percentage).toBe('40');
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
});
