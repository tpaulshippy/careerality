const R2_IMAGE_BASE_URL = 'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev';

// Images per career. Kept in sync with ImagePrompts::IMAGE_COUNT in
// data/content_generation/image_prompts.rb.
export const IMAGE_SLOTS = 3;

// R2 objects are named with the compact 6-digit SOC code. The API returns the
// canonical "XX-XXXX.00" form, but tolerate the other shapes so a bare or
// dash-only code does not silently produce a truncated filename.
const compactCode = (occupationCode: string): string => {
  const digits = occupationCode.replace(/[^0-9]/g, '');
  return digits.length > 6 ? digits.slice(0, 6) : digits;
};

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