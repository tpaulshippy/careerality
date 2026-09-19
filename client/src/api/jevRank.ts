import { API_BASE } from '../constants/dataSources';

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

// POSTs raw swipe history + candidate codes to the Jev ranking endpoint.
// Returns null when the endpoint is unreachable so callers keep server order.
export async function rankCareers(
  swipes: unknown[],
  occupationCodes: string[]
): Promise<RankOutcome | null> {
  try {
    const response = await fetch(`${API_BASE}/api/jev/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swipes,
        candidates: occupationCodes.map((occupation_code) => ({ occupation_code })),
      }),
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
