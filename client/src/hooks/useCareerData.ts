import { useState, useEffect, useCallback } from 'react';
import { CareerROI } from '../types';
import { API_URL } from '../constants/dataSources';

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
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const json = await response.json();
      const data: CareerROI[] = json.records || json;
      if (data.length > 0) {
        const sortedByROI = [...data].sort((a, b) => 
          parseFloat(b.roi_percentage) - parseFloat(a.roi_percentage)
        );
        const top10 = sortedByROI.slice(0, 10);
        const randomIndex = Math.floor(Math.random() * top10.length);
        setCareer(top10[randomIndex]);
      } else {
        setError('No careers found');
      }
    } catch (err) {
      setError('Failed to load career data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopCareer();
  }, [fetchTopCareer]);

  return { career, loading, error, refetch: fetchTopCareer };
};
