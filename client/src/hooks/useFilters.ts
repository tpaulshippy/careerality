import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface Filters {
  stateCode: string;
  salaryMin: number;
  salaryMax: number;
}

const DEFAULT_FILTERS: Filters = {
  stateCode: '99',
  salaryMin: 0,
  salaryMax: 1000000,
};

interface UseFiltersResult {
  filters: Filters;
  setStateCode: (stateCode: string) => void;
  setSalaryMin: (salary: number) => void;
  setSalaryMax: (salary: number) => void;
  resetFilters: () => void;
}

export const useFilters = (): UseFiltersResult => {
  const [filters, setFilters] = useLocalStorage<Filters>('careerality_filters', DEFAULT_FILTERS);

  const setStateCode = useCallback(
    (stateCode: string) => {
      setFilters(prev => ({ ...prev, stateCode }));
    },
    [setFilters],
  );

  const setSalaryMin = useCallback(
    (salary: number) => {
      setFilters(prev => ({ ...prev, salaryMin: salary }));
    },
    [setFilters],
  );

  const setSalaryMax = useCallback(
    (salary: number) => {
      setFilters(prev => ({ ...prev, salaryMax: salary }));
    },
    [setFilters],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  return {
    filters,
    setStateCode,
    setSalaryMin,
    setSalaryMax,
    resetFilters,
  };
};
