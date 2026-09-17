import { API_BASE } from '../constants/dataSources';

export interface JevValuesProfile {
  salary_driven: number;
  credential_averse: number;
  stability_need: number;
  hands_on: number;
  confidence: number;
  provider: 'jev' | 'fallback';
}

// POSTs raw swipe history to the Jev values endpoint. Returns null when
// the endpoint is unreachable so callers can hide the Jev panel.
export async function fetchValuesProfile(swipes: unknown[]): Promise<JevValuesProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/api/jev/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swipes }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { profile?: JevValuesProfile };
    return json.profile ?? null;
  } catch {
    return null;
  }
}
