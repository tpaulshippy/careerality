// Pagy-compatible pagination metadata. Like Pagy's default overflow
// behavior (:empty_page), out-of-range pages return an empty page, not an error.
export interface Pagy {
  page: number;
  items: number;
  count: number;
  pages: number;
}

export function parsePage(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function pagy(total: number, page: number, perPage: number): Pagy {
  return {
    page,
    items: perPage,
    count: total,
    pages: Math.ceil(total / perPage),
  };
}

export function offset(page: number, perPage: number): number {
  return (page - 1) * perPage;
}
