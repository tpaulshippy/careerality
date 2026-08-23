import { CareerROI } from '../../types';
import {
  buildPlan,
  extractStateName,
  excerptText,
  slugify,
  buildInterviewMessage,
  ACTION_PLAN_STEP_COUNT,
} from '../actionPlan';

const baseCareer = (overrides: Partial<CareerROI> = {}): CareerROI =>
  ({
    id: 1,
    occupation_code: '29-1141.00',
    occupation_name: 'Registered Nurses',
    area_code: '99',
    area_name: 'U.S.',
    annual_median_salary: '86070.0',
    education_cost: '40000.0',
    years_to_breakeven: 2,
    roi_percentage: '12.5',
    job_zone: 4,
    education_level: "Bachelor's degree",
    skills: ['Monitoring', 'Social Perceptiveness'],
    cost_of_living_index: '100.0',
    adjusted_salary: '86070.0',
    industry_code: 'cross-industry',
    industry_name: 'cross-industry',
    demand_rank: null,
    avg_annual_openings: null,
    projected_growth_percent: null,
    demand_score: null,
    ...overrides,
  }) as CareerROI;

describe('slugify', () => {
  it('URL-encodes spaces and special characters', () => {
    expect(slugify('Chief Executives')).toBe('Chief%20Executives');
    expect(slugify('Computer & Information Research Scientists')).toBe(
      'Computer%20%26%20Information%20Research%20Scientists'
    );
  });
});

describe('extractStateName', () => {
  it('extracts state name from metro area strings', () => {
    expect(extractStateName('New York-Newark-Jersey City, NY-NJ')).toBe('New York');
    expect(extractStateName('Washington-Arlington-Alexandria, DC-VA-MD-WV')).toBe('Washington');
  });

  it('returns plain state names unchanged', () => {
    expect(extractStateName('New Jersey')).toBe('New Jersey');
  });

  it('returns null for national rows and missing data', () => {
    expect(extractStateName('U.S.')).toBeNull();
    expect(extractStateName(undefined)).toBeNull();
    expect(extractStateName('')).toBeNull();
  });
});

describe('excerptText', () => {
  it('returns short text untouched', () => {
    expect(excerptText('Short day.')).toBe('Short day.');
  });

  it('trims whitespace', () => {
    expect(excerptText('  padded text  ')).toBe('padded text');
  });

  it('truncates long text at a word boundary with ellipsis', () => {
    const long = 'word '.repeat(80).trim();
    const result = excerptText(long, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith('…')).toBe(true);
    expect(result.endsWith('word…')).toBe(true);
  });

  it('falls back to hard cut when no space exists in window', () => {
    const noSpaces = 'a'.repeat(100);
    const result = excerptText(noSpaces, 50);
    expect(result.startsWith('a'.repeat(50))).toBe(true);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('buildInterviewMessage', () => {
  it('references the occupation name', () => {
    const msg = buildInterviewMessage('Radiologic Technicians');
    expect(msg).toContain('career as a Radiologic Technicians');
    expect(msg).toContain('[Your name]');
  });
});

describe('buildPlan', () => {
  it('always produces exactly six deterministic steps', () => {
    const plan = buildPlan(baseCareer());
    expect(plan.steps).toHaveLength(ACTION_PLAN_STEP_COUNT);
    expect(buildPlan(baseCareer())).toEqual(plan);
    expect(plan.steps.map(s => s.id)).toEqual([
      'see-the-work',
      'watch-workers',
      'find-openings',
      'check-outlook',
      'learn-skill',
      'talk-to-pro',
    ]);
  });

  it('links the O*NET profile using the occupation code without a trailing .00', () => {
    const step = buildPlan(baseCareer()).steps[0];
    expect(step.url).toBe('https://www.onetonline.org/link/summary/29-1141');
  });

  it('includes the day-in-life excerpt on step 1 when present', () => {
    const career = baseCareer({
      day_in_life_full: 'You start the morning reviewing charts. The rest of the day is patient care.',
    });
    const step = buildPlan(career).steps[0];
    expect(step.description).toContain('You start the morning reviewing charts');
  });

  it('omits the day-in-life excerpt cleanly when missing', () => {
    const step = buildPlan(baseCareer({ day_in_life_full: undefined })).steps[0];
    expect(step.description).not.toContain('"');
    expect(step.url).toContain('onetonline.org');
  });

  it('builds an encoded YouTube search URL for step 2', () => {
    const step = buildPlan(baseCareer({ occupation_name: 'Chief Executives' })).steps[1];
    expect(step.url).toBe(
      'https://www.youtube.com/results?search_query=Chief%20Executives+day+in+the+life'
    );
  });

  it('adds location and openings note to job postings step when available', () => {
    const career = baseCareer({
      area_name: 'New York-Newark-Jersey City, NY-NJ',
      avg_annual_openings: 1234,
    });
    const step = buildPlan(career).steps[2];
    expect(step.url).toBe(
      'https://www.careeronestop.org/Toolkit/Careers/Occupations/occupation-profile.aspx?keyword=Registered%20Nurses&location=New%20York'
    );
    expect(step.description).toContain('in New York');
    expect(step.description).toContain('1,234 openings');
  });

  it('omits location param for national careers and skips openings note when null', () => {
    const step = buildPlan(baseCareer({ avg_annual_openings: null })).steps[2];
    expect(step.url).not.toContain('location=');
    expect(step.description).not.toContain('openings open up');
  });

  it('links to BLS OOH finder with growth note when projected growth is present', () => {
    const positive = buildPlan(baseCareer({ projected_growth_percent: 6.2 })).steps[3];
    expect(positive.url).toBe('https://www.bls.gov/ooh/occupation-finder.htm?keyword=Registered%20Nurses');
    expect(positive.description).toContain('+6.2%');

    const negative = buildPlan(baseCareer({ projected_growth_percent: -3 })).steps[3];
    expect(negative.description).toContain('-3%');

    const none = buildPlan(baseCareer({ projected_growth_percent: null })).steps[3];
    expect(none.description).not.toContain('%.');
  });

  it('uses the first skill for the course search', () => {
    const step = buildPlan(baseCareer()).steps[4];
    expect(step.url).toBe('https://www.coursera.org/search?query=Monitoring');
    expect(step.description).toContain('Monitoring');
  });

  it('falls back to the career name for courses when skills list is empty or missing', () => {
    const empty = buildPlan(baseCareer({ skills: [] })).steps[4];
    expect(empty.url).toBe('https://www.coursera.org/search?query=Registered%20Nurses');
    const missing = buildPlan({ ...baseCareer(), skills: [] as string[] }).steps[4];
    expect(missing.url).toBe('https://www.coursera.org/search?query=Registered%20Nurses');
    expect(empty.description).not.toBe('');
  });

  it('provides a copyable interview message referencing the career on step 6', () => {
    const step = buildPlan(baseCareer()).steps[5];
    expect(step.copyText).toContain('career as a Registered Nurses');
    expect(step.copyText).toContain('[Your name]');
  });

  it('encodes names with apostrophes and commas across all URLs', () => {
    const plan = buildPlan(
      baseCareer({
        occupation_name: "Lawyers, All Other",
        area_name: 'Denver-Aurora-Lakewood, CO',
      })
    );
    for (const step of plan.steps) {
      const url = step.url;
      if (url) {
        expect(() => decodeURIComponent(url)).not.toThrow();
      }
    }
    expect(plan.steps[2].url?.includes('location=Denver')).toBe(true);
  });

  it('works across different occupation groups', () => {
    const groups = [
      { code: '15-1252.00', name: 'Software Developers' },
      { code: '41-4012.00', name: 'Sales Representatives, Wholesale and Manufacturing' },
      { code: '29-1171.00', name: 'Dietitians and Nutritionists' },
      { code: '33-3012.00', name: 'Correctional Officers and Jailers' },
    ];
    for (const g of groups) {
      const plan = buildPlan(baseCareer({ occupation_code: g.code, occupation_name: g.name }));
      expect(plan.steps[0].url).toBe(
        `https://www.onetonline.org/link/summary/${g.code.replace(/\.00$/, '')}`
      );
      expect(plan.steps[1].url).toContain(encodeURIComponent(g.name.split(',')[0] ?? g.name));
      plan.steps.forEach(s => {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.why.length).toBeGreaterThan(0);
        expect(s.description.length).toBeGreaterThan(0);
      });
    }
  });
});
