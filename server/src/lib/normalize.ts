// Mirrors Api::Concerns::OccupationCodeNormalizer from Rails.

// Accepts fully-formed "XX-XXXX.00", short "XX-XXXX" (append ".00"), and
// compact "XXXXXX" (insert dash + ".00"). Returns null when invalid.
export function normalizeOccupationCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim();
  if (/^\d{2}-\d{4}\.00$/.test(c)) return c;
  if (/^\d{2}-\d{4}$/.test(c)) return `${c}.00`;
  if (/^\d{6}$/.test(c)) return `${c.slice(0, 2)}-${c.slice(2)}.00`;
  return null;
}
