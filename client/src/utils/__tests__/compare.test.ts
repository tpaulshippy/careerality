import { CareerROI } from '../../types';
import {
  buildCompareRows,
  barFractions,
  orderCareersByIds,
} from '../compare';

const career = (overrides: Partial<CareerROI>): CareerROI => ({
  id: 1,
  occupation_code: '15-1252.00',
  occupation_name: 'Software Developers',
  area_code: '99',
  area_name: 'U.S.',
  annual_median_salary: '100000',
  education_cost: '40000',
  years_to_breakeven: 2,
  roi_percentage: '150',
  job_zone: 4,
  education_level: "Bachelor's degree",
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '100000',
  industry_code: '54',
  industry_name: 'Professional Services',
  demand_rank: 10,
  demand_score: 80,
  avg_annual_openings: 1000,
  projected_growth_percent: 20,
  ...overrides,
});

describe('buildCompareRows', () => {
  it('marks the higher value as best for higher-better metrics', () => {
    const rows = buildCompareRows([
      career({ id: 1, annual_median_salary: '80000', adjusted_salary: '80000' }),
      career({ id: 2, annual_median_salary: '120000', adjusted_salary: '120000' }),
    ]);

    const salaryRow = rows.find((row) => row.key === 'median_salary');
    expect(salaryRow?.bestIndex).toBe(1);
    expect(salaryRow?.worstIndex).toBe(0);
  });

  it('inverts best and worst for lower-better metrics like years to break-even', () => {
    const rows = buildCompareRows([
      career({ id: 1, years_to_breakeven: 5 }),
      career({ id: 2, years_to_breakeven: 1.5 }),
    ]);

    const breakevenRow = rows.find((row) => row.key === 'breakeven');
    expect(breakevenRow?.direction).toBe('lower');
    expect(breakevenRow?.bestIndex).toBe(1);
    expect(breakevenRow?.worstIndex).toBe(0);
    expect(breakevenRow?.cells[1].display).toBe('1.5 yr');
  });

  it('treats a null demand rank as missing rather than zero', () => {
    const rows = buildCompareRows([
      career({ id: 1, demand_rank: null }),
      career({ id: 2, demand_rank: 3 }),
      career({ id: 3, demand_rank: 7 }),
    ]);

    const demandRow = rows.find((row) => row.key === 'demand_rank');
    expect(demandRow?.cells[0]).toEqual({ value: null, display: '—' });
    expect(demandRow?.bestIndex).toBe(1);
    expect(demandRow?.worstIndex).toBe(2);
  });

  it('returns no best or worst when values are tied', () => {
    const rows = buildCompareRows([
      career({ id: 1, annual_median_salary: '90000' }),
      career({ id: 2, annual_median_salary: '90000' }),
    ]);

    const salaryRow = rows.find((row) => row.key === 'median_salary');
    expect(salaryRow?.bestIndex).toBeNull();
    expect(salaryRow?.worstIndex).toBeNull();
  });

  it('skips best highlight when the top value is tied but worst is unique', () => {
    const rows = buildCompareRows([
      career({ id: 1, annual_median_salary: '95000' }),
      career({ id: 2, annual_median_salary: '95000' }),
      career({ id: 3, annual_median_salary: '60000' }),
    ]);

    const salaryRow = rows.find((row) => row.key === 'median_salary');
    expect(salaryRow?.bestIndex).toBeNull();
    expect(salaryRow?.worstIndex).toBe(2);
  });

  it('skips worst highlight when the bottom value is tied but best is unique', () => {
    const rows = buildCompareRows([
      career({ id: 1, annual_median_salary: '120000' }),
      career({ id: 2, annual_median_salary: '45000' }),
      career({ id: 3, annual_median_salary: '45000' }),
    ]);

    const salaryRow = rows.find((row) => row.key === 'median_salary');
    expect(salaryRow?.bestIndex).toBe(0);
    expect(salaryRow?.worstIndex).toBeNull();
  });

  it('formats metric display values', () => {
    const rows = buildCompareRows([
      career({ id: 1, annual_median_salary: '123456', roi_percentage: '88.4' }),
      career({ id: 2 }),
    ]);

    const salaryRow = rows.find((row) => row.key === 'median_salary');
    expect(salaryRow?.cells[0].display).toBe('$123,456');
    const roiRow = rows.find((row) => row.key === 'roi');
    expect(roiRow?.cells[0].display).toBe('88.4%');
  });

  it('produces one cell per career for every metric', () => {
    const rows = buildCompareRows([career({ id: 1 }), career({ id: 2 }), career({ id: 3 })]);
    expect(rows.map((row) => row.key)).toEqual([
      'median_salary',
      'adjusted_salary',
      'roi',
      'breakeven',
      'demand_rank',
    ]);
    rows.forEach((row) => expect(row.cells).toHaveLength(3));
  });
});

describe('barFractions', () => {
  it('scales values proportionally between min and max', () => {
    expect(barFractions([0, 50, 100])).toEqual([0.18, 0.59, 1]);
  });

  it('gives full width when all present values are equal', () => {
    expect(barFractions([70, 70, 70])).toEqual([1, 1, 1]);
  });

  it('returns zero fraction for null values', () => {
    expect(barFractions([null, 40])).toEqual([0, 1]);
    expect(barFractions([null, null])).toEqual([0, 0]);
  });
});

describe('orderCareersByIds', () => {
  it('returns careers in selection order and skips missing ids', () => {
    const available = [career({ id: 7 }), career({ id: 3 }), career({ id: 9 })];
    expect(orderCareersByIds(available, [9, 3, 99, 7])).toEqual([
      career({ id: 9 }),
      career({ id: 3 }),
      career({ id: 7 }),
    ]);
  });

  it('preserves duplicates in the requested order', () => {
    const available = [career({ id: 5 })];
    expect(orderCareersByIds(available, [5, 5])).toHaveLength(2);
  });
});
