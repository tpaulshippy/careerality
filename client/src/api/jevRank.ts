import { API_BASE } from '../constants/dataSources';
import { findLocalById, findOccupationName, isCatalogEmpty } from '../data/catalog';

export interface JevRankResult {
  occupation_code: string;
  p_like: number;
  fit_score: number;
  driver: string;
  confidence: number;
  provider: 'jev' | 'fallback';
}

export interface RankOutcome {
  results: JevRankResult[];
  provider: 'jev' | 'fallback' | 'unknown';
}

// POSTs raw swipe history + candidate codes/names to the Jev ranking
// endpoint, plus optional local-bundle lookups (careerLookup: career_id ->
// { occupation_code, occupation_name }; candidateNames: code -> name) that let
// the server skip its D1 enrichment queries. When the bundle is empty no
// lookup fields are sent, so the payload is exactly the legacy shape.
// Returns null when the endpoint is unreachable so callers keep server order.
export async function rankCareers(
  swipes: unknown[],
  candidates: Array<{ occupation_code: string; occupation_name?: string }>
): Promise<RankOutcome | null> {
  try {
    const payload: Record<string, unknown> = {
      swipes,
      candidates: candidates.map((c) => ({
        occupation_code: c.occupation_code,
        ...(c.occupation_name ? { occupation_name: c.occupation_name } : {}),
      })),
    };
    if (!isCatalogEmpty()) {
      const careerLookup: Record<string, { occupation_code: string; occupation_name: string }> = {};
      for (const swipe of swipes) {
        const careerId =
          typeof swipe === 'object' && swipe !== null
            ? (swipe as Record<string, unknown>).career_id
            : undefined;
        if (typeof careerId === 'number' && careerLookup[String(careerId)] === undefined) {
          const local = findLocalById(careerId);
          if (local) {
            careerLookup[String(careerId)] = {
              occupation_code: local.occupation_code,
              occupation_name: local.occupation_name,
            };
          }
        }
      }
      if (Object.keys(careerLookup).length > 0) {
        payload.careerLookup = careerLookup;
      }
      const candidateNames: Record<string, string> = {};
      for (const c of candidates) {
        if (!c.occupation_name && candidateNames[c.occupation_code] === undefined) {
          const name = findOccupationName(c.occupation_code);
          if (name) candidateNames[c.occupation_code] = name;
        }
      }
      if (Object.keys(candidateNames).length > 0) {
        payload.candidateNames = candidateNames;
      }
    }
    const response = await fetch(`${API_BASE}/api/jev/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { results?: JevRankResult[] };
    const results = Array.isArray(json.results) ? json.results : [];
    const provider = results.length > 0 ? results[0].provider : 'unknown';
    return { results, provider };
  } catch {
    return null;
  }
}
