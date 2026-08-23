import {
  CareerROI,
  SwipeApiRecord,
  LikedCareer,
  computeActivityStats,
  computeFeedbackDistribution,
  computeTasteProfile,
  computeCatalogStats,
  computeQualityOfInterest,
  computeStandoutPicks,
} from '../insights';

const DAY = 24 * 60 * 60 * 1000;

const swipe = (overrides: Partial<SwipeApiRecord> = {}): SwipeApiRecord => ({
  id: 1,
  career_id: 100,
  direction: 'right',
  feedback: undefined,
  created_at: new Date(0).toISOString(),
  ...overrides,
});

// Fixed "now": Wed 2026-07-15 12:00:00 UTC
const NOW = Date.UTC(2026, 6, 15, 12, 0, 0);

const likedCareer = (overrides: Partial<LikedCareer> = {}): LikedCareer => ({
  id: 1,
  occupation_code: '29-1141',
  occupation_name: 'Registered Nurses',
  area_code: '99',
  area_name: 'National',
  annual_median_salary: '80000',
  education_cost: '40000',
  years_to_breakeven: 2,
  roi_percentage: '150',
  job_zone: 3,
  education_level: "Bachelor's degree",
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '80000',
  industry_code: '62',
  industry_name: 'Healthcare',
  demand_rank: 10,
  demand_score: 80,
  avg_annual_openings: 1000,
  projected_growth_percent: 5,
  swipe_id: 1,
  swiped_at: new Date(0).toISOString(),
  ...overrides,
});

describe('computeActivityStats', () => {
  it('returns zeros for empty input', () => {
    const stats = computeActivityStats([], NOW);
    expect(stats).toEqual({
      totalReviewed: 0,
      totalLiked: 0,
      likeRate: 0,
      reviewsThisWeek: 0,
      reviewsLastWeek: 0,
      weekChangePct: null,
    });
  });

  it('counts totals and like rate for a single right swipe', () => {
    const stats = computeActivityStats([swipe()], NOW);
    expect(stats.totalReviewed).toBe(1);
    expect(stats.totalLiked).toBe(1);
    expect(stats.likeRate).toBe(100);
  });

  it('computes like rate across mixed directions', () => {
    const swipes = [
      swipe({ direction: 'right' }),
      swipe({ direction: 'right' }),
      swipe({ direction: 'left' }),
      swipe({ direction: 'left' }),
    ];
    const stats = computeActivityStats(swipes, NOW);
    expect(stats.totalReviewed).toBe(4);
    expect(stats.totalLiked).toBe(2);
    expect(stats.likeRate).toBeCloseTo(50);
  });

  it('buckets reviews into this week vs last week with a rolling 7-day window', () => {
    const swipes = [
      swipe({ id: 1, created_at: new Date(NOW - 1 * DAY).toISOString() }), // this week
      swipe({ id: 2, created_at: new Date(NOW - 6.9 * DAY).toISOString() }), // this week
      swipe({ id: 3, created_at: new Date(NOW - 7 * DAY).toISOString() }), // this/last boundary → this week (inclusive)
      swipe({ id: 4, created_at: new Date(NOW - 13.9 * DAY).toISOString() }), // last week
      swipe({ id: 5, created_at: new Date(NOW - 14 * DAY).toISOString() }), // last-week start (inclusive)
      swipe({ id: 6, created_at: new Date(NOW - 40 * DAY).toISOString() }), // too old
    ];
    const stats = computeActivityStats(swipes, NOW);
    expect(stats.reviewsThisWeek).toBe(3);
    expect(stats.reviewsLastWeek).toBe(2);
    expect(stats.weekChangePct).toBeCloseTo(50);
  });

  it('computes positive and negative week change percentages', () => {
    const up = computeActivityStats(
      [
        ...Array.from({ length: 4 }, (_, i) =>
          swipe({ id: i + 1, created_at: new Date(NOW - i * DAY).toISOString() })
        ),
        swipe({ id: 20, created_at: new Date(NOW - 8 * DAY).toISOString() }),
        swipe({ id: 21, created_at: new Date(NOW - 9 * DAY).toISOString() }),
      ],
      NOW
    );
    expect(up.reviewsThisWeek).toBe(4);
    expect(up.reviewsLastWeek).toBe(2);
    expect(up.weekChangePct).toBeCloseTo(100);

    const down = computeActivityStats(
      [
        swipe({ created_at: new Date(NOW - 1 * DAY).toISOString() }),
        swipe({ created_at: new Date(NOW - 8 * DAY).toISOString() }),
        swipe({ created_at: new Date(NOW - 9 * DAY).toISOString() }),
        swipe({ created_at: new Date(NOW - 10 * DAY).toISOString() }),
      ],
      NOW
    );
    expect(down.weekChangePct).toBeCloseTo(-66.6667);
  });

  it('returns null weekChangePct when last week had no reviews', () => {
    const stats = computeActivityStats([swipe({ created_at: new Date(NOW).toISOString() })], NOW);
    expect(stats.reviewsThisWeek).toBe(1);
    expect(stats.reviewsLastWeek).toBe(0);
    expect(stats.weekChangePct).toBeNull();
  });

  it('ignores swipes with unparseable dates in weekly buckets but still counts them', () => {
    const swipes = [swipe(), swipe({ created_at: 'not-a-date' })];
    const stats = computeActivityStats(swipes, NOW);
    expect(stats.totalReviewed).toBe(2);
    expect(stats.reviewsThisWeek).toBe(0);
  });
});

describe('computeFeedbackDistribution', () => {
  it('returns empty array for empty input', () => {
    expect(computeFeedbackDistribution([])).toEqual([]);
  });

  it('returns empty array when no right swipes have feedback', () => {
    const swipes = [
      swipe({ direction: 'right' }),
      swipe({ direction: 'left', feedback: 'salary' }),
    ];
    expect(computeFeedbackDistribution(swipes)).toEqual([]);
  });

  it('aggregates counts and percentages sorted by count desc', () => {
    const swipes = [
      swipe({ feedback: 'very_interested' }),
      swipe({ feedback: 'very_interested' }),
      swipe({ feedback: 'very_interested' }),
      swipe({ feedback: 'somewhat_interested' }),
      swipe({ feedback: 'mild_interest' }),
    ];
    const dist = computeFeedbackDistribution(swipes);
    expect(dist.map((d) => d.key)).toEqual(['very_interested', 'mild_interest', 'somewhat_interested']);
    expect(dist[0].count).toBe(3);
    expect(dist[0].percent).toBe(60);
    expect(dist[1].percent).toBe(20);
  });

  it('maps known keys to friendly labels', () => {
    const dist = computeFeedbackDistribution([
      swipe({ feedback: 'very_interested' }),
      swipe({ feedback: 'balance' }),
      swipe({ feedback: 'environment' }),
    ]);
    expect(dist.find((d) => d.key === 'very_interested')?.label).toBe('Very interested');
    expect(dist.find((d) => d.key === 'balance')?.label).toBe('Work-life balance');
    expect(dist.find((d) => d.key === 'environment')?.label).toBe('Work environment');
  });

  it('prettifies unknown feedback keys instead of dropping them', () => {
    const dist = computeFeedbackDistribution([swipe({ feedback: 'growth_opportunities' })]);
    expect(dist).toEqual([
      { key: 'growth_opportunities', label: 'Growth Opportunities', count: 1, percent: 100 },
    ]);
  });

  it('breaks count ties alphabetically by key', () => {
    const dist = computeFeedbackDistribution([
      swipe({ feedback: 'skills' }),
      swipe({ feedback: 'security' }),
    ]);
    expect(dist.map((d) => d.key)).toEqual(['security', 'skills']);
  });
});

describe('computeTasteProfile', () => {
  it('returns empty array for empty liked list', () => {
    expect(computeTasteProfile([])).toEqual([]);
  });

  it('groups liked careers by occupation group with counts', () => {
    const liked = [
      likedCareer({ occupation_code: '29-1141' }), // Healthcare
      likedCareer({ occupation_code: '29-1171' }), // Healthcare
      likedCareer({ occupation_code: '15-1252' }), // Computer and Information Technology
    ];
    expect(computeTasteProfile(liked)).toEqual([
      { group: 'Healthcare', count: 2 },
      { group: 'Computer and Information Technology', count: 1 },
    ]);
  });

  it('sorts ties alphabetically', () => {
    const liked = [
      likedCareer({ occupation_code: '25-1000' }), // Education Training and Library
      likedCareer({ occupation_code: '11-0000' }), // Management
    ];
    const profile = computeTasteProfile(liked);
    expect(profile.map((p) => p.group)).toEqual(['Education Training and Library', 'Management']);
  });

  it('limits to topN groups', () => {
    const codes = ['11-0000', '13-0000', '17-0000', '21-0000', '23-0000', '25-0000', '29-0000'];
    const liked = codes.map((occupation_code, i) =>
      likedCareer({ occupation_code, swipe_id: i })
    );
    expect(computeTasteProfile(liked, 3)).toHaveLength(3);
  });
});

describe('computeCatalogStats', () => {
  it('returns null for empty catalog', () => {
    expect(computeCatalogStats([])).toBeNull();
  });

  it('computes medians including even-count interpolation', () => {
    const catalog = [
      { roi_percentage: '10', annual_median_salary: '30000', years_to_breakeven: 5 },
      { roi_percentage: '20', annual_median_salary: '50000', years_to_breakeven: 3 },
      { roi_percentage: '30', annual_median_salary: '70000', years_to_breakeven: 1 },
    ] as CareerROI[];
    expect(computeCatalogStats(catalog)).toEqual({
      medianRoi: 20,
      medianSalary: 50000,
      medianBreakeven: 3,
      sampleSize: 3,
    });

    const even = [
      { roi_percentage: '10', annual_median_salary: '30000', years_to_breakeven: 5 },
      { roi_percentage: '20', annual_median_salary: '50000', years_to_breakeven: 3 },
    ] as CareerROI[];
    expect(computeCatalogStats(even)).toMatchObject({ medianRoi: 15, medianSalary: 40000 });
  });
});

describe('computeQualityOfInterest', () => {
  const catalog = [
    { roi_percentage: '50', annual_median_salary: '50000', years_to_breakeven: 4 },
    { roi_percentage: '60', annual_median_salary: '55000', years_to_breakeven: 4 },
    { roi_percentage: '70', annual_median_salary: '60000', years_to_breakeven: 3 },
  ] as CareerROI[];

  it('returns null for empty liked or empty catalog', () => {
    expect(computeQualityOfInterest([], catalog)).toBeNull();
    expect(computeQualityOfInterest([likedCareer()], [])).toBeNull();
  });

  it('summarizes liked stats against catalog medians', () => {
    const liked = [likedCareer({ annual_median_salary: '120000', roi_percentage: '150', years_to_breakeven: 2 })];
    const quality = computeQualityOfInterest(liked, catalog)!;
    expect(quality.avgRoi).toBe(150);
    expect(quality.medianSalary).toBe(120000);
    expect(quality.avgBreakeven).toBe(2);
    expect(quality.catalog.sampleSize).toBe(3);
  });

  it('produces higher-paying insight when salary is well above catalog', () => {
    const liked = [likedCareer({ annual_median_salary: '120000', roi_percentage: '70', years_to_breakeven: 4 })];
    const quality = computeQualityOfInterest(liked, catalog)!;
    expect(quality.insights[0]).toContain('higher-paying');
  });

  it('produces near-average sentence within threshold', () => {
    const liked = [likedCareer({ annual_median_salary: '52000', roi_percentage: '60', years_to_breakeven: 3.5 })];
    const quality = computeQualityOfInterest(liked, catalog)!;
    expect(quality.insights[0]).toContain('close to the national middle');
    expect(quality.insights[1]).toContain('track the national average');
  });

  it('produces lower-paying and patient-payback insights below thresholds', () => {
    const liked = [
      likedCareer({ annual_median_salary: '30000', roi_percentage: '30', years_to_breakeven: 6 }),
    ];
    const quality = computeQualityOfInterest(liked, catalog)!;
    expect(quality.insights[0]).toContain('less than typical');
    expect(quality.insights[1]).toContain('passion over spreadsheets');
    expect(quality.insights[2]).toContain('patient about payback');
  });

  it('produces quick payback insight when break-even beats the catalog', () => {
    const liked = [likedCareer({ annual_median_salary: '60000', roi_percentage: '60', years_to_breakeven: 1 })];
    const quality = computeQualityOfInterest(liked, catalog)!;
    expect(quality.insights.some((i) => i.includes('pay back their training costs quickly'))).toBe(true);
  });
});

describe('computeStandoutPicks', () => {
  it('returns nulls for empty liked list', () => {
    expect(computeStandoutPicks([])).toEqual({
      highestRoi: null,
      highestSalary: null,
      fastestBreakeven: null,
    });
  });

  it('returns the same career everywhere for a single like', () => {
    const liked = [likedCareer()];
    const picks = computeStandoutPicks(liked);
    expect(picks.highestRoi).toBe(liked[0]);
    expect(picks.highestSalary).toBe(liked[0]);
    expect(picks.fastestBreakeven).toBe(liked[0]);
  });

  it('picks standouts across metrics', () => {
    const liked = [
      likedCareer({ occupation_name: 'Balanced', roi_percentage: '100', annual_median_salary: '90000', years_to_breakeven: 3 }),
      likedCareer({ occupation_name: 'Roi Star', roi_percentage: '200', annual_median_salary: '60000', years_to_breakeven: 5 }),
      likedCareer({ occupation_name: 'Pay Star', roi_percentage: '90', annual_median_salary: '150000', years_to_breakeven: 4 }),
      likedCareer({ occupation_name: 'Quick Win', roi_percentage: '95', annual_median_salary: '50000', years_to_breakeven: 1 }),
    ];
    const picks = computeStandoutPicks(liked);
    expect(picks.highestRoi!.occupation_name).toBe('Roi Star');
    expect(picks.highestSalary!.occupation_name).toBe('Pay Star');
    expect(picks.fastestBreakeven!.occupation_name).toBe('Quick Win');
  });

  it('breaks ties by first occurrence', () => {
    const first = likedCareer({ occupation_name: 'First', roi_percentage: '150', annual_median_salary: '80000', years_to_breakeven: 2 });
    const second = likedCareer({ occupation_name: 'Second', roi_percentage: '150', annual_median_salary: '80000', years_to_breakeven: 2 });
    const picks = computeStandoutPicks([first, second]);
    expect(picks.highestRoi).toBe(first);
    expect(picks.highestSalary).toBe(first);
    expect(picks.fastestBreakeven).toBe(first);
  });
});
