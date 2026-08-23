import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { ACTION_PLAN_STEP_COUNT } from '../utils/actionPlan';

const STORAGE_KEY = 'careerality_plan_progress';

// Stable identity matters: a fresh {} per render would make useLocalStorage's
// readValue callback change every render and retrigger its storage effect.
const EMPTY_COMPLETIONS: Record<string, boolean> = {};

export const planProgressKey = (occupationCode: string, stepId: string): string =>
  `${occupationCode}:${stepId}`;

export interface PlanProgress {
  completions: Record<string, boolean>;
  toggleStep: (occupationCode: string, stepId: string) => void;
  isComplete: (occupationCode: string, stepId: string) => boolean;
  progressFor: (occupationCode: string, totalSteps?: number) => number;
}

export const usePlanProgress = (): PlanProgress => {
  const [completions, setCompletions] = useLocalStorage<Record<string, boolean>>(STORAGE_KEY, EMPTY_COMPLETIONS);

  const toggleStep = useCallback(
    (occupationCode: string, stepId: string) => {
      const key = planProgressKey(occupationCode, stepId);
      setCompletions(prev => ({ ...prev, [key]: !prev[key] }));
    },
    [setCompletions]
  );

  const isComplete = useCallback(
    (occupationCode: string, stepId: string): boolean => !!completions[planProgressKey(occupationCode, stepId)],
    [completions]
  );

  const progressFor = useCallback(
    (occupationCode: string, totalSteps: number = ACTION_PLAN_STEP_COUNT): number => {
      if (totalSteps <= 0) return 0;
      const prefix = `${occupationCode}:`;
      const done = Object.keys(completions).filter(k => k.startsWith(prefix) && completions[k]).length;
      return Math.min(1, done / totalSteps);
    },
    [completions]
  );

  return useMemo(
    () => ({ completions, toggleStep, isComplete, progressFor }),
    [completions, toggleStep, isComplete, progressFor]
  );
};
