import { API_BASE } from '../constants/dataSources';

export interface JevTriage {
  intent: string;
  needs_human: boolean;
  jailbreak_attempt: boolean;
  confidence: number;
  recommended_task: string;
  provider: 'jev' | 'fallback';
}

// POSTs a question to the Jev triage endpoint. Returns null when the
// endpoint is unreachable so callers hide the answer panel.
export async function triageMessage(message: string, context: Record<string, unknown> = {}): Promise<JevTriage | null> {
  try {
    const response = await fetch(`${API_BASE}/api/jev/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { triage?: JevTriage };
    return json.triage ?? null;
  } catch {
    return null;
  }
}

const TASK_LABELS: Record<string, string> = {
  shadow: 'Shadow someone in the field',
  job_postings: 'Browse real job postings',
  skill_video: 'Watch a skill deep-dive',
  human_counselor: 'Talk to a counselor',
  mini_project: 'Try a mini-project',
};

export function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}
