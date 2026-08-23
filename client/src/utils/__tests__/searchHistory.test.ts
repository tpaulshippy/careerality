import {
  SEARCH_HISTORY_KEY,
  MAX_RECENT_SEARCHES,
  addRecentSearch,
  removeRecentSearch,
  parseHistory,
  loadSearchHistory,
  saveSearchHistory,
  clearSearchHistory,
  HistoryStorage,
} from '../searchHistory';

const createMockStorage = (initial: Record<string, string> = {}): HistoryStorage & { store: Map<string, string> } => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  };
};

describe('searchHistory', () => {
  describe('addRecentSearch', () => {
    it('prepends the newest query', () => {
      expect(addRecentSearch(['nurse', 'pilot'], 'chef')).toEqual(['chef', 'nurse', 'pilot']);
    });

    it('dedupes case-insensitively, keeping the newest position and casing', () => {
      expect(addRecentSearch(['Nurse', 'pilot'], 'nurse')).toEqual(['nurse', 'pilot']);
      expect(addRecentSearch(['nurse', 'pilot'], ' NURSE ')).toEqual(['NURSE', 'pilot']);
    });

    it('caps the list length', () => {
      let history: string[] = [];
      for (let i = 0; i < MAX_RECENT_SEARCHES + 3; i += 1) {
        history = addRecentSearch(history, `query-${i}`);
      }
      expect(history).toHaveLength(MAX_RECENT_SEARCHES);
      expect(history[0]).toBe(`query-${MAX_RECENT_SEARCHES + 2}`);
      expect(history).not.toContain('query-0');
    });

    it('ignores blank queries', () => {
      expect(addRecentSearch(['nurse'], '   ')).toEqual(['nurse']);
    });

    it('collapses extra whitespace', () => {
      expect(addRecentSearch([], '  software   engineer  ')).toEqual(['software engineer']);
    });
  });

  describe('removeRecentSearch', () => {
    it('removes a matching entry case-insensitively', () => {
      expect(removeRecentSearch(['Nurse', 'pilot'], 'nurse')).toEqual(['pilot']);
    });

    it('leaves the list untouched when there is no match', () => {
      expect(removeRecentSearch(['nurse'], 'chef')).toEqual(['nurse']);
    });
  });

  describe('parseHistory', () => {
    it('returns an empty list for null or empty raw values', () => {
      expect(parseHistory(null)).toEqual([]);
      expect(parseHistory('')).toEqual([]);
    });

    it('parses stored JSON arrays', () => {
      expect(parseHistory(JSON.stringify(['nurse', 'chef']))).toEqual(['nurse', 'chef']);
    });

    it('filters out non-string entries', () => {
      expect(parseHistory(JSON.stringify(['nurse', 42, null, '']))).toEqual(['nurse']);
    });

    it('returns an empty list for malformed JSON', () => {
      expect(parseHistory('{oops')).toEqual([]);
    });
  });

  describe('load/save/clear with mocked storage', () => {
    it('round-trips history through storage', async () => {
      const storage = createMockStorage();
      await saveSearchHistory(['nurse', 'chef'], storage);
      await expect(loadSearchHistory(storage)).resolves.toEqual(['nurse', 'chef']);
      expect(storage.setItem).toHaveBeenCalledWith(SEARCH_HISTORY_KEY, JSON.stringify(['nurse', 'chef']));
    });

    it('caps what it saves', async () => {
      const storage = createMockStorage();
      await saveSearchHistory(Array.from({ length: 12 }, (_, i) => `q${i}`), storage);
      const saved = JSON.parse(storage.store.get(SEARCH_HISTORY_KEY)!);
      expect(saved).toHaveLength(MAX_RECENT_SEARCHES);
    });

    it('loads an empty list when nothing is stored', async () => {
      const storage = createMockStorage();
      await expect(loadSearchHistory(storage)).resolves.toEqual([]);
    });

    it('clears stored history', async () => {
      const storage = createMockStorage({ [SEARCH_HISTORY_KEY]: JSON.stringify(['nurse']) });
      await clearSearchHistory(storage);
      await expect(loadSearchHistory(storage)).resolves.toEqual([]);
    });

    it('tolerates unavailable storage', async () => {
      await expect(loadSearchHistory(null)).resolves.toEqual([]);
      await expect(saveSearchHistory(['nurse'], null)).resolves.toBeUndefined();
    });
  });
});
