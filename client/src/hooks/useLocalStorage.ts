import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type SetValue<T> = T | ((prevValue: T) => T);

const isAsyncStorageAvailable = (): boolean => {
  if (Platform.OS === 'web') return typeof window !== 'undefined' && !!window.localStorage;
  return !!AsyncStorage && !!AsyncStorage.getItem;
};

export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: SetValue<T>) => void, () => void] => {
  const isMounted = useRef(true);

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

  useEffect(() => {
    isMounted.current = true;
    readValue().then((value) => {
      if (isMounted.current) {
        setStoredValue(value);
        setIsLoaded(true);
      }
    });
    return () => { isMounted.current = false; };
  }, [readValue]);

  const setValue = useCallback(
    async (value: SetValue<T>) => {
      if (Platform.OS === 'web') {
        try {
          const valueToStore = value instanceof Function ? value(storedValue) : value;
          setStoredValue(valueToStore);
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch {
          // Silently ignore storage errors
        }
        return;
      }
      if (!isAsyncStorageAvailable()) {
        return;
      }
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
      } catch {
        // Silently ignore storage errors - falls back to initial value
      }
    },
    [key, storedValue],
  );

  const removeValue = useCallback(async () => {
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

  return [isLoaded ? storedValue : initialValue, setValue, removeValue];
};
