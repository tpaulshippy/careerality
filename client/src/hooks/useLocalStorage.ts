import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type SetValue<T> = T | ((prevValue: T) => T);

// [value, setValue, removeValue, isLoaded]
export type UseLocalStorageResult<T> = [T, (value: SetValue<T>) => void, () => void, boolean];

const isAsyncStorageAvailable = (): boolean => {
  if (Platform.OS === 'web') return typeof window !== 'undefined' && !!window.localStorage;
  return !!AsyncStorage && !!AsyncStorage.getItem;
};

export const useLocalStorage = <T>(key: string, initialValue: T): UseLocalStorageResult<T> => {
  const isMounted = useRef(true);
  // Writes made before the stored value finishes loading are queued here and
  // replayed on top of it, so the async read can never clobber them.
  const pendingWrites = useRef<SetValue<T>[]>([]);
  const isLoadedRef = useRef(false);

  const readValue = useCallback(async (): Promise<T> => {
    if (Platform.OS === 'web') {
      try {
        const item = window.localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : initialValue;
      } catch {
        return initialValue;
      }
    }
    if (!isAsyncStorageAvailable()) {
      return initialValue;
    }
    try {
      const item = await AsyncStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  const writeThrough = useCallback(
    (valueToStore: T) => {
      if (Platform.OS === 'web') {
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch {
          // Silently ignore storage errors
        }
      } else if (isAsyncStorageAvailable()) {
        AsyncStorage.setItem(key, JSON.stringify(valueToStore)).catch(() => {});
      }
    },
    [key],
  );

  useEffect(() => {
    isMounted.current = true;
    readValue().then((value) => {
      if (!isMounted.current) return;
      const queued = pendingWrites.current;
      pendingWrites.current = [];
      if (queued.length > 0) {
        let merged = value;
        for (const write of queued) merged = write instanceof Function ? write(merged) : write;
        setStoredValue(merged);
        writeThrough(merged);
      } else {
        setStoredValue(value);
      }
      isLoadedRef.current = true;
      setIsLoaded(true);
    });
    return () => { isMounted.current = false; };
  }, [readValue, writeThrough]);

  const setValue = useCallback(
    (value: SetValue<T>) => {
      if (!isLoadedRef.current) {
        // Optimistically reflect the change in state, but defer persistence
        // until the initial read resolves so it cannot be rolled back.
        pendingWrites.current.push(value);
        setStoredValue(prev => (value instanceof Function ? value(prev) : value));
        return;
      }
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        writeThrough(valueToStore);
        return valueToStore;
      });
    },
    [writeThrough],
  );

  const removeValue = useCallback(async () => {
    pendingWrites.current = [];
    if (Platform.OS === 'web') {
      try {
        setStoredValue(initialValue);
        window.localStorage.removeItem(key);
      } catch {
        // Silently ignore storage errors - falls back to initial value
      }
      return;
    }
    if (!isAsyncStorageAvailable()) {
      return;
    }
    try {
      setStoredValue(initialValue);
      await AsyncStorage.removeItem(key);
      } catch {
        // Silently ignore storage errors
      }
    }, [initialValue, key]);

  // Fourth element lets callers gate rendering until persisted state has loaded
  // (e.g. first-launch onboarding must not flash over returning users).
  return [storedValue, setValue, removeValue, isLoaded];
};
