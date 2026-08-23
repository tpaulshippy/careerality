import {
  CareerROI,
} from '../../types';
import {
  HIGH_ROI_THRESHOLD,
  METRICS,
  colorForMetrics,
  computeDomain,
  computeStateMetrics,
  formatLegendLabel,
  formatMetricValue,
  getColorValue,
  getStateMetricValue,
  normalizeValue,
  pickRampColor,
} from '../mapMetrics';

const makeRecord = (overrides: Partial<CareerROI> = {}): CareerROI => ({
  id: 1,
  occupation_code: '29-1011.00',
  occupation_name: 'Chiropractors',
  area_code: '1',
  area_name: 'Alabama',
  annual_median_salary: '50000.0',
  education_cost: '40000',
  years_to_breakeven: 4,
  roi_percentage: '10.0',
  job_zone: 3,
  education_level: 'Doctoral degree',
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '45000.0',
  industry_code: 'cross-industry',
  industry_name: 'cross-industry',
  demand_rank: null,
  demand_score: null,
  avg_annual_openings: null,
  projected_growth_percent: null,
  ...overrides,
});

describe('computeStateMetrics', () => {
  it('averages string-encoded salaries', () => {
    const metrics = computeStateMetrics([
      makeRecord({ annual_median_salary: '40000.0' }),
      makeRecord({ annual_median_salary: '60000.0' }),
    ]);
    expect(metrics.avgSalary).toBe(50000);
  });

  it('averages adjusted salaries independently of raw salaries', () => {
    const metrics = computeStateMetrics([
      makeRecord({ adjusted_salary: '30000.0' }),
      makeRecord({ adjusted_salary: '50000.0' }),
    ]);
    expect(metrics.adjustedSalary).toBe(40000);
  });

  it('calculates median ROI for state comparisons', () => {
    const metrics = computeStateMetrics([
      makeRecord({ roi_percentage: '6' }),
      makeRecord({ roi_percentage: '12' }),
      makeRecord({ roi_percentage: '9' }),
      makeRecord({ roi_percentage: '30' }),
    ]);
    expect(metrics.medianRoi).toBe(10.5);
  });

  it('returns empty-safe results for an empty record list', () => {
    const metrics = computeStateMetrics([]);
    expect(metrics.avgSalary).toBeNull();
    expect(metrics.adjustedSalary).toBeNull();
    expect(metrics.highRoiCount).toBe(0);
    expect(metrics.demandCount).toBe(0);
    expect(metrics.demandAvgRank).toBeNull();
  });

  it('skips records with missing or malformed salary fields', () => {
    const metrics = computeStateMetrics([
      makeRecord({ annual_median_salary: undefined as unknown as string }),
      makeRecord({ annual_median_salary: '' }),
      makeRecord({ annual_median_salary: 'not-a-number' }),
      makeRecord({ annual_median_salary: '80000.0' }),
    ]);
    expect(metrics.avgSalary).toBe(80000);
  });

  it('tolerates null entries in the record list', () => {
    const metrics = computeStateMetrics([
      null as unknown as CareerROI,
      makeRecord({ annual_median_salary: '20000.0' }),
    ]);
    expect(metrics.avgSalary).toBe(20000);
  });

  it('counts careers at the high-ROI threshold inclusively', () => {
    const metrics = computeStateMetrics([
      makeRecord({ roi_percentage: `${HIGH_ROI_THRESHOLD}.00` }),
      makeRecord({ roi_percentage: `${HIGH_ROI_THRESHOLD - 1}.99` }),
      makeRecord({ roi_percentage: '99' }),
      makeRecord({ roi_percentage: undefined as unknown as string }),
    ]);
    expect(metrics.highRoiCount).toBe(2);
  });

  it('counts demand careers when either score or rank is present', () => {
    const metrics = computeStateMetrics([
      makeRecord({ demand_score: 0.9, demand_rank: 2 }),
      makeRecord({ demand_score: null, demand_rank: 5 }),
      makeRecord({ demand_score: 0.5, demand_rank: null }),
      makeRecord({ demand_score: null, demand_rank: null }),
    ]);
    expect(metrics.demandCount).toBe(3);
    expect(metrics.demandAvgRank).toBe(3.5);
  });

  it('averages demand ranks across ranked careers', () => {
    const metrics = computeStateMetrics([
      makeRecord({ demand_score: 0.9, demand_rank: 1 }),
      makeRecord({ demand_score: 0.8, demand_rank: 3 }),
    ]);
    expect(metrics.demandAvgRank).toBe(2);
  });
});

describe('getStateMetricValue', () => {
  it('exposes each metric', () => {
    const metrics = computeStateMetrics([
      makeRecord({ annual_median_salary: '60000.0', adjusted_salary: '50000.0', roi_percentage: '20', demand_score: 0.7, demand_rank: 4 }),
    ]);
    expect(getStateMetricValue(metrics, 'avg_salary')).toBe(60000);
    expect(getStateMetricValue(metrics, 'adjusted_salary')).toBe(50000);
    expect(getStateMetricValue(metrics, 'high_roi')).toBe(1);
    expect(getStateMetricValue(metrics, 'demand')).toBe(4);
  });

  it('reports high_roi as no-data when a state has no careers at all', () => {
    expect(getStateMetricValue(computeStateMetrics([]), 'high_roi')).toBeNull();
  });

  it('reports high_roi as 0 when careers exist but salaries are missing', () => {
    const metrics = computeStateMetrics([
      makeRecord({ annual_median_salary: null as unknown as string, roi_percentage: '5' }),
      makeRecord({ annual_median_salary: '', roi_percentage: '8' }),
    ]);
    expect(metrics.avgSalary).toBeNull();
    expect(getStateMetricValue(metrics, 'high_roi')).toBe(0);
  });

  it('treats demand states without numeric ranks as no-data for ranking', () => {
    const metrics = computeStateMetrics([
      makeRecord({ demand_score: 0.5, demand_rank: null }),
    ]);
    expect(metrics.demandCount).toBe(1);
    expect(getStateMetricValue(metrics, 'demand')).toBeNull();
  });

  it('returns null for missing state metrics', () => {
    expect(getStateMetricValue(undefined, 'avg_salary')).toBeNull();
  });
});

describe('getColorValue / inversion', () => {
  it('negates the inverted demand metric and leaves others untouched', () => {
    const metrics = computeStateMetrics([makeRecord({ demand_rank: 3, demand_score: 0.9 })]);
    expect(getColorValue(metrics, 'demand')).toBe(-3);
    expect(getColorValue(metrics, 'avg_salary')).toBe(50000);
  });

  it('marks exactly one metric as inverted', () => {
    const inverted = METRICS.filter(m => m.inverted);
    expect(inverted.map(m => m.key)).toEqual(['demand']);
  });
});

describe('formatMetricValue', () => {
  it('formats currency values with rounding and grouping', () => {
    expect(formatMetricValue('avg_salary', 62810.4)).toBe('$62,810');
  });

  it('pluralizes the high ROI count correctly', () => {
    expect(formatMetricValue('high_roi', 0)).toContain('0 careers');
    expect(formatMetricValue('high_roi', 1)).toContain('1 career ');
  });

  it('formats demand ranks with a lower-is-better hint', () => {
    expect(formatMetricValue('demand', 12.34)).toContain('#12.3');
  });

  it('falls back to No data', () => {
    expect(formatMetricValue('avg_salary', null)).toBe('No data');
  });
});

describe('formatLegendLabel', () => {
  it('abbreviates salary in thousands', () => {
    expect(formatLegendLabel('avg_salary', 62810)).toBe('$63k');
  });

  it('renders counts and ranks as integers', () => {
    expect(formatLegendLabel('high_roi', 7.6)).toBe('8');
    expect(formatLegendLabel('demand', 3.2)).toBe('#3');
  });
});

describe('color scale', () => {
  const ramp = ['#EBF3F8', '#BFDCEC', '#7FB4D2', '#3E8BB5', '#136399'];

  it('computes domains ignoring nulls and non-finite values', () => {
    expect(computeDomain([null, 4, Infinity, -2, NaN])).toEqual({ min: -2, max: 4 });
    expect(computeDomain([null, null])).toBeNull();
    expect(computeDomain([])).toBeNull();
  });

  it('normalizes into [0, 1] and clamps outside the domain', () => {
    const domain = { min: 0, max: 100 };
    expect(normalizeValue(50, domain)).toBe(0.5);
    expect(normalizeValue(-10, domain)).toBe(0);
    expect(normalizeValue(150, domain)).toBe(1);
  });

  it('centers a single-value domain to avoid division by zero', () => {
    expect(normalizeValue(42, { min: 42, max: 42 })).toBe(0.5);
  });

  it('walks ramp stops monotonically from light to dark', () => {
    expect(pickRampColor(ramp, 0)).toBe(ramp[0]);
    expect(pickRampColor(ramp, 0.24)).toBe(ramp[1]);
    expect(pickRampColor(ramp, 1)).toBe(ramp[4]);
  });

  it('clamps normalized positions outside [0, 1]', () => {
    expect(pickRampColor(ramp, -5)).toBe(ramp[0]);
    expect(pickRampColor(ramp, 5)).toBe(ramp[4]);
  });

  it('rejects an empty ramp', () => {
    expect(() => pickRampColor([], 0.5)).toThrow();
  });

  it('colors states by metric position and returns null for no-data', () => {
    const low = computeStateMetrics([makeRecord({ annual_median_salary: '10000.0' })]);
    const high = computeStateMetrics([makeRecord({ annual_median_salary: '190000.0' })]);
    const domain = computeDomain([10000, 190000]);
    expect(colorForMetrics(low, 'avg_salary', domain, ramp)).toBe(ramp[0]);
    expect(colorForMetrics(high, 'avg_salary', domain, ramp)).toBe(ramp[4]);
    expect(colorForMetrics(undefined, 'avg_salary', domain, ramp)).toBeNull();
    expect(colorForMetrics(low, 'avg_salary', null, ramp)).toBeNull();
  });

  it('maps low demand rank (best) to the hot end via inversion', () => {
    const best = computeStateMetrics([makeRecord({ demand_rank: 1, demand_score: 0.9 })]);
    const worst = computeStateMetrics([makeRecord({ demand_rank: 50, demand_score: 0.1 })]);
    const domain = computeDomain([-50, -1]);
    expect(colorForMetrics(best, 'demand', domain, ramp)).toBe(ramp[4]);
    expect(colorForMetrics(worst, 'demand', domain, ramp)).toBe(ramp[0]);
  });
});
