import { getImageUrl, getImageUrlForSlot, getImageUrls, IMAGE_SLOTS } from '../careerImage';

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