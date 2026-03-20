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
      setFilters({ ...filters, location });
    },
    [setFilters, filters],
  );

  const setSalaryMin = useCallback(
    (salary: number) => {
      setFilters({ ...filters, salaryMin: salary });
    },
    [setFilters, filters],
  );

  const setSalaryMax = useCallback(
    (salary: number) => {
      setFilters({ ...filters, salaryMax: salary });
    },
    [setFilters, filters],
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
