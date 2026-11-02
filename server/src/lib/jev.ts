import { inArray } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { careerRoi } from "../db/schema";

// Port of Rails JevRankingService: one listwise System One call per rank.
// State in (swipe history + full candidate set), typed choice out. Falls back
// to preserving input order when TYPESAFE_API_KEY is blank or Jev raises, so
// tests/dev work without a key and the Discover feed never breaks.
//
// Wire contract mirrors the ruby_llm-typesafe gem exactly:
//   POST {TYPESAFE_API_BASE}/v1/systemone { model, state, questions }
//   -> { model, answers: { next_card: { probabilities, confidence } }, usage }
export const JEV_MODEL_DEFAULT = "jev-latest";
export const JEV_API_BASE_DEFAULT = "https://api.typesafe.ai";
export const MAX_CANDIDATES = 50;
// D1 caps bound parameters per query (~100); chunk enrichment lookups well
// below that so large swipe histories can't 500 the rank endpoint.
export const LOOKUP_CHUNK_SIZE = 50;
const TYPESAFE_TIMEOUT_MS = 15_000;

export function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

// Optional client-supplied enrichment from the app's local bundle. When the
// lookup covers every id/code needing enrichment, the corresponding D1 query
// is skipped entirely; anything less falls back to the D1 path untouched.
export interface RankLookup {
  careerLookup?: Record<string, unknown>;
  candidateNames?: Record<string, unknown>;
}

function lookupCareerHit(
  careerLookup: RankLookup["careerLookup"],
  id: number,
): { code: string; name: string } | undefined {
  if (careerLookup == null || typeof careerLookup !== "object") return undefined;
  const hit = (careerLookup as Record<string, unknown>)[String(id)];
  if (typeof hit !== "object" || hit === null) return undefined;
  const code = (hit as Record<string, unknown>)["occupation_code"];
  if (typeof code !== "string" || code.length === 0) return undefined;
  const name = (hit as Record<string, unknown>)["occupation_name"];
  return { code, name: typeof name === "string" ? name : "" };
}

function lookupCandidateName(
  candidateNames: RankLookup["candidateNames"],
  code: string,
): string | undefined {
  if (candidateNames == null || typeof candidateNames !== "object")
    return undefined;
  const name = (candidateNames as Record<string, unknown>)[code];
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

const NEXT_CARD_INSTRUCTIONS =
  "Which career should be shown next given the user's swipe history?";

export interface RankResult {
  occupation_code: string;
  p_like: number;
  fit_score: number;
  driver: string | null;
  confidence: number;
  provider: "jev" | "fallback";
}

type LooseRecord = Record<string, unknown>;

function toRecord(value: unknown): LooseRecord {
  return typeof value === "object" && value !== null
    ? (value as LooseRecord)
    : {};
}

function field(row: LooseRecord, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function fallbackResult(code: string): RankResult {
  return {
    occupation_code: code,
    p_like: 0.5,
    fit_score: 1.0,
    driver: "security",
    confidence: 0.5,
    provider: "fallback",
  };
}

// Resolve raw swipe career_ids to occupation codes + names so history matches
// candidates and Jev sees human-readable labels, not opaque SOC codes.
// Complete client coverage (careerLookup) skips the D1 lookup entirely.
async function withCodes(
  db: AppDb,
  swipes: LooseRecord[],
  careerLookup?: RankLookup["careerLookup"],
): Promise<LooseRecord[]> {
  const careerIds = [
    ...new Set(
      swipes
        .map((s) => s["career_id"])
        .filter((v): v is number => typeof v === "number"),
    ),
  ];
  // Partial client coverage falls back to the D1 path untouched.
  if (!hasCompleteCareerCoverage(careerLookup, careerIds)) {
    const byId = await fetchCodesById(db, careerIds);
    return swipes.map((s) => {
      const cid = s["career_id"];
      return applyCodeHit(
        s,
        typeof cid === "number" ? byId.get(cid) : undefined,
      );
    });
  }
  const localById = new Map<number, { code: string; name: string }>();
  for (const id of careerIds) {
    localById.set(id, lookupCareerHit(careerLookup, id) as {
      code: string;
      name: string;
    });
  }
  return swipes.map((s) => {
    const cid = s["career_id"];
    return applyCodeHit(
      s,
      typeof cid === "number" ? localById.get(cid) : undefined,
    );
  });
}

function hasCompleteCareerCoverage(
  careerLookup: RankLookup["careerLookup"],
  careerIds: number[],
): boolean {
  return careerIds.every(
    (id) => lookupCareerHit(careerLookup, id) !== undefined,
  );
}

function applyCodeHit(
  s: LooseRecord,
  hit: { code: string; name: string } | undefined,
): LooseRecord {
  const reason =
    field(s, "reason") ?? field(s, "feedback") ?? undefined;
  return {
    ...s,
    ...(hit && !field(s, "occupation_code")
      ? { occupation_code: hit.code }
      : {}),
    ...(hit && !field(s, "occupation_name") && hit.name
      ? { occupation_name: hit.name }
      : {}),
    ...(reason !== undefined ? { reason } : {}),
  };
}

async function fetchCodesById(
  db: AppDb,
  careerIds: number[],
): Promise<Map<number, { code: string; name: string }>> {
  const byId = new Map<number, { code: string; name: string }>();
  for (const ids of chunk(careerIds, LOOKUP_CHUNK_SIZE)) {
    if (ids.length === 0) continue;
    const rows = await db
      .select({
        id: careerRoi.id,
        occupation_code: careerRoi.occupation_code,
        occupation_name: careerRoi.occupation_name,
      })
      .from(careerRoi)
      .where(inArray(careerRoi.id, ids));
    for (const r of rows) {
      if (r.id != null)
        byId.set(r.id, {
          code: r.occupation_code,
          name: r.occupation_name ?? "",
        });
    }
  }
  return byId;
}

// Fill candidate names missing from the request from the DB so Jev always
// sees e.g. { occupation_code: "15-1252.00", occupation_name: "Software Developers" }.
// Complete client coverage (candidateNames) skips the D1 lookup entirely.
async function withCandidateNames(
  db: AppDb,
  candidates: LooseRecord[],
  candidateNames?: RankLookup["candidateNames"],
): Promise<LooseRecord[]> {
  const missing = [
    ...new Set(
      candidates
        .filter((c) => field(c, "occupation_name") === undefined)
        .map((c) => field(c, "occupation_code"))
        .filter((v): v is string => typeof v === "string"),
    ),
  ];
  if (missing.length === 0) return candidates;
  // Partial client coverage falls back to the D1 path untouched: D1 is the
  // source of truth and fills every missing name it knows.
  if (!hasCompleteCandidateCoverage(candidateNames, missing)) {
    return applyCandidateNames(candidates, await fetchNamesByCode(db, missing));
  }
  const local = new Map<string, string>();
  for (const code of missing) {
    local.set(code, lookupCandidateName(candidateNames, code) as string);
  }
  return applyCandidateNames(candidates, local);
}

function hasCompleteCandidateCoverage(
  candidateNames: RankLookup["candidateNames"],
  missing: string[],
): boolean {
  return missing.every(
    (code) => lookupCandidateName(candidateNames, code) !== undefined,
  );
}

function applyCandidateNames(
  candidates: LooseRecord[],
  names: Map<string, string>,
): LooseRecord[] {
  return candidates.map((c) => {
    const code = field(c, "occupation_code");
    const name = code !== undefined ? names.get(code) : undefined;
    return name !== undefined && field(c, "occupation_name") === undefined
      ? { ...c, occupation_name: name }
      : c;
  });
}

async function fetchNamesByCode(
  db: AppDb,
  missing: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const codes of chunk(missing, LOOKUP_CHUNK_SIZE)) {
    const rows = await db
      .select({
        occupation_code: careerRoi.occupation_code,
        occupation_name: careerRoi.occupation_name,
      })
      .from(careerRoi)
      .where(inArray(careerRoi.occupation_code, codes));
    for (const r of rows) {
      if (r.occupation_name != null) names.set(r.occupation_code, r.occupation_name);
    }
  }
  return names;
}

interface TypesafeAnswer {
  probabilities?: Record<string, unknown>;
  confidence?: unknown;
}

function parseAnswer(body: unknown): TypesafeAnswer | null {
  const root = toRecord(body);
  const answers = toRecord(root["answers"]);
  const next = toRecord(answers["next_card"]);
  if (Object.keys(next).length === 0) return null;
  return {
    probabilities: toRecord(next["probabilities"]),
    confidence: next["confidence"],
  };
}

export async function rank(
  db: AppDb,
  env: {
    TYPESAFE_API_KEY?: string;
    TYPESAFE_API_BASE?: string;
    JEV_MODEL?: string;
  },
  swipes: unknown[],
  candidates: unknown[],
  lookup: RankLookup = {},
): Promise<RankResult[]> {
  const swipeRows = swipes.map(toRecord);
  const candidateRows = candidates.map(toRecord);
  const codes = candidateRows
    .map((c) => field(c, "occupation_code"))
    .filter((v): v is string => typeof v === "string");
  if (codes.length === 0) return [];

  // Enrichment runs inside the protected path so a D1 failure degrades to
  // the input-order fallback instead of 500ing (mirrors the Rails rescue).
  try {
    const enrichedSwipes = await withCodes(db, swipeRows, lookup.careerLookup);
    const enrichedCandidates = await withCandidateNames(
      db,
      candidateRows,
      lookup.candidateNames,
    );
    const orderedCodes = enrichedCandidates
      .map((c) => field(c, "occupation_code"))
      .filter((v): v is string => typeof v === "string");

    const apiKey = env.TYPESAFE_API_KEY ?? "";
    if (apiKey === "") {
      return orderedCodes.map(fallbackResult);
    }
    const base = (env.TYPESAFE_API_BASE ?? JEV_API_BASE_DEFAULT).replace(
      /\/+$/,
      "",
    );
    const model = env.JEV_MODEL ?? JEV_MODEL_DEFAULT;
    const criteria: Record<string, string | null> = {};
    for (const c of enrichedCandidates) {
      const code = field(c, "occupation_code");
      if (code !== undefined)
        criteria[code] = field(c, "occupation_name") ?? null;
    }
    const res = await fetch(`${base}/v1/systemone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // A stalled provider must degrade to the fallback, not hang the feed.
      signal: AbortSignal.timeout(TYPESAFE_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        state: { swipes: enrichedSwipes, candidates: enrichedCandidates },
        questions: {
          next_card: {
            type: "choice",
            instructions: NEXT_CARD_INSTRUCTIONS,
            criteria,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`TypeSafe HTTP ${res.status}`);
    const answer = parseAnswer(await res.json());
    if (answer === null) throw new Error("TypeSafe returned no next_card answer");
    const probs = answer.probabilities ?? {};
    const confidence =
      typeof answer.confidence === "number" ? answer.confidence : 0;
    const ordered = Object.entries(probs)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([code]) => code)
      .filter((code) => codes.includes(code));
    for (const code of codes) {
      if (!ordered.includes(code)) ordered.push(code);
    }
    return ordered.map((code) => {
      const p = Number(probs[code] ?? 0);
      return {
        occupation_code: code,
        p_like: Number.isFinite(p) ? p : 0,
        fit_score: Number.isFinite(p) ? p : 0,
        driver: null,
        confidence,
        provider: "jev" as const,
      };
    });
  } catch (err) {
    console.error("jev rank failed, using fallback order", err);
    return codes.map(fallbackResult);
  }
}
