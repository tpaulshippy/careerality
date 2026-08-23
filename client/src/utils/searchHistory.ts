import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SEARCH_HISTORY_KEY = '@careerality/recent_searches';
export const MAX_RECENT_SEARCHES = 8;

export interface HistoryStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): unknown;
}

const getDefaultStorage = (): HistoryStorage | null => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  }
  return AsyncStorage;
};

export const sanitizeQuery = (query: string): string => query.trim().replace(/\s+/g, ' ');

/** Prepends a query, dedupes case-insensitively against existing entries, caps at MAX_RECENT_SEARCHES. */
export const addRecentSearch = (history: string[], query: string): string[] => {
  const cleaned = sanitizeQuery(query);
  if (!cleaned) return history;
  const lower = cleaned.toLowerCase();
  return [cleaned, ...history.filter(q => q.toLowerCase() !== lower)].slice(0, MAX_RECENT_SEARCHES);
};

export const removeRecentSearch = (history: string[], query: string): string[] => {
  const target = sanitizeQuery(query).toLowerCase();
  return history.filter(q => q.toLowerCase() !== target);
};

export const parseHistory = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
};

export const loadSearchHistory = async (
  storage: HistoryStorage | null = getDefaultStorage()
): Promise<string[]> => {
  if (!storage) return [];
  try {
    return parseHistory(await storage.getItem(SEARCH_HISTORY_KEY));
  } catch {
    return [];
  }
};

export const saveSearchHistory = async (
  history: string[],
  storage: HistoryStorage | null = getDefaultStorage()
): Promise<void> => {
  if (!storage) return;
  try {
    await storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // Silently ignore storage errors
  }
};

export const clearSearchHistory = async (
  storage: HistoryStorage | null = getDefaultStorage()
): Promise<void> => {
  await saveSearchHistory([], storage);
};
