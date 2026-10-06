// Must stay in step with UploadImages::DEFAULT_PUBLIC_URL in
// data/content_generation/upload_images.rb, which refuses to upload under a
// different host. Override both together if the bucket ever moves.
//
// `||` rather than `??` so an empty env var falls back to the default, and the
// trailing slash is stripped: R2 treats ".../x//file" as a different object key,
// which would 404 every image and silently fall back to the legacy image.
const R2_IMAGE_BASE_URL = (
  process.env.EXPO_PUBLIC_R2_IMAGE_BASE_URL ||
  'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev'
).replace(/\/+$/, '');

// Images per career. Kept in sync with ImagePrompts::IMAGE_COUNT in
// data/content_generation/image_prompts.rb.
export const IMAGE_SLOTS = 3;

// R2 objects are named with the compact 6-digit SOC code. The API returns the
// canonical "XX-XXXX.00" form, but the other shapes are tolerated so a dash-only or
// already-compact code does not produce a truncated filename.
//
// Only the documented forms are accepted. Stripping digits from anything else would
// let a malformed value resolve to a *different* career and display its image, so
// unrecognised input is passed through unchanged (and will simply 404) rather than
// coerced. Mirrors Pipeline.compact in data/content_generation/pipeline.rb.
const VALID_SOC_CODE = /^(\d{6}|\d{2}-\d{4}(\.\d{2})?)$/;

const compactCode = (occupationCode: string): string => {
  const value = occupationCode.trim();
  if (!VALID_SOC_CODE.test(value)) return value;

  const digits = value.replace(/\D/g, '');
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