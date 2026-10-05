import {
  getImageUrl,
  getImageUrlForSlot,
  getImageUrls,
  IMAGE_SLOTS,
} from '../careerImage';

// Loads the module fresh with a given env value, since the base URL is read at
// module load time.
const loadWith = (env: string | undefined) => {
  const previous = process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL;
  if (env === undefined) delete process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL;
  else process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL = env;

  let mod: typeof import('../careerImage') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../careerImage') as typeof import('../careerImage');
  });

  if (previous === undefined) delete process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL;
  else process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL = previous;

  if (!mod) throw new Error('failed to load careerImage');
  return mod;
};

describe('careerImage base URL override', () => {
  it('falls back to the default when the override is empty', () => {
    // `??` would keep the empty string and produce relative URLs.
    expect(loadWith('').getImageUrl('111011')).toBe(
      `${BASE}/111011.webp`
    );
  });

  it('strips a trailing slash so object keys are not doubled', () => {
    expect(
      loadWith('https://example.test/r2/').getImageUrl('111011')
    ).toBe('https://example.test/r2/111011.webp');
  });

  it('uses the default host when the override is absent', () => {
    expect(loadWith(undefined).getImageUrl('111011')).toBe(`${BASE}/111011.webp`);
  });
});

const BASE = 'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev';

describe('careerImage', () => {
  it('resolves the canonical SOC form returned by the API', () => {
    expect(getImageUrl('11-1011.00')).toBe(`${BASE}/111011.webp`);
  });

  it('resolves a dash-only code to the same 6 digits', () => {
    expect(getImageUrl('11-1011')).toBe(`${BASE}/111011.webp`);
  });

  it('leaves an already-compact code untouched', () => {
    expect(getImageUrl('111011')).toBe(`${BASE}/111011.webp`);
  });

  it('builds a per-slot URL', () => {
    expect(getImageUrlForSlot('11-1011.00', 2)).toBe(`${BASE}/111011-2.webp`);
  });

  it('offers three slots plus the legacy fallback', () => {
    const urls = getImageUrls('29-1141.00');

    expect(IMAGE_SLOTS).toBe(3);
    expect(urls).toHaveLength(4);
    expect(urls[0]).toBe(`${BASE}/291141-1.webp`);
    expect(urls[1]).toBe(`${BASE}/291141-2.webp`);
    expect(urls[2]).toBe(`${BASE}/291141-3.webp`);
    // Legacy single image last, so it is only used if every slot 404s.
    expect(urls[3]).toBe(getImageUrl('29-1141.00'));
  });
});