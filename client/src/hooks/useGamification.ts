import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AwardResult,
  award,
  createEmptyGamificationState,
  GamificationState,
  XpEvent,
} from '../utils/gamification';

export const GAMIFICATION_STORAGE_KEY = 'careerality_gamification_v1';

export interface XpPillData {
  id: number;
  amount: number;
}

interface GamificationSnapshot {
  state: GamificationState;
  isLoaded: boolean;
  xpPill: XpPillData | null;
}

/**
 * Module-level store shared by every mounted consumer (Discover, Progress, ...).
 * Drawer routes stay mounted side by side, so independent hook instances would
 * drift apart; a single snapshot + subscriptions keeps them in sync.
 */
let snapshot: GamificationSnapshot = {
  state: createEmptyGamificationState(),
  isLoaded: false,
  xpPill: null,
};

const listeners = new Set<() => void>();
/** Events recorded before hydration finishes; replayed once storage loads. */
let pendingEvents: XpEvent[] = [];
let pillId = 0;
let hydration: Promise<void> | null = null;

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setSnapshot = (patch: Partial<GamificationSnapshot>): void => {
  snapshot = { ...snapshot, ...patch };
  emit();
};

const getSnapshot = (): GamificationSnapshot => snapshot;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  ensureHydrated();
  return () => {
    listeners.delete(listener);
  };
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const readStoredState = async (): Promise<GamificationState> => {
  try {
    const raw =
      Platform.OS === 'web'
        ? window.localStorage.getItem(GAMIFICATION_STORAGE_KEY)
        : await AsyncStorage.getItem(GAMIFICATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GamificationState) : createEmptyGamificationState();
  } catch {
    return createEmptyGamificationState();
  }
};

const persistState = async (state: GamificationState): Promise<void> => {
  const json = JSON.stringify(state);
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(GAMIFICATION_STORAGE_KEY, json);
    } else {
      await AsyncStorage.setItem(GAMIFICATION_STORAGE_KEY, json);
    }
  } catch {
    // Silently ignore storage errors
  }
};

const removeStoredState = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(GAMIFICATION_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(GAMIFICATION_STORAGE_KEY);
    }
  } catch {
    // Silently ignore storage errors
  }
};

// ---------------------------------------------------------------------------
// Store actions
// ---------------------------------------------------------------------------

const trackEvent = (event: XpEvent): AwardResult | null => {
  if (!snapshot.isLoaded) {
    // Hydration still pending; queue so early interactions keep their XP.
    pendingEvents.push(event);
    return null;
  }
  const result = award(snapshot.state, event, new Date());
  let xpPill = snapshot.xpPill;
  if (result.awarded && result.xpGained > 0) {
    pillId += 1;
    xpPill = { id: pillId, amount: result.xpGained };
  }
  setSnapshot({ state: result.state, xpPill });
  persistState(result.state);
  return result;
};

const hydrate = async (): Promise<void> => {
  const stored = await readStoredState();
  setSnapshot({ state: stored, isLoaded: true });
  const queued = pendingEvents;
  pendingEvents = [];
  for (const event of queued) {
    trackEvent(event);
  }
};

const ensureHydrated = (): Promise<void> => {
  if (!hydration) hydration = hydrate();
  return hydration;
};

const dismissXpPill = (): void => {
  if (snapshot.xpPill !== null) setSnapshot({ xpPill: null });
};

/**
 * Wipes persisted gamification data and resets every mounted consumer.
 * Used by "Delete My Data"; queued pre-hydration events are dropped too.
 */
export const resetGamification = async (): Promise<void> => {
  pendingEvents = [];
  pillId = 0;
  await removeStoredState();
  setSnapshot({ state: createEmptyGamificationState(), xpPill: null });
};

/** Test-only: tear down the singleton so the next mount re-hydrates from storage. */
export const __resetGamificationForTests = (): void => {
  pendingEvents = [];
  pillId = 0;
  hydration = null;
  snapshot = { state: createEmptyGamificationState(), isLoaded: false, xpPill: null };
  emit();
};

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
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return {
    state: current.state,
    isLoaded: current.isLoaded,
    trackEvent,
    xpPill: current.xpPill,
    dismissXpPill,
  };
};
