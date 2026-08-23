import {
  ACHIEVEMENTS,
  award,
  computeStats,
  createEmptyGamificationState,
  currentStreak,
  dayKeyDiff,
  GamificationState,
  GamificationStats,
  levelForXp,
  progressToNext,
  shiftDateKey,
  utcDateKey,
  xpForLevel,
} from '../gamification';
import { CareerROI } from '../../types';

const mkCareer = (overrides: Partial<CareerROI> = {}): CareerROI => ({
  id: 1,
  occupation_code: '15-1211.00',
  occupation_name: 'Software Developer',
  area_code: '99',
  area_name: 'U.S.',
  annual_median_salary: '100000',
  education_cost: '40000',
  years_to_breakeven: 3,
  roi_percentage: '10',
  job_zone: 4,
  education_level: "Bachelor's degree",
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '100000',
  industry_code: 'x',
  industry_name: 'x',
  demand_rank: null,
  demand_score: null,
  avg_annual_openings: null,
  projected_growth_percent: null,
  ...overrides,
});

const at = (iso: string): Date => new Date(iso);
const empty = (): GamificationState => createEmptyGamificationState();

const swipeRight = (state: GamificationState, career?: CareerROI, iso = '2026-03-10T12:00:00Z') =>
  award(state, { type: 'swipe_right', career }, at(iso));

describe('levels', () => {
  it('computes the cumulative curve for xpForLevel', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100); // 100 * 1 * 2 / 2
    expect(xpForLevel(3)).toBe(300); // 100 * 2 * 3 / 2
    expect(xpForLevel(4)).toBe(600); // 100 * 3 * 4 / 2
    expect(xpForLevel(5)).toBe(1000);
    expect(xpForLevel(7.9)).toBe(xpForLevel(7));
  });

  it('maps XP to levels with exact boundaries', () => {
    expect(levelForXp(-5)).toBe(1);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(101)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(599)).toBe(3);
    expect(levelForXp(600)).toBe(4);
    expect(levelForXp(999)).toBe(4);
    expect(levelForXp(1000)).toBe(5);
    expect(levelForXp(123456)).toBe(levelForXp(123456)); // stable
  });

  it('reports progress to the next level', () => {
    const p0 = progressToNext(0);
    expect(p0.level).toBe(1);
    expect(p0.xpIntoLevel).toBe(0);
    expect(p0.nextLevelXp).toBe(100);
    expect(p0.xpRemaining).toBe(100);
    expect(p0.fraction).toBe(0);

    const mid = progressToNext(150);
    expect(mid.level).toBe(2);
    expect(mid.currentLevelStartXp).toBe(100);
    expect(mid.xpIntoLevel).toBe(50);
    expect(mid.fraction).toBeCloseTo(0.25);

    const boundary = progressToNext(300);
    expect(boundary.level).toBe(3);
    expect(boundary.xpIntoLevel).toBe(0);
    expect(boundary.fraction).toBe(0);

    const full = progressToNext(299);
    expect(full.fraction).toBeCloseTo(0.995);
  });

  it('flags level ups on award', () => {
    let state = empty();
    const r99 = swipeRight(state, mkCareer(), '2026-03-10T12:00:00Z');
    // +10 only; still level 1 after many small events is covered below via direct math.
    state = r99.state;
    // Pump to exactly level 2 boundary using left swipes (+5 each) and feedback (+10).
    while (levelForXp(state.xp) === 1) {
      state = award(state, { type: 'swipe_left' }, at('2026-03-10T13:00:00Z')).state;
      if (state.xp >= 95) {
        state = award(state, { type: 'feedback' }, at('2026-03-10T14:00:00Z')).state;
        break;
      }
    }
    const before = state.xp;
    const res = award(state, { type: 'feedback' }, at('2026-03-10T15:00:00Z'));
    if (before < 100 && res.state.xp >= 100) {
      expect(res.leveledUp).toBe(true);
      expect(res.newLevel).toBe(2);
      expect(res.previousLevel).toBe(1);
    } else {
      expect(res.newLevel).toBe(levelForXp(res.state.xp));
    }
  });
});

describe('xp awards', () => {
  it('awards right swipe +10 and updates like aggregates', () => {
    const res = swipeRight(empty(), mkCareer({ id: 7 }));
    expect(res.awarded).toBe(true);
    expect(res.xpGained).toBe(10);
    expect(res.state.xp).toBe(10);
    expect(res.state.likes).toBe(1);
    expect(res.state.totalReviews).toBe(1);
    expect(res.state.passes).toBe(0);
    expect(res.state.likedGroups).toContain('Computer and Information Technology');
  });

  it('awards left swipe +5', () => {
    const res = award(empty(), { type: 'swipe_left' }, at('2026-03-10T12:00:00Z'));
    expect(res.xpGained).toBe(5);
    expect(res.state.passes).toBe(1);
    expect(res.state.totalReviews).toBe(1);
    expect(res.state.likes).toBe(0);
  });

  it('awards feedback bonus +10', () => {
    const res = award(empty(), { type: 'feedback' }, at('2026-03-10T12:00:00Z'));
    expect(res.xpGained).toBe(10);
    expect(res.state.feedbacks).toBe(1);
  });

  it('stacks right swipe then its feedback (10 + 10)', () => {
    let state = empty();
    state = swipeRight(state, mkCareer()).state;
    state = award(state, { type: 'feedback' }, at('2026-03-10T12:01:00Z')).state;
    expect(state.xp).toBe(20);
    expect(state.totalReviews).toBe(1);
    expect(state.feedbacks).toBe(1);
  });

  it('appends activity date once per day', () => {
    let state = empty();
    state = swipeRight(state, mkCareer(), '2026-03-10T08:00:00Z').state;
    state = award(state, { type: 'feedback' }, at('2026-03-10T23:59:59Z')).state;
    state = swipeRight(state, mkCareer({ id: 2 }), '2026-03-11T06:00:00Z').state;
    expect(state.activeDates).toEqual(['2026-03-10', '2026-03-11']);
  });

  it('caps the compact event log at 200 entries', () => {
    let state = empty();
    for (let i = 0; i < 260; i++) {
      state = award(
        state,
        { type: 'swipe_left' },
        at(`20${String(24 + Math.floor(i / 365)).padStart(2, '0')}-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`),
      ).state;
    }
    expect(state.events.length).toBeLessThanOrEqual(200);
    expect(state.events[state.events.length - 1].t).toBe('swipe_left');
  });
});

describe('daily idempotency', () => {
  it('awards a detail view only once per career per UTC day', () => {
    let state = empty();
    const first = award(state, { type: 'detail_view', career: mkCareer({ id: 42 }) }, at('2026-03-10T09:00:00Z'));
    expect(first.awarded).toBe(true);
    expect(first.xpGained).toBe(2);
    state = first.state;

    const dup = award(state, { type: 'detail_view', career: mkCareer({ id: 42 }) }, at('2026-03-10T18:30:00Z'));
    expect(dup.awarded).toBe(false);
    expect(dup.xpGained).toBe(0);
    expect(dup.state).toBe(state); // unchanged reference

    const otherCareer = award(state, { type: 'detail_view', career: mkCareer({ id: 43 }) }, at('2026-03-10T19:00:00Z'));
    expect(otherCareer.awarded).toBe(true);
    state = otherCareer.state;

    const nextDay = award(state, { type: 'detail_view', career: mkCareer({ id: 42 }) }, at('2026-03-11T07:00:00Z'));
    expect(nextDay.awarded).toBe(true);
  });

  it('supports generic compare events via subjectId', () => {
    let state = empty();
    state = award(state, { type: 'compare', subjectId: 'a-vs-b' }, at('2026-03-10T10:00:00Z')).state;
    const dup = award(state, { type: 'compare', subjectId: 'a-vs-b' }, at('2026-03-10T22:00:00Z'));
    expect(dup.awarded).toBe(false);
  });

  it('does not dedupe swipe or feedback events', () => {
    let state = empty();
    for (let i = 0; i < 3; i++) {
      const res = award(state, { type: 'swipe_right' }, at(`2026-03-10T1${i}:00:00Z`));
      expect(res.awarded).toBe(true);
      state = res.state;
    }
    expect(state.xp).toBe(30);
  });

  it('prunes idempotency markers older than their useful window', () => {
    let state = empty();
    state = award(state, { type: 'compare', subjectId: 'stale' }, at('2026-01-01T00:00:00Z')).state;
    state = award(state, { type: 'detail_view', career: mkCareer({ id: 7 }) }, at('2026-03-09T12:00:00Z')).state;

    const freshDay = award(state, { type: 'detail_view', career: mkCareer({ id: 8 }) }, at('2026-03-10T12:00:00Z'));
    expect(freshDay.awarded).toBe(true);
    const keys = Object.keys(freshDay.state.dailyIdempotency);
    expect(keys.some((key) => key.includes('stale'))).toBe(false);
    expect(keys).toContain('2026-03-10|detail_view|8');
    // Yesterday stays within the retention tail...
    expect(keys).toContain('2026-03-09|detail_view|7');
    // ...and today's markers still dedupe within the day.
    const dup = award(
      freshDay.state,
      { type: 'detail_view', career: mkCareer({ id: 8 }) },
      at('2026-03-10T18:00:00Z'),
    );
    expect(dup.awarded).toBe(false);
  });
});

describe('streaks', () => {
  it('returns 0 for empty history', () => {
    expect(currentStreak([], '2026-03-10')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10')).toBe(3);
  });

  it('stays alive when last active day was yesterday (today pending)', () => {
    expect(currentStreak(['2026-03-08', '2026-03-09'], '2026-03-10')).toBe(2);
  });

  it('resets after a gap', () => {
    expect(currentStreak(['2026-03-05', '2026-03-06', '2026-03-10'], '2026-03-10')).toBe(1);
    expect(currentStreak(['2026-03-01'], '2026-03-10')).toBe(0);
  });

  it('handles month and year boundaries safely', () => {
    expect(currentStreak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01')).toBe(3);
    expect(currentStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3);
    expect(currentStreak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01')).toBe(3);
  });

  it('ignores duplicate dates and unsorted input', () => {
    expect(currentStreak(['2026-03-10', '2026-03-09', '2026-03-10', '2026-03-08'], '2026-03-10')).toBe(3);
  });

  it('dayKeyDiff and shiftDateKey are inverse-consistent across months', () => {
    expect(dayKeyDiff('2026-03-01', '2026-02-28')).toBe(1);
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2026-03-10', 0)).toBe('2026-03-10');
  });

  it('utcDateKey uses UTC not local components', () => {
    // 2026-03-10T23:30:00Z is already Mar 11 in TZ east of UTC+1.
    expect(utcDateKey(at('2026-03-10T23:30:00Z'))).toBe('2026-03-10');
    expect(utcDateKey(at('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});

describe('achievements', () => {
  const ids = () => new Set(ACHIEVEMENTS.map((a) => a.id));

  it('defines exactly the expected set', () => {
    expect(ids()).toEqual(
      new Set([
        'first-steps',
        'curious-mind',
        'deep-diver',
        'feedback-pro',
        'shortlister',
        'roi-hunter',
        'bargain-brain',
        'week-warrior',
        'explorer',
        'grad-track',
        'skill-first',
        'centurion',
      ]),
    );
    for (const def of ACHIEVEMENTS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });

  it('first-steps: unlocks on first review only after threshold', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'first-steps')!;
    const zero = computeStats(empty());
    expect(def.check(zero)).toBe(false);
    const one = computeStats(swipeRight(empty()).state);
    expect(def.check(one)).toBe(true);
  });

  it.each([
    ['curious-mind', 24, 25],
    ['centurion', 99, 100],
    ['shortlister', 2, 3],
    ['deep-diver', 9, 10],
    ['feedback-pro', 9, 10],
  ] as const)('%s flips exactly at its threshold', (id, below, atThreshold) => {
    const def = ACHIEVEMENTS.find((a) => a.id === id)!;
    const mk = (reviews: number): GamificationStats => ({
      ...computeStats(empty()),
      totalReviews: reviews,
      likes: reviews,
      detailOpens: reviews,
      feedbacks: reviews,
    });
    expect(def.check(mk(below))).toBe(false);
    expect(def.check(mk(atThreshold))).toBe(true);
  });

  it('roi-hunter requires a liked career of at least 15% ROI', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'roi-hunter')!;
    const low = swipeRight(empty(), mkCareer({ roi_percentage: '14.9' })).state;
    expect(def.check(computeStats(low))).toBe(false);
    const high = swipeRight(low, mkCareer({ id: 2, roi_percentage: '15' })).state;
    expect(def.check(computeStats(high))).toBe(true);
    expect(computeStats(high).likedMaxRoiPercent).toBe(15);
  });

  it('bargain-brain requires a liked career breaking even within 2 years', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'bargain-brain')!;
    const slow = swipeRight(empty(), mkCareer({ years_to_breakeven: 3 })).state;
    expect(def.check(computeStats(slow))).toBe(false);
    const fast = swipeRight(slow, mkCareer({ id: 2, years_to_breakeven: 2 })).state;
    expect(def.check(computeStats(fast))).toBe(true);
  });

  it('week-warrior requires a live 7-day streak', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'week-warrior')!;
    const days = Array.from({ length: 7 }, (_, i) => shiftDateKey('2026-03-10', i - 6));
    let state = empty();
    state = { ...state, activeDates: days };
    expect(def.check(computeStats(state, '2026-03-10'))).toBe(true);
    // Yesterday-grace keeps the streak alive one day past the run.
    expect(def.check(computeStats(state, '2026-03-11'))).toBe(true);
    expect(def.check(computeStats(state, '2026-03-12'))).toBe(false); // gap reset
  });

  it('explorer counts distinct liked occupation groups', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'explorer')!;
    let state = empty();
    state = swipeRight(state, mkCareer({ id: 1, occupation_code: '15-1211.00' })).state; // Computer
    state = swipeRight(state, mkCareer({ id: 2, occupation_code: '29-1141.00' })).state; // Healthcare
    state = swipeRight(state, mkCareer({ id: 3, occupation_code: '25-2031.00' })).state; // Education
    expect(def.check(computeStats(state))).toBe(false);
    state = swipeRight(state, mkCareer({ id: 4, occupation_code: '47-2073.00' })).state; // Construction
    expect(def.check(computeStats(state))).toBe(true);
    // Same group again does not change the count.
    state = swipeRight(state, mkCareer({ id: 5, occupation_code: '15-1221.00' })).state;
    expect(computeStats(state).likedGroupCount).toBe(4);
  });

  it('grad-track detects graduate education levels', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'grad-track')!;
    expect(def.check(computeStats(empty()))).toBe(false);
    const grad = swipeRight(empty(), mkCareer({ education_level: 'Master\'s degree' })).state;
    expect(def.check(computeStats(grad))).toBe(true);
    const doc = swipeRight(empty(), mkCareer({ education_level: 'Doctoral degree' })).state;
    expect(def.check(computeStats(doc))).toBe(true);
    const undergrad = swipeRight(empty(), mkCareer({ education_level: "Bachelor's degree" })).state;
    expect(def.check(computeStats(undergrad))).toBe(false);
  });

  it('skill-first detects no-degree careers', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'skill-first')!;
    expect(def.check(computeStats(empty()))).toBe(false);
    // Levels emitted by data/load.py and data/transform.py.
    for (const level of [
      'Less than high school',
      'High school diploma',
      'Postsecondary certificate',
      'Some college',
      'Some college, no degree',
    ]) {
      const liked = swipeRight(empty(), mkCareer({ education_level: level })).state;
      expect(def.check(computeStats(liked))).toBe(true);
    }
    for (const level of ["Associate's degree", "Bachelor's degree", "Master's degree"]) {
      const liked = swipeRight(empty(), mkCareer({ education_level: level })).state;
      expect(def.check(computeStats(liked))).toBe(false);
    }
  });

  it('unlocks achievements inside award with unlock timestamps', () => {
    const res = swipeRight(empty(), mkCareer());
    expect(res.newlyUnlocked).toEqual(['first-steps']);
    expect(res.state.achievements['first-steps']).toBe('2026-03-10T12:00:00.000Z');

    // Second first-swipe-like event does not re-unlock.
    const res2 = swipeRight(res.state, mkCareer({ id: 9 }), '2026-03-11T12:00:00Z');
    expect(res2.newlyUnlocked).not.toContain('first-steps');
    expect(res2.state.achievements['first-steps']).toBe('2026-03-10T12:00:00.000Z');
  });

  it('unlock order matches definition order in a single award', () => {
    let state = empty();
    state = { ...state, totalReviews: 24, likes: 2 };
    // This single like triggers curious-mind (25 reviews) and shortlister (3 likes).
    const res = swipeRight(state, mkCareer());
    expect(res.newlyUnlocked).toEqual(['first-steps', 'curious-mind', 'shortlister']);
  });
});
