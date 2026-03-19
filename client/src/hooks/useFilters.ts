import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface Filters {
  location: string;
  salaryMin: number;
  salaryMax: number;
}

const DEFAULT_FILTERS: Filters = {
  location: '',
  salaryMin: 0,
  salaryMax: 1000000,
};

interface UseFiltersResult {
  filters: Filters;
  setLocation: (location: string) => void;
  setSalaryMin: (salary: number) => void;
  setSalaryMax: (salary: number) => void;
  resetFilters: () => void;
}

export const useFilters = (): UseFiltersResult => {
  const [filters, setFilters] = useLocalStorage<Filters>('careerality_filters', DEFAULT_FILTERS);

  const setLocation = useCallback(
    (location: string) => {
      setFilters((prev) => ({ ...prev, location }));
    },
    [setFilters],
  );

  const setSalaryMin = useCallback(
    (salary: number) => {
      setFilters((prev) => ({ ...prev, salaryMin: salary }));
    },
    [setFilters],
  );

  const setSalaryMax = useCallback(
    (salary: number) => {
      setFilters((prev) => ({ ...prev, salaryMax: salary }));
    },
    [setFilters],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  return {
    filters,
    setLocation,
    setSalaryMin,
    setSalaryMax,
    resetFilters,
  };
};
