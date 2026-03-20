import { useState, useEffect, useCallback } from 'react';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';

interface UseCareerDataResult {
  career: CareerROI | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCareerData = (): UseCareerDataResult => {
  const [career, setCareer] = useState<CareerROI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopCareer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiClient.getCareers({ sort: 'demand' }) as { records: CareerROI[] } | CareerROI[];
      const data: CareerROI[] = Array.isArray(json) ? json : (json.records || []);
      if (data.length > 0) {
        const top50 = data.slice(0, 50);
        const randomIndex = Math.floor(Math.random() * top50.length);
        setCareer(top50[randomIndex]);
      } else {
        setError('No careers found');
      }
    } catch {
      setError('Failed to load career data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopCareer();
  }, [fetchTopCareer]);

  return { career, loading, error, refetch: fetchTopCareer };
};
