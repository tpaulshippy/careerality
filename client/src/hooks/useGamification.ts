import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  AwardResult,
  award,
  createEmptyGamificationState,
  GamificationState,
  XpEvent,
} from '../utils/gamification';

export const GAMIFICATION_STORAGE_KEY = 'careerality_gamification_v1';

// Stable identity across renders keeps useLocalStorage's load effect from looping.
const INITIAL_STATE = createEmptyGamificationState();

export interface XpPillData {
  id: number;
  amount: number;
}

export interface UseGamificationResult {
  state: GamificationState;
  isLoaded: boolean;
  /** Returns the award outcome so screens can time celebrations (e.g. after modals close). */
  trackEvent: (event: XpEvent) => AwardResult | null;
  xpPill: XpPillData | null;
  dismissXpPill: () => void;
}

/**
 * Local-first gamification state persisted as one JSON blob.
 * UI signals (XP pill, level-up) are derived from the latest award.
 */
export const useGamification = (): UseGamificationResult => {
  const [state, setState, , isLoaded] = useLocalStorage<GamificationState>(
    GAMIFICATION_STORAGE_KEY,
    INITIAL_STATE,
  );

  const loadedRef = useRef(false);
  useEffect(() => {
    if (isLoaded) loadedRef.current = true;
  }, [isLoaded]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const [xpPill, setXpPill] = useState<XpPillData | null>(null);
  const pillIdRef = useRef(0);

  const trackEvent = useCallback((event: XpEvent): AwardResult | null => {
    if (!loadedRef.current) return null;
    const result = award(stateRef.current, event, new Date());
    stateRef.current = result.state;
    setState(result.state);
    if (result.awarded && result.xpGained > 0) {
      pillIdRef.current += 1;
      setXpPill({ id: pillIdRef.current, amount: result.xpGained });
    }
    return result;
  }, [setState]);

  const dismissXpPill = useCallback(() => setXpPill(null), []);

  return {
    state,
    isLoaded,
    trackEvent,
    xpPill,
    dismissXpPill,
  };
};
