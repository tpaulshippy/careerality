import { CareerROI, SwipeApiRecord } from '../types';
import { getOccupationGroup } from './occupationGroup';

export type { CareerROI, SwipeApiRecord };

// Liked career as returned by GET /api/swipes/liked
export type LikedCareer = CareerROI & {
  swipe_id: number;
  swiped_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toNum = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : null;
};

const average = (nums: number[]): number | null => {
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
};

const median = (nums: number[]): number | null => {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface ActivityStats {
  totalReviewed: number;
  totalLiked: number;
  likeRate: number;
  reviewsThisWeek: number;
  reviewsLastWeek: number;
  weekChangePct: number | null;
}

/**
 * Activity summary over rolling 7-day windows ending at `now`.
 * `now` is injectable (ms epoch) for testability.
 */
export function computeActivityStats(
  swipes: SwipeApiRecord[],
  now: number = Date.now()
): ActivityStats {
  const thisWeekStart = now - 7 * DAY_MS;
  const lastWeekStart = now - 14 * DAY_MS;

  let reviewsThisWeek = 0;
  let reviewsLastWeek = 0;
  let totalLiked = 0;

  for (const swipe of swipes) {
    const at = new Date(swipe.created_at).getTime();
    if (!Number.isNaN(at)) {
      if (at >= thisWeekStart && at <= now) {
        reviewsThisWeek += 1;
      } else if (at >= lastWeekStart && at < thisWeekStart) {
        reviewsLastWeek += 1;
      }
    }
    if (swipe.direction === 'right') {
      totalLiked += 1;
    }
  }

  const totalReviewed = swipes.length;
  const weekChangePct =
    reviewsLastWeek > 0 ? ((reviewsThisWeek - reviewsLastWeek) / reviewsLastWeek) * 100 : null;

  return {
    totalReviewed,
    totalLiked,
    likeRate: totalReviewed > 0 ? (totalLiked / totalReviewed) * 100 : 0,
    reviewsThisWeek,
    reviewsLastWeek,
    weekChangePct,
  };
}

// Friendly labels for feedback keys. Covers current interest-level keys plus
// legacy/alternate reason keys so any history renders nicely.
const FEEDBACK_LABELS: Record<string, string> = {
  very_interested: 'Very interested',
  somewhat_interested: 'Somewhat interested',
  mild_interest: 'Mild interest',
  salary: 'Pay & benefits',
  environment: 'Work environment',
  skills: 'Uses my skills',
  security: 'Job security',
  balance: 'Work-life balance',
};

const labelForFeedbackKey = (key: string): string =>
  FEEDBACK_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export interface FeedbackSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
}

/**
 * Distribution of right-swipe feedback reasons.
 * Returns [] when no right swipes carry feedback.
 */
export function computeFeedbackDistribution(swipes: SwipeApiRecord[]): FeedbackSlice[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const swipe of swipes) {
    if (swipe.direction === 'right' && swipe.feedback) {
      counts.set(swipe.feedback, (counts.get(swipe.feedback) ?? 0) + 1);
      total += 1;
    }
  }

  if (total === 0) return [];

  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: labelForFeedbackKey(key),
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export interface TasteGroup {
  group: string;
  count: number;
}

/** Top occupation groups among liked careers, sorted by count desc (ties alphabetical). */
export function computeTasteProfile(liked: LikedCareer[], topN: number = 6): TasteGroup[] {
  const counts = new Map<string, number>();

  for (const career of liked) {
    const group = getOccupationGroup(career.occupation_code);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))
    .slice(0, topN);
}

export interface CatalogStats {
  medianRoi: number;
  medianSalary: number;
  medianBreakeven: number;
  sampleSize: number;
}

export function computeCatalogStats(catalog: CareerROI[]): CatalogStats | null {
  if (catalog.length === 0) return null;

  const rois = catalog.map((c) => toNum(c.roi_percentage)).filter((n): n is number => n !== null);
  const salaries = catalog
    .map((c) => toNum(c.annual_median_salary))
    .filter((n): n is number => n !== null);
  const breakevens = catalog
    .map((c) => c.years_to_breakeven)
    .filter((n): n is number => typeof n === 'number');

  return {
    medianRoi: median(rois) ?? 0,
    medianSalary: median(salaries) ?? 0,
    medianBreakeven: median(breakevens) ?? 0,
    sampleSize: catalog.length,
  };
}

export interface QualityStats {
  avgRoi: number;
  medianSalary: number;
  avgBreakeven: number;
  catalog: CatalogStats;
  insights: string[];
}

/**
 * Compares liked-career stats against a catalog sample and produces friendly
 * insight sentences. Returns null when either side has no usable data.
 */
export function computeQualityOfInterest(
  liked: LikedCareer[],
  catalog: CareerROI[]
): QualityStats | null {
  const catalogStats = computeCatalogStats(catalog);
  if (catalogStats === null || liked.length === 0) return null;

  const rois = liked.map((c) => toNum(c.roi_percentage)).filter((n): n is number => n !== null);
  const salaries = liked
    .map((c) => toNum(c.annual_median_salary))
    .filter((n): n is number => n !== null);
  const breakevens = liked
    .map((c) => c.years_to_breakeven)
    .filter((n): n is number => typeof n === 'number');

  const avgRoi = average(rois);
  const medianSalary = median(salaries);
  const avgBreakeven = average(breakevens);
  if (avgRoi === null && medianSalary === null && avgBreakeven === null) return null;

  const insights: string[] = [];
  const pctDiff = (likedVal: number, catalogVal: number): number =>
    catalogVal !== 0 ? ((likedVal - catalogVal) / catalogVal) * 100 : 0;

  if (medianSalary !== null) {
    const diff = pctDiff(medianSalary, catalogStats.medianSalary);
    if (diff >= 15) {
      insights.push(
        `You like higher-paying careers than average — about ${Math.round(diff)}% above typical`
      );
    } else if (diff <= -15) {
      insights.push(
        `You're drawn to simpler paths — your picks pay about ${Math.abs(Math.round(diff))}% less than typical`
      );
    } else {
      insights.push('Your salary tastes are close to the national middle');
    }
  }

  if (avgRoi !== null) {
    const diff = pctDiff(avgRoi, catalogStats.medianRoi);
    if (diff >= 15) {
      insights.push('You favor strong-return paths with better education payoff');
    } else if (diff <= -15) {
      insights.push("You care less about raw ROI — passion over spreadsheets");
    } else {
      insights.push('Your ROI instincts track the national average');
    }
  }

  if (avgBreakeven !== null) {
    const faster = avgBreakeven < catalogStats.medianBreakeven - 0.25;
    const slower = avgBreakeven > catalogStats.medianBreakeven + 0.25;
    if (faster) {
      insights.push('You prefer careers that pay back their training costs quickly');
    } else if (slower) {
      insights.push("You're patient about payback — long-game careers appeal to you");
    } else {
      insights.push('Your break-even pace matches the typical career');
    }
  }

  return {
    avgRoi: avgRoi ?? 0,
    medianSalary: medianSalary ?? 0,
    avgBreakeven: avgBreakeven ?? 0,
    catalog: catalogStats,
    insights,
  };
}

export interface StandoutPicks {
  highestRoi: LikedCareer | null;
  highestSalary: LikedCareer | null;
  fastestBreakeven: LikedCareer | null;
}

/** Standout liked careers; ties resolve to the first occurrence for stable results. */
export function computeStandoutPicks(liked: LikedCareer[]): StandoutPicks {
  if (liked.length === 0) {
    return { highestRoi: null, highestSalary: null, fastestBreakeven: null };
  }

  let highestRoi = liked[0];
  let highestSalary = liked[0];
  let fastestBreakeven = liked[0];

  for (const career of liked.slice(1)) {
    if (
      (toNum(career.roi_percentage) ?? -Infinity) >
      (toNum(highestRoi.roi_percentage) ?? -Infinity)
    ) {
      highestRoi = career;
    }
    if (
      (toNum(career.annual_median_salary) ?? -Infinity) >
      (toNum(highestSalary.annual_median_salary) ?? -Infinity)
    ) {
      highestSalary = career;
    }
    if (
      (career.years_to_breakeven ?? Infinity) <
      (fastestBreakeven.years_to_breakeven ?? Infinity)
    ) {
      fastestBreakeven = career;
    }
  }

  return { highestRoi, highestSalary, fastestBreakeven };
}
