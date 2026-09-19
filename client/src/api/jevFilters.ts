import { API_BASE } from '../constants/dataSources';

export interface JevFilterRoute {
  education_pathway: string;
  work_env: string;
  min_salary: number | null;
  requires_clarification: boolean;
  confidence: number;
  provider: 'jev' | 'fallback';
}

// POSTs free text to the Jev NL-to-filters endpoint. Returns null when
// the endpoint is unreachable so callers keep manual filtering.
export async function routeNaturalLanguage(text: string): Promise<JevFilterRoute | null> {
  try {
    const response = await fetch(`${API_BASE}/api/jev/route_filters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { filters?: JevFilterRoute };
    return json.filters ?? null;
  } catch {
    return null;
  }
}

// Only long, multi-word input looks like natural language worth routing.
// Short keyword searches ("nurse", "remote") skip the Jev call entirely.
export function looksLikeNaturalLanguage(text: string): boolean {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 12) return false;
  return cleaned.split(' ').length >= 3;
}

// Human-readable keywords derived from a route, for keyword search.
export function routeKeywords(route: JevFilterRoute): string {
  const parts: string[] = [];
  if (route.work_env && route.work_env !== 'no_match') parts.push(route.work_env);
  return parts.join(' ');
}
