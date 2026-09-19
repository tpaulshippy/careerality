import { API_BASE } from '../constants/dataSources';

export interface JevQaScore {
  salary_hallucinated: number;
  contradicts_onet: number;
  authenticity: number;
  regenerate: boolean;
  confidence: number;
  provider: 'jev' | 'fallback';
}

// POSTs one narrative to the Jev QA endpoint. Returns null when the
// endpoint is unreachable so callers hide the verdict.
export async function scoreNarrative(input: {
  narrative: string;
  onet_tasks: string[];
  occupation_code: string;
}): Promise<JevQaScore | null> {
  try {
    const response = await fetch(`${API_BASE}/api/jev/qa_score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { score?: JevQaScore };
    return json.score ?? null;
  } catch {
    return null;
  }
}
