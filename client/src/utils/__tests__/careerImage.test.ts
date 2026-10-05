import { getImageUrl, getImageUrlForSlot, getImageUrls, IMAGE_SLOTS } from '../careerImage';

describe('careerImage', () => {
  it('keeps the existing single-image URL unchanged', () => {
    // Regression guard: SwipeCard, MapScreen and CompareScreen depend on this.
    expect(getImageUrl('15-1234')).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/1512.webp'
    );
  });

  it('compacts a fully-formed SOC code', () => {
    expect(getImageUrl('11-1011.00')).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/111011.webp'
    );
  });

  it('builds a per-slot URL', () => {
    expect(getImageUrlForSlot('11-1011.00', 2)).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/111011-2.webp'
    );
  });

  it('offers three slots plus the legacy fallback', () => {
    const urls = getImageUrls('29-1141.00');

    expect(IMAGE_SLOTS).toBe(3);
    expect(urls).toHaveLength(4);
    expect(urls[0]).toContain('/291141-1.webp');
    expect(urls[1]).toContain('/291141-2.webp');
    expect(urls[2]).toContain('/291141-3.webp');
    // Legacy single image last, so it is only used if every slot 404s.
    expect(urls[3]).toBe(getImageUrl('29-1141.00'));
  });
});