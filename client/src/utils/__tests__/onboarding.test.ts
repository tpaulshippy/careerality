import {
  assemblePayload,
  buildStateOptions,
  canAdvance,
  EMPTY_ANSWERS,
  filterStateOptions,
  ONBOARDING_STEPS,
  SALARY_PRESETS,
  TOTAL_STEPS,
} from '../onboarding';

const STATES = [
  { area_code: '48', area_name: 'Texas' },
  { area_code: '99', area_name: 'U.S.' },
  { area_code: '49', area_name: 'Utah' },
];

describe('canAdvance', () => {
  it('allows advancing from the welcome step without answers', () => {
    expect(canAdvance(ONBOARDING_STEPS.welcome, EMPTY_ANSWERS)).toBe(true);
  });

  it('requires a state selection on the location step', () => {
    expect(canAdvance(ONBOARDING_STEPS.location, EMPTY_ANSWERS)).toBe(false);
    expect(
      canAdvance(ONBOARDING_STEPS.location, { ...EMPTY_ANSWERS, stateCode: '99' })
    ).toBe(true);
  });

  it('requires a salary preset on the salary step', () => {
    expect(canAdvance(ONBOARDING_STEPS.salary, EMPTY_ANSWERS)).toBe(false);
    expect(
      canAdvance(ONBOARDING_STEPS.salary, { ...EMPTY_ANSWERS, salaryPreset: '50k' })
    ).toBe(true);
  });

  it('requires an education preference on the education step', () => {
    expect(canAdvance(ONBOARDING_STEPS.education, EMPTY_ANSWERS)).toBe(false);
    expect(
      canAdvance(ONBOARDING_STEPS.education, { ...EMPTY_ANSWERS, eduPref: 'bachelor' })
    ).toBe(true);
  });

  it('requires a priority on the priority step', () => {
    expect(canAdvance(ONBOARDING_STEPS.priority, EMPTY_ANSWERS)).toBe(false);
    expect(
      canAdvance(ONBOARDING_STEPS.priority, { ...EMPTY_ANSWERS, priority: 'salary' })
    ).toBe(true);
  });
});

describe('assemblePayload', () => {
  it('falls back to sensible defaults for unanswered steps', () => {
    expect(assemblePayload(EMPTY_ANSWERS)).toEqual({
      filterPatch: { stateCode: '99', minSalary: 0 },
      sortBy: 'roi',
      eduPref: 'any',
    });
  });

  it('maps selections to the filter patch, sort option, and edu preference', () => {
    expect(
      assemblePayload({
        stateCode: '06',
        salaryPreset: '75k',
        eduPref: 'none',
        priority: 'breakeven',
      })
    ).toEqual({
      filterPatch: { stateCode: '06', minSalary: 75000 },
      sortBy: 'breakeven',
      eduPref: 'none',
    });
  });

  it('maps every salary preset to its minimum salary', () => {
    const byKey = Object.fromEntries(SALARY_PRESETS.map(p => [p.key, p.minSalary]));
    expect(byKey).toEqual({
      any: 0,
      '30k': 30000,
      '50k': 50000,
      '75k': 75000,
      '100k': 100000,
      '150k': 150000,
    });
  });
});

describe('buildStateOptions', () => {
  it('pins the national option first with the friendly label', () => {
    expect(buildStateOptions(STATES)).toEqual([
      { area_code: '99', area_name: 'National (all states)' },
      { area_code: '48', area_name: 'Texas' },
      { area_code: '49', area_name: 'Utah' },
    ]);
  });

  it('returns states unchanged when no national option exists', () => {
    const withoutNational = STATES.filter(s => s.area_code !== '99');
    expect(buildStateOptions(withoutNational)).toEqual(withoutNational);
  });
});

describe('filterStateOptions', () => {
  it('matches names case-insensitively', () => {
    expect(filterStateOptions(STATES, 'tex')).toEqual([
      { area_code: '48', area_name: 'Texas' },
    ]);
  });

  it('returns all states for blank or whitespace queries', () => {
    expect(filterStateOptions(STATES, '')).toEqual(STATES);
    expect(filterStateOptions(STATES, '   ')).toEqual(STATES);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterStateOptions(STATES, 'zzz')).toEqual([]);
  });
});

describe('TOTAL_STEPS', () => {
  it('covers every quiz step including welcome', () => {
    expect(TOTAL_STEPS).toBe(5);
    expect(ONBOARDING_STEPS.priority).toBe(TOTAL_STEPS - 1);
  });
});
