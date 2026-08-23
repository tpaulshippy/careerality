import { CareerROI } from '../types';
import { getOccupationGroup } from './occupationGroup';

export type GamificationEventType =
  | 'swipe_right'
  | 'swipe_left'
  | 'feedback'
  | 'detail_view'
  | 'compare';

/** Events that may only be awarded once per UTC day per subject (career). */
const DAILY_IDEMPOTENT_TYPES: ReadonlySet<GamificationEventType> = new Set([
  'detail_view',
  'compare',
]);

export const XP_REWARDS: Record<GamificationEventType, number> = {
  swipe_right: 10,
  swipe_left: 5,
  feedback: 10,
  detail_view: 2,
  compare: 2,
};

export interface XpEvent {
  type: GamificationEventType;
  /** Career context; supplies idempotency subject and like-aggregate data. */
  career?: CareerROI;
  /** Explicit idempotency subject when no career applies. */
  subjectId?: string | number;
}

export interface CompactEvent {
  t: GamificationEventType;
  ts: number;
}

export interface GamificationState {
  version: number;
  xp: number;
  totalReviews: number;
  likes: number;
  passes: number;
  feedbacks: number;
  detailOpens: number;
  likedGroups: string[];
  likedEducationLevels: string[];
  likedMaxRoiPercent: number | null;
  likedMinBreakevenYears: number | null;
  likedSkillFirst: boolean;
  /** Sorted unique UTC date keys (YYYY-MM-DD) with activity. */
  activeDates: string[];
  /** achievementId -> ISO unlock timestamp. */
  achievements: Record<string, string>;
  /** `${date}|${type}|${subject}` -> award marker for daily-idempotent events. */
  dailyIdempotency: Record<string, number>;
  events: CompactEvent[];
}

export const GAMIFICATION_STATE_VERSION = 1;
const MAX_EVENTS = 200;
const DAY_MS = 86_400_000;

const GRADUATE_EDUCATION_PATTERN = /master|doctoral|professional|graduate/i;
const SKILL_FIRST_EDUCATION_PATTERN = /less than high school|high school diploma|no formal/i;

// ---------------------------------------------------------------------------
// Date helpers (UTC-safe)
// ---------------------------------------------------------------------------

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const utcDateKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const dateKeyToMs = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole-day difference between two UTC date keys (`a - b`). */
export const dayKeyDiff = (a: string, b: string): number =>
  Math.round((dateKeyToMs(a) - dateKeyToMs(b)) / DAY_MS);

export const shiftDateKey = (key: string, days: number): string =>
  utcDateKey(new Date(dateKeyToMs(key) + days * DAY_MS));

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * Cumulative XP required to reach `level`.
 * Reaching level n costs 100 * n * (n + 1) / 2 XP on top of level n-1,
 * so xpForLevel(1)=0, xpForLevel(2)=100, xpForLevel(3)=300, xpForLevel(4)=600...
 */
export const xpForLevel = (level: number): number => {
  const n = Math.max(1, Math.floor(level));
  if (n <= 1) return 0;
  return (100 * (n - 1) * n) / 2;
};

export const levelForXp = (xp: number): number => {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while ((100 * level * (level + 1)) / 2 <= safe) {
    level += 1;
  }
  return level;
};

export interface LevelProgress {
  level: number;
  /** Total XP held. */
  totalXp: number;
  /** Cumulative XP at which the current level started. */
  currentLevelStartXp: number;
  /** Cumulative XP required for the next level. */
  nextLevelXp: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP still needed for the next level. */
  xpRemaining: number;
  /** 0..1 progress through the current level. */
  fraction: number;
}

export const progressToNext = (xp: number): LevelProgress => {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = Math.max(0, Math.floor(xp) - start);
  const span = next - start;
  return {
    level,
    totalXp: Math.max(0, Math.floor(xp)),
    currentLevelStartXp: start,
    nextLevelXp: next,
    xpIntoLevel: into,
    xpRemaining: span - into,
    fraction: span > 0 ? Math.min(1, into / span) : 1,
  };
};

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/**
 * Consecutive-day streak ending today (or yesterday while today is still young).
 * `activeDates` and `today` are UTC YYYY-MM-DD keys.
 */
export const currentStreak = (activeDates: string[], today: string): number => {
  if (activeDates.length === 0) return 0;
  const set = new Set(activeDates);
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = shiftDateKey(today, -1);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
};

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface GamificationStats {
  totalReviews: number;
  likes: number;
  feedbacks: number;
  detailOpens: number;
  currentStreak: number;
  likedGroupCount: number;
  likedGraduate: boolean;
  likedSkillFirst: boolean;
  likedMaxRoiPercent: number | null;
  likedMinBreakevenYears: number | null;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (stats: GamificationStats) => boolean;
}

export const computeStats = (
  state: GamificationState,
  today: string = utcDateKey(new Date()),
): GamificationStats => ({
  totalReviews: state.totalReviews,
  likes: state.likes,
  feedbacks: state.feedbacks,
  detailOpens: state.detailOpens,
  currentStreak: currentStreak(state.activeDates, today),
  likedGroupCount: state.likedGroups.length,
  likedGraduate: state.likedEducationLevels.some((lvl) => GRADUATE_EDUCATION_PATTERN.test(lvl)),
  likedSkillFirst: state.likedSkillFirst,
  likedMaxRoiPercent: state.likedMaxRoiPercent,
  likedMinBreakevenYears: state.likedMinBreakevenYears,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first career review',
    icon: '👣',
    check: (s) => s.totalReviews >= 1,
  },
  {
    id: 'curious-mind',
    title: 'Curious Mind',
    description: 'Review 25 careers',
    icon: '🧠',
    check: (s) => s.totalReviews >= 25,
  },
  {
    id: 'deep-diver',
    title: 'Deep Diver',
    description: 'Open 10 career deep dives',
    icon: '🔍',
    check: (s) => s.detailOpens >= 10,
  },
  {
    id: 'feedback-pro',
    title: 'Feedback Pro',
    description: 'Rate your interest 10 times',
    icon: '💬',
    check: (s) => s.feedbacks >= 10,
  },
  {
    id: 'shortlister',
    title: 'Shortlister',
    description: 'Like 3 careers',
    icon: '⭐',
    check: (s) => s.likes >= 3,
  },
  {
    id: 'roi-hunter',
    title: 'ROI Hunter',
    description: 'Like a career with 15%+ ROI',
    icon: '📈',
    check: (s) => s.likedMaxRoiPercent !== null && s.likedMaxRoiPercent >= 15,
  },
  {
    id: 'bargain-brain',
    title: 'Bargain Brain',
    description: 'Like a career that breaks even within 2 years',
    icon: '⏱️',
    check: (s) => s.likedMinBreakevenYears !== null && s.likedMinBreakevenYears <= 2,
  },
  {
    id: 'week-warrior',
    title: 'Week Warrior',
    description: 'Keep a 7-day streak alive',
    icon: '🔥',
    check: (s) => s.currentStreak >= 7,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Like careers across 4 occupation groups',
    icon: '🗺️',
    check: (s) => s.likedGroupCount >= 4,
  },
  {
    id: 'grad-track',
    title: 'Grad Track',
    description: 'Like a graduate-level career',
    icon: '🎓',
    check: (s) => s.likedGraduate,
  },
  {
    id: 'skill-first',
    title: 'Skill-First Path',
    description: 'Like a no-degree-required career',
    icon: '🛠️',
    check: (s) => s.likedSkillFirst,
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Review 100 careers',
    icon: '💯',
    check: (s) => s.totalReviews >= 100,
  },
];

export const getAchievement = (id: string): AchievementDef | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);

// ---------------------------------------------------------------------------
// Awarding
// ---------------------------------------------------------------------------

export interface AwardResult {
  state: GamificationState;
  awarded: boolean;
  xpGained: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newlyUnlocked: string[];
}

const noopResult = (state: GamificationState, level: number): AwardResult => ({
  state,
  awarded: false,
  xpGained: 0,
  previousLevel: level,
  newLevel: level,
  leveledUp: false,
  newlyUnlocked: [],
});

const uniqPush = (list: string[], value: string): string[] =>
  list.includes(value) ? list : [...list, value];

const applyLikeAggregates = (state: GamificationState, career: CareerROI): void => {
  if (career.occupation_code) {
    state.likedGroups = uniqPush(state.likedGroups, getOccupationGroup(career.occupation_code));
  }
  if (career.education_level) {
    state.likedEducationLevels = uniqPush(state.likedEducationLevels, career.education_level);
    if (SKILL_FIRST_EDUCATION_PATTERN.test(career.education_level)) {
      state.likedSkillFirst = true;
    }
  }

  const roi = parseFloat(career.roi_percentage);
  if (!Number.isNaN(roi)) {
    state.likedMaxRoiPercent =
      state.likedMaxRoiPercent === null ? roi : Math.max(state.likedMaxRoiPercent, roi);
  }

  if (Number.isFinite(career.years_to_breakeven)) {
    state.likedMinBreakevenYears =
      state.likedMinBreakevenYears === null
        ? career.years_to_breakeven
        : Math.min(state.likedMinBreakevenYears, career.years_to_breakeven);
  }
};

export const createEmptyGamificationState = (): GamificationState => ({
  version: GAMIFICATION_STATE_VERSION,
  xp: 0,
  totalReviews: 0,
  likes: 0,
  passes: 0,
  feedbacks: 0,
  detailOpens: 0,
  likedGroups: [],
  likedEducationLevels: [],
  likedMaxRoiPercent: null,
  likedMinBreakevenYears: null,
  likedSkillFirst: false,
  activeDates: [],
  achievements: {},
  dailyIdempotency: {},
  events: [],
});

/** Pure reducer: applies an XP event to state, unlocking achievements/levels. */
export const award = (state: GamificationState, event: XpEvent, now: Date = new Date()): AwardResult => {
  const dateKey = utcDateKey(now);
  const previousLevel = levelForXp(state.xp);

  if (DAILY_IDEMPOTENT_TYPES.has(event.type)) {
    const key = `${dateKey}|${event.type}|${event.career?.id ?? event.subjectId ?? ''}`;
    if (state.dailyIdempotency[key]) {
      return noopResult(state, previousLevel);
    }

    const next: GamificationState = { ...state };
    next.dailyIdempotency = { ...state.dailyIdempotency, [key]: 1 };
    return commitAward(next, event, now, dateKey, previousLevel);
  }

  const next: GamificationState = { ...state };
  return commitAward(next, event, now, dateKey, previousLevel);
};

const commitAward = (
  next: GamificationState,
  event: XpEvent,
  now: Date,
  dateKey: string,
  previousLevel: number,
): AwardResult => {
  const xpGained = XP_REWARDS[event.type] ?? 0;
  next.xp += xpGained;

  switch (event.type) {
    case 'swipe_right':
      next.likes += 1;
      next.totalReviews += 1;
      if (event.career) applyLikeAggregates(next, event.career);
      break;
    case 'swipe_left':
      next.passes += 1;
      next.totalReviews += 1;
      break;
    case 'feedback':
      next.feedbacks += 1;
      break;
    case 'detail_view':
      next.detailOpens += 1;
      break;
    case 'compare':
      break;
  }

  if (!next.activeDates.includes(dateKey)) {
    next.activeDates = [...next.activeDates, dateKey].sort();
  }

  next.events = [...next.events.slice(-(MAX_EVENTS - 1)), { t: event.type, ts: now.getTime() }];

  const stats = computeStats(next, dateKey);
  const unlockedNow: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (!next.achievements[def.id] && def.check(stats)) {
      unlockedNow.push(def.id);
    }
  }
  if (unlockedNow.length > 0) {
    const at = now.toISOString();
    next.achievements = { ...next.achievements };
    for (const id of unlockedNow) {
      next.achievements[id] = at;
    }
  }

  const newLevel = levelForXp(next.xp);
  return {
    state: next,
    awarded: true,
    xpGained,
    previousLevel,
    newLevel,
    leveledUp: newLevel > previousLevel,
    newlyUnlocked: unlockedNow,
  };
};
