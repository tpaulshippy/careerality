import { CareerROI, RoiResponse, SortOption, SwipeApiRecord } from '../types';
import { apiClient } from '../api/client';
// Bundler-friendly synchronous load: Metro inlines this JSON at bundle time,
// so every catalog LIST is available offline with zero network calls.
import bundledCatalog from '../../assets/data/catalog.v1.json';

/**
 * Exact v1 shape produced by server/scripts/export_pg_to_catalog.py.
 * rows: [occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone,
 *        eduLevel, indIdx, demandRank, demandScore, openings, growth,
 *        colIndex, adjSalary]
 */
export type CatalogRowTuple = [
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export interface CatalogBundle {
  version: number;
  generated_at: string | null;
  source: string;
  // counts.industries is optional: older bundles predate it, so loadCatalog
  // normalizes a missing value from industries.length at runtime.
  counts: { areas: number; industries?: number; occupations: number; rows: number };
  areas: Array<{ c: string; n: string }>;
  occupations: Array<{ c: string; n: string }>;
  industries: Array<{ c: string; n: string }>;
  rows: CatalogRowTuple[];
  map: Record<
    string,
    {
      count: number;
      avgSalary: number | null;
      adjSalary: number | null;
      medianRoi: number | null;
      highRoi: number;
      demandCount: number;
      demandAvgRank: number | null;
    }
  >;
}

interface ParsedRow {
  id: number;
  occ: string;
  occName: string;
  area: string;
  areaName: string;
  salary: number | null;
  eduCost: number | null;
  breakeven: number | null;
  roi: number | null;
  jobZone: number | null;
  eduLevel: string;
  indCode: string;
  indName: string;
  drank: number | null;
  dscore: number | null;
  openings: number | null;
  growth: number | null;
  col: number | null;
  adj: number | null;
}

export interface CatalogMeta {
  version: number;
  generated_at: string | null;
  rowCount: number;
  isEmpty: boolean;
}

export interface CatalogQuery {
  area_code?: string;
  min_salary?: number;
  max_salary?: number;
  sort?: SortOption;
  q?: string;
  page?: number;
  per_page?: number;
  excludeIds?: number[];
}

export interface MapSummary {
  states: Record<
    string,
    {
      hasRecords: boolean;
      avgSalary: number | null;
      adjustedSalary: number | null;
      medianRoi: number | null;
      highRoiCount: number;
      demandCount: number;
      demandAvgRank: number | null;
    }
  >;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const str = (v: number | null): string => (v == null ? '' : String(v));

let rows: ParsedRow[] = [];
let byId = new Map<number, ParsedRow>();
let byCodeArea = new Map<string, ParsedRow>();
let areaList: Array<{ area_code: string; area_name: string }> = [];
let mapSummary: MapSummary = { states: {} };
let meta: CatalogMeta = { version: 1, generated_at: null, rowCount: 0, isEmpty: true };

function parseRow(t: CatalogRowTuple, bundle: CatalogBundle): ParsedRow | null {
  const occ = bundle.occupations[t[0]];
  const area = bundle.areas[t[1]];
  if (!occ || !area) return null;
  const ind = t[9] != null ? bundle.industries[t[9]] : undefined;
  return {
    id: t[2],
    occ: occ.c,
    occName: occ.n,
    area: area.c,
    areaName: area.n,
    salary: num(t[3]),
    eduCost: num(t[4]),
    breakeven: num(t[5]),
    roi: num(t[6]),
    jobZone: num(t[7]),
    eduLevel: t[8] ?? '',
    indCode: ind?.c ?? '',
    indName: ind?.n ?? '',
    drank: num(t[10]),
    dscore: num(t[11]),
    openings: num(t[12]),
    growth: num(t[13]),
    col: num(t[14]),
    adj: num(t[15]),
  };
}

/**
 * (Re)builds the lookup indexes from a bundle. Defaults to the bundled
 * catalog.v1.json so callers get the shipped data with zero setup.
 * Tests pass an inline fixture to avoid depending on real bundle data.
 */
export function loadCatalog(bundleData: CatalogBundle = bundledCatalog as unknown as CatalogBundle): CatalogMeta {
  // Normalize bundles that predate counts.industries (safe-cast above lets
  // such JSON satisfy the type; the real value is industries.length).
  if (bundleData.counts && bundleData.counts.industries == null) {
    bundleData.counts = { ...bundleData.counts, industries: bundleData.industries.length };
  }
  const parsed: ParsedRow[] = [];
  for (const t of bundleData.rows ?? []) {
    const r = parseRow(t, bundleData);
    if (r) parsed.push(r);
  }
  rows = parsed;
  byId = new Map(parsed.map(r => [r.id, r]));
  byCodeArea = new Map(parsed.map(r => [`${r.occ}|${r.area}`, r]));
  const areas = bundleData.areas ?? [];
  const national = areas.filter(a => a.c === '99');
  const rest = areas.filter(a => a.c !== '99');
  areaList = [...national, ...rest].map(a => ({ area_code: a.c, area_name: a.n }));
  const states: MapSummary['states'] = {};
  for (const [areaIdx, m] of Object.entries(bundleData.map ?? {})) {
    const area = areas[Number(areaIdx)];
    if (!area) continue;
    states[area.c] = {
      hasRecords: m.count > 0,
      avgSalary: m.avgSalary,
      adjustedSalary: m.adjSalary,
      medianRoi: m.medianRoi,
      highRoiCount: m.highRoi,
      demandCount: m.demandCount,
      demandAvgRank: m.demandAvgRank,
    };
  }
  mapSummary = { states };
  meta = {
    version: bundleData.version ?? 1,
    generated_at: bundleData.generated_at ?? null,
    rowCount: parsed.length,
    isEmpty: parsed.length === 0,
  };
  return meta;
}

// Build indexes at import time: synchronous, bundler-friendly, offline.
loadCatalog();

export function getCatalogMeta(): CatalogMeta {
  return meta;
}

export function isCatalogEmpty(): boolean {
  return meta.isEmpty;
}

/** Denormalized CareerROI. Skills/detail columns are NOT in the bundle — detail fetch fills those later. */
export function toCareerROI(r: ParsedRow): CareerROI {
  return {
    id: r.id,
    occupation_code: r.occ,
    occupation_name: r.occName,
    area_code: r.area,
    area_name: r.areaName,
    annual_median_salary: str(r.salary),
    education_cost: str(r.eduCost),
    years_to_breakeven: r.breakeven ?? 0,
    roi_percentage: str(r.roi),
    job_zone: r.jobZone ?? 0,
    education_level: r.eduLevel,
    skills: [],
    cost_of_living_index: str(r.col),
    adjusted_salary: str(r.adj),
    industry_code: r.indCode,
    industry_name: r.indName,
    demand_rank: r.drank,
    demand_score: r.dscore,
    avg_annual_openings: r.openings,
    projected_growth_percent: r.growth,
  };
}

// DESC with NULLS FIRST (mirrors Postgres: DESC defaults to NULLS FIRST).
function descNullsFirst(get: (r: ParsedRow) => number | null) {
  return (a: ParsedRow, b: ParsedRow): number => {
    const av = get(a);
    const bv = get(b);
    if (av == null && bv == null) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    return bv - av;
  };
}

/**
 * Mirrors server/src/routes/roi.ts feed semantics against the local bundle:
 * area scope (defaults "99"), inclusive salary bounds, the four sort
 * branches (demand falls back to roi desc when no rows carry demand data),
 * case-insensitive substring q within the area, and pagy-shaped pagination.
 */
export function queryCatalog(opts: CatalogQuery = {}): RoiResponse {
  const area = opts.area_code ?? '99';
  const perPage = opts.per_page ?? 20;
  const page = opts.page != null && opts.page >= 1 ? Math.floor(opts.page) : 1;
  const q = (opts.q ?? '').trim().toLowerCase();
  const excluded = opts.excludeIds && opts.excludeIds.length > 0 ? new Set(opts.excludeIds) : null;

  let filtered = rows.filter(r => r.area === area);
  const minSalary = opts.min_salary;
  const maxSalary = opts.max_salary;
  if (minSalary != null) filtered = filtered.filter(r => r.salary != null && (r.salary as number) >= minSalary);
  if (maxSalary != null) filtered = filtered.filter(r => r.salary != null && (r.salary as number) <= maxSalary);
  if (q) filtered = filtered.filter(r => r.occName.toLowerCase().includes(q));
  if (excluded) filtered = filtered.filter(r => !excluded.has(r.id));

  const sort = opts.sort ?? 'roi';
  if (sort === 'salary') {
    filtered = [...filtered].sort(descNullsFirst(r => r.salary));
  } else if (sort === 'breakeven') {
    // ASC NULLS LAST (mirrors Postgres).
    filtered = [...filtered].sort((a, b) => {
      if (a.breakeven == null && b.breakeven == null) return 0;
      if (a.breakeven == null) return 1;
      if (b.breakeven == null) return -1;
      return a.breakeven - b.breakeven;
    });
  } else if (sort === 'demand') {
    // Existence probe first: when no rows carry demand data, fall back to
    // roi desc (mirrors the server's demand-vs-roi probe). Otherwise
    // demand rows only, ordered like the server's orderDemand.
    if (filtered.some(r => r.dscore != null)) {
      filtered = [...filtered]
        .filter(r => r.dscore != null)
        .sort((a, b) => {
          const score = (b.dscore as number) - (a.dscore as number);
          if (score !== 0) return score;
          const ar = a.drank;
          const br = b.drank;
          if (ar == null && br == null) return 0;
          if (ar == null) return 1;
          if (br == null) return -1;
          if (ar !== br) return ar - br;
          const ag = a.growth;
          const bg = b.growth;
          if (ag == null && bg == null) return 0;
          if (ag == null) return 1;
          if (bg == null) return -1;
          if (bg !== ag) return bg - ag;
          return a.occ < b.occ ? -1 : a.occ > b.occ ? 1 : 0;
        });
    } else {
      filtered = [...filtered].sort(descNullsFirst(r => r.roi));
    }
  } else {
    filtered = [...filtered].sort(descNullsFirst(r => r.roi));
  }

  const count = filtered.length;
  const start = (page - 1) * perPage;
  const records = filtered.slice(start, start + perPage).map(toCareerROI);
  return {
    records,
    pagy: {
      page,
      items: perPage,
      count,
      // Pagy reports at least 1 page even when empty.
      pages: Math.max(Math.ceil(count / perPage), 1),
    },
  };
}

/** States from the bundle, national "99" first. */
export function listStates(): { states: Array<{ area_code: string; area_name: string }> } {
  return { states: areaList };
}

export function getMapSummary(): MapSummary {
  return mapSummary;
}

export function findLocalCareer(occupation_code: string, area_code: string): CareerROI | undefined {
  const r = byCodeArea.get(`${occupation_code}|${area_code}`);
  return r ? toCareerROI(r) : undefined;
}

export function findLocalById(id: number): CareerROI | undefined {
  const r = byId.get(id);
  return r ? toCareerROI(r) : undefined;
}

// ---------- Server-fallback helpers ----------
// When the bundle is still the empty placeholder, list screens keep working
// by falling back to the existing apiClient list calls. No fallback logic
// lives in the screens themselves.

export interface QueryCareersParams {
  page?: number;
  area_code?: string;
  min_salary?: number;
  max_salary?: number;
  sort?: SortOption;
  q?: string;
  per_page?: number;
  excludeIds?: number[];
  /** Forwarded to apiClient.searchCareers on the server-fallback path only. */
  signal?: AbortSignal;
}

/** Local-first list/search: bundle when populated, apiClient otherwise. */
export async function queryCareers(params: QueryCareersParams = {}): Promise<RoiResponse> {
  if (!isCatalogEmpty()) {
    return queryCatalog(params);
  }
  if (params.q != null && params.q.trim() !== '') {
    return apiClient.searchCareers(params.q.trim(), params.area_code ?? '99', params.signal);
  }
  // per_page / excludeIds / q are local-only concepts: the frozen server
  // API has no such params (exclusion is server-side via user_id).
  const clean: Record<string, string | number> = {};
  if (params.page !== undefined) clean.page = params.page;
  if (params.area_code !== undefined) clean.area_code = params.area_code;
  if (params.min_salary !== undefined) clean.min_salary = params.min_salary;
  if (params.max_salary !== undefined) clean.max_salary = params.max_salary;
  if (params.sort !== undefined) clean.sort = params.sort;
  return apiClient.getCareers(clean);
}

/** Local-first states: bundle when populated, apiClient otherwise. */
export async function listStatesOrFallback(): Promise<{
  states: Array<{ area_code: string; area_name: string }>;
}> {
  if (!isCatalogEmpty()) return listStates();
  return apiClient.getStates();
}

export type LikedRecord = CareerROI & { swipe_id: number; swiped_at: string };

/**
 * Hydrates liked/compare/action-plan records from the local bundle using
 * career_ids from swipe history (right swipes). Returns null when the bundle
 * is empty so callers can fall back to getLikedCareers. Swipe metadata
 * (swipe_id, swiped_at) still comes from the server.
 */
export function hydrateLikedFromCatalog(swipes: SwipeApiRecord[]): LikedRecord[] | null {
  if (isCatalogEmpty()) return null;
  const out: LikedRecord[] = [];
  for (const s of swipes) {
    if (s.direction !== 'right' || s.career_id == null) continue;
    const local = findLocalById(s.career_id);
    if (!local) continue;
    out.push({ ...local, swipe_id: s.id, swiped_at: s.created_at });
  }
  return out;
}

/**
 * Screens opening detail from a local record render it instantly, then call
 * this to merge server-only columns (skills, day_in_life_*, video_url) when
 * the detail fetch resolves. No-op failures: the local record stays.
 */
export function fetchDetailInBackground(local: CareerROI, apply: (merged: CareerROI) => void): void {
  void apiClient
    .getCareerInArea(local.occupation_code, local.area_code)
    .then(detail => {
      apply({
        ...local,
        skills: detail.skills ?? [],
        day_in_life_summary: detail.day_in_life_summary,
        day_in_life_full: detail.day_in_life_full,
        video_url: detail.video_url,
      });
    })
    .catch(() => {});
}
