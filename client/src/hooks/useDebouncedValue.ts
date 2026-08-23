import { useEffect, useState } from 'react';

export const useDebouncedValue = <T>(value: T, delayMs: number = 250): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
