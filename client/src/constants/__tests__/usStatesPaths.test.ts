import {
  US_MAP_VIEWBOX,
  US_STATES_PATHS,
  US_STATES_PATHS_SOURCE,
} from '../usStatesPaths';

const EXPECTED_NAMES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

describe('usStatesPaths integrity', () => {
  it('contains all 50 states plus DC', () => {
    expect(US_STATES_PATHS).toHaveLength(51);
    const names = US_STATES_PATHS.map(s => s.name);
    for (const name of EXPECTED_NAMES) {
      expect(names).toContain(name);
    }
  });

  it('has unique FIPS codes and names', () => {
    const fips = US_STATES_PATHS.map(s => s.fips);
    expect(new Set(fips).size).toBe(US_STATES_PATHS.length);
    const names = US_STATES_PATHS.map(s => s.name);
    expect(new Set(names).size).toBe(US_STATES_PATHS.length);
  });

  it('includes the key non-contiguous entries with string FIPS codes', () => {
    const byFips = Object.fromEntries(US_STATES_PATHS.map(s => [s.fips, s]));
    expect(byFips['02'].name).toBe('Alaska');
    expect(byFips['11'].name).toBe('District of Columbia');
    expect(byFips['15'].name).toBe('Hawaii');
    for (const s of US_STATES_PATHS) {
      expect(typeof s.fips).toBe('string');
      expect(s.fips).toMatch(/^\d{2}$/);
    }
  });

  it.each(US_STATES_PATHS)('$name has a usable path', ({ d }) => {
    expect(typeof d).toBe('string');
    expect(d.length).toBeGreaterThan(20);
    expect(d.startsWith('M')).toBe(true);
    // Only path commands and numeric coordinates allowed.
    expect(d).toMatch(/^[MLml0-9.,\-\sZz]+$/);
  });

  it('keeps every coordinate finite and inside the viewBox (with tolerance)', () => {
    const { width, height } = US_MAP_VIEWBOX;
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    const numberPattern = /-?\d+(?:\.\d+)?/g;
    for (const state of US_STATES_PATHS) {
      for (const match of state.d.match(numberPattern) ?? []) {
        const n = Number(match);
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(-1.5);
        expect(n).toBeLessThanOrEqual(Math.max(width, height) + 1.5);
      }
    }
  });

  it('exposes a provenance note referencing the source dataset and projection', () => {
    expect(US_STATES_PATHS_SOURCE).toContain('PublicaMundi/MappingAPI');
    expect(US_STATES_PATHS_SOURCE).toContain('Albers equal-area conic');
    expect(US_STATES_PATHS_SOURCE).toContain('public-domain');
  });
});
