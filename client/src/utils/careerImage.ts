const R2_IMAGE_BASE_URL = 'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev';

export const getImageUrl = (occupationCode: string): string => {
  const digits = occupationCode.replace(/-/g, '').replace(/\./g, '').slice(0, -2);
  return `${R2_IMAGE_BASE_URL}/${digits}.webp`;
};
