import { CareerROI } from '../types';

export type MetricKey = 'avg_salary' | 'adjusted_salary' | 'median_roi' | 'demand' | 'high_roi';

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** When true, lower raw values map to the hot end of the color ramp. */
  inverted: boolean;
}

export interface StateMetrics {
  /** Whether any ROI records exist for the state, regardless of field quality. */
  hasRecords: boolean;
  avgSalary: number | null;
  adjustedSalary: number | null;
  medianRoi: number | null;
  highRoiCount: number;
  demandCount: number;
  demandAvgRank: number | null;
}

export const HIGH_ROI_THRESHOLD = 15;

export const METRICS: MetricDef[] = [
  { key: 'avg_salary', label: 'Avg salary', inverted: false },
  { key: 'adjusted_salary', label: 'Adjusted salary', inverted: false },
  { key: 'median_roi', label: 'Median ROI', inverted: false },
  { key: 'demand', label: 'Demand hotspots', inverted: true },
];

const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(
  [...METRICS, { key: 'high_roi', label: 'High ROI count', inverted: false }].map(m => [m.key, m]),
) as Record<MetricKey, MetricDef>;

export const getMetricDef = (key: MetricKey): MetricDef => METRIC_BY_KEY[key];

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

export const computeStateMetrics = (records: CareerROI[]): StateMetrics => {
  const salaries: number[] = [];
  const adjustedSalaries: number[] = [];
  const rois: number[] = [];
  let highRoiCount = 0;
  let demandCount = 0;
  const demandRanks: number[] = [];
  let hasRecords = false;

  for (const record of records ?? []) {
    if (!record) continue;
    hasRecords = true;
    const salary = toNumber(record.annual_median_salary);
    if (salary !== null) salaries.push(salary);
    const adjusted = toNumber(record.adjusted_salary);
    if (adjusted !== null) adjustedSalaries.push(adjusted);
    const roi = toNumber(record.roi_percentage);
    if (roi !== null) {
      rois.push(roi);
      if (roi >= HIGH_ROI_THRESHOLD) highRoiCount += 1;
    }
    const hasDemandInfo =
      toNumber(record.demand_score) !== null || record.demand_rank != null;
    if (hasDemandInfo) {
      demandCount += 1;
      const rank = toNumber(record.demand_rank);
      if (rank !== null && rank >= 0) demandRanks.push(rank);
    }
  }

  return {
    hasRecords,
    avgSalary: mean(salaries),
    adjustedSalary: mean(adjustedSalaries),
    medianRoi: median(rois),
    highRoiCount,
    demandCount,
    demandAvgRank: mean(demandRanks),
  };
};

/** Raw display value for a metric; null means "no data". */
export const getStateMetricValue = (
  metrics: StateMetrics | undefined,
  key: MetricKey,
): number | null => {
  if (!metrics) return null;
  switch (key) {
    case 'avg_salary':
      return metrics.avgSalary;
    case 'adjusted_salary':
      return metrics.adjustedSalary;
    case 'median_roi':
      return metrics.medianRoi;
    case 'high_roi':
      // Record presence, not salary presence, decides whether ROI data exists.
      return metrics.hasRecords ? metrics.highRoiCount : null;
    case 'demand': {
      // A state counts as having data when any career carries demand info,
      // even if ranks themselves are missing.
      if (metrics.demandCount === 0) return null;
      return metrics.demandAvgRank;
    }
    default:
      return null;
  }
};

export const formatMetricValue = (key: MetricKey, value: number | null): string => {
  if (value === null) return 'No data';
  switch (key) {
    case 'avg_salary':
    case 'adjusted_salary':
      return `$${Math.round(value).toLocaleString('en-US')}`;
    case 'median_roi':
      return `${value.toFixed(1)}% median ROI`;
    case 'high_roi':
      return `${value} career${value === 1 ? '' : 's'} with ROI ≥ ${HIGH_ROI_THRESHOLD}%`;
    case 'demand':
      return `avg rank #${value.toFixed(1)} (lower is better)`;
    default:
      return String(value);
  }
};

export const formatLegendLabel = (key: MetricKey, value: number): string => {
  switch (key) {
    case 'avg_salary':
    case 'adjusted_salary':
      return `$${Math.round(value / 1000)}k`;
    case 'median_roi':
      return `${value.toFixed(1)}%`;
    case 'high_roi':
      return String(Math.round(value));
    case 'demand':
      return `#${Math.round(value)}`;
    default:
      return String(Math.round(value));
  }
};

/**
 * Value used to position a state on the color scale. Inverted metrics are
 * negated so that "lower raw value" lands on the hot end of the ramp.
 */
export const getColorValue = (
  metrics: StateMetrics | undefined,
  key: MetricKey,
): number | null => {
  const value = getStateMetricValue(metrics, key);
  if (value === null) return null;
  return METRIC_BY_KEY[key].inverted ? -value : value;
};

export interface Domain {
  min: number;
  max: number;
}

/** Computes min/max over the non-null values; null when nothing has data. */
export const computeDomain = (values: Array<number | null>): Domain | null => {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
};

/** Normalizes a value into [0, 1]; values outside the domain clamp. */
export const normalizeValue = (value: number, domain: Domain): number => {
  if (domain.max === domain.min) return 0.5;
  return Math.min(1, Math.max(0, (value - domain.min) / (domain.max - domain.min)));
};

/** Picks an interpolated-free stop from the ramp; returns null for no-data. */
export const pickRampColor = (ramp: string[], t: number): string => {
  if (ramp.length === 0) throw new Error('Color ramp must not be empty');
  const clamped = Math.min(1, Math.max(0, t));
  const index = Math.round(clamped * (ramp.length - 1));
  return ramp[index];
};

/**
 * Maps a state's metric onto a ramp color.
 * Returns null when the state has no data for the metric.
 */
export const colorForMetrics = (
  metrics: StateMetrics | undefined,
  key: MetricKey,
  domain: Domain | null,
  ramp: string[],
): string | null => {
  const colorValue = getColorValue(metrics, key);
  if (colorValue === null || domain === null) return null;
  return pickRampColor(ramp, normalizeValue(colorValue, domain));
};
