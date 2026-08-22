import { CareerROI } from '../types';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';

export type CompareDirection = 'higher' | 'lower';

export type CompareMetricKey =
  | 'median_salary'
  | 'adjusted_salary'
  | 'roi'
  | 'breakeven'
  | 'demand_rank';

export interface CompareCell {
  value: number | null;
  display: string;
}

export interface CompareRow {
  key: CompareMetricKey;
  label: string;
  direction: CompareDirection;
  cells: CompareCell[];
  bestIndex: number | null;
  worstIndex: number | null;
}

interface MetricConfig {
  key: CompareMetricKey;
  label: string;
  direction: CompareDirection;
  getValue: (career: CareerROI) => number | null;
  format: (value: number) => string;
}

export const MIN_BAR_FRACTION = 0.18;

const toNumber = (input: string | number): number | null => {
  const parsed = typeof input === 'string' ? parseFloat(input) : input;
  return Number.isFinite(parsed) ? parsed : null;
};

const METRICS: MetricConfig[] = [
  {
    key: 'median_salary',
    label: 'Median Salary',
    direction: 'higher',
    getValue: (c) => toNumber(c.annual_median_salary),
    format: formatCurrency,
  },
  {
    key: 'adjusted_salary',
    label: 'Adjusted Salary (w/ COL)',
    direction: 'higher',
    getValue: (c) => toNumber(c.adjusted_salary),
    format: formatCurrency,
  },
  {
    key: 'roi',
    label: 'ROI',
    direction: 'higher',
    getValue: (c) => toNumber(c.roi_percentage),
    format: formatPercent,
  },
  {
    key: 'breakeven',
    label: 'Years to Break-Even',
    direction: 'lower',
    getValue: (c) => (Number.isFinite(c.years_to_breakeven) ? c.years_to_breakeven : null),
    format: (v) => `${v} yr`,
  },
  {
    key: 'demand_rank',
    label: 'Demand Rank',
    direction: 'lower',
    getValue: (c) => c.demand_rank,
    format: (v) => `#${v}`,
  },
];

const extremes = (
  values: Array<number | null>,
  direction: CompareDirection
): { best: number; worst: number } | null => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (min === max) return null;
  return direction === 'higher' ? { best: max, worst: min } : { best: min, worst: max };
};

export const buildCompareRows = (careers: CareerROI[]): CompareRow[] =>
  METRICS.map((config) => {
    const cells = careers.map((career) => {
      const value = config.getValue(career);
      return { value, display: value === null ? '—' : config.format(value) };
    });

    let bestIndex: number | null = null;
    let worstIndex: number | null = null;
    const bounds = extremes(
      cells.map((cell) => cell.value),
      config.direction
    );
    if (bounds) {
      bestIndex = cells.findIndex((cell) => cell.value === bounds.best);
      worstIndex = cells.findIndex((cell) => cell.value === bounds.worst);
    }

    return {
      key: config.key,
      label: config.label,
      direction: config.direction,
      cells,
      bestIndex,
      worstIndex,
    };
  });

export const barFractions = (values: Array<number | null>): number[] => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return values.map(() => 0);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((value) => {
    if (value === null) return 0;
    if (max === min) return 1;
    const fraction = MIN_BAR_FRACTION + (1 - MIN_BAR_FRACTION) * ((value - min) / (max - min));
    return Math.round(fraction * 10000) / 10000;
  });
};

export const orderCareersByIds = <T extends CareerROI>(
  available: T[],
  ids: number[]
): T[] => {
  const byId = new Map(available.map((career) => [career.id, career]));
  return ids
    .map((id) => byId.get(id))
    .filter((career): career is T => career !== undefined);
};
