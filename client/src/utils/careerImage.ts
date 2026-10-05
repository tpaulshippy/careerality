const R2_IMAGE_BASE_URL = 'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev';

// Images per career. Kept in sync with ImagePrompts::IMAGE_COUNT in
// data/content_generation/image_prompts.rb.
export const IMAGE_SLOTS = 3;

// SOC codes are "XX-XXXX.00" and the objects on R2 are named with the compact
// 6-digit form ("11-1011.00" -> "111011").
const compactCode = (occupationCode: string): string =>
  occupationCode.replace(/-/g, '').replace(/\./g, '').slice(0, -2);

export const getImageUrl = (occupationCode: string): string =>
  `${R2_IMAGE_BASE_URL}/${compactCode(occupationCode)}.webp`;

// Per-slot URLs for the slideshow. Resolution is by convention rather than an API
// call: slot N is "<compact>-<N>.webp".
export const getImageUrlForSlot = (occupationCode: string, slot: number): string =>
  `${R2_IMAGE_BASE_URL}/${compactCode(occupationCode)}-${slot}.webp`;

// Candidate URLs in preference order. The trailing bare filename is the
// pre-slideshow single image, so careers that have not been regenerated yet still
// render something.
export const getImageUrls = (occupationCode: string): string[] => [
  ...Array.from({ length: IMAGE_SLOTS }, (_, i) => getImageUrlForSlot(occupationCode, i + 1)),
  getImageUrl(occupationCode),
];