import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useSwipe, SwipeRecord } from '../useSwipe';
import { CareerROI } from '../../types';

let mockStorage: SwipeRecord[] = [];
const mockSetStorage = jest.fn((value: SwipeRecord[] | ((prev: SwipeRecord[]) => SwipeRecord[])) => {
  if (typeof value === 'function') {
    const result = value(mockStorage);
    mockStorage = [...result];
  } else {
    mockStorage = [...value];
  }
});

jest.mock('../useLocalStorage', () => ({
  useLocalStorage: () => {
    return [mockStorage, mockSetStorage, () => { mockStorage = []; }];
  },
}));

const mockCareer: CareerROI = {
  id: 1,
  occupation_code: '15-1234',
  occupation_name: 'Software Developer',
  area_code: '99',
  area_name: 'National',
  annual_median_salary: '95000',
  education_cost: '40000',
  years_to_breakeven: 3,
  roi_percentage: '137',
  job_zone: 4,
  education_level: "Bachelor's",
  skills: ['programming'],
  cost_of_living_index: '100',
  adjusted_salary: '95000',
  industry_code: '54',
  industry_name: 'Professional Services',
  demand_rank: 1,
  avg_annual_openings: 50000,
  projected_growth_percent: 15,
};

describe('useSwipe', () => {
  beforeEach(() => {
    mockStorage = [];
    mockSetStorage.mockClear();
  });

  it('should return initial cards and index', () => {
    const { result } = renderHook(() => useSwipe([mockCareer]));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0]).toEqual(mockCareer);
    expect(result.current.currentIndex).toBe(0);
  });

  it('should return career on swipeLeft', () => {
    const { result } = renderHook(() => useSwipe([mockCareer]));
    
    let returned: CareerROI | null = null;
    act(() => {
      returned = result.current.swipeLeft();
    });
    
    expect(returned).toEqual(mockCareer);
  });

  it('should return career on swipeRight', () => {
    const { result } = renderHook(() => useSwipe([mockCareer]));
    
    let returned: CareerROI | null = null;
    act(() => {
      returned = result.current.swipeRight();
    });
    
    expect(returned).toEqual(mockCareer);
  });

  it('should call setSwipeHistory on swipeLeft', () => {
    const { result } = renderHook(() => useSwipe([mockCareer]));
    
    act(() => {
      result.current.swipeLeft();
    });
    
    expect(mockSetStorage).toHaveBeenCalled();
  });

  it('should call setSwipeHistory on swipeRight', () => {
    const { result } = renderHook(() => useSwipe([mockCareer]));
    
    act(() => {
      result.current.swipeRight();
    });
    
    expect(mockSetStorage).toHaveBeenCalled();
  });

  it('should call setSwipeHistory on undo', () => {
    mockStorage = [{ career: mockCareer, direction: 'left' as const, timestamp: Date.now() }];
    const { result } = renderHook(() => useSwipe([mockCareer]));
    
    act(() => {
      result.current.undo();
    });
    
    expect(mockSetStorage).toHaveBeenCalled();
  });

  it('should not cause infinite re-render loop (regression test)', () => {
    const { result } = renderHook(() => useSwipe([mockCareer, mockCareer, mockCareer]));
    
    expect(() => {
      act(() => {
        result.current.swipeLeft();
        result.current.swipeRight();
        result.current.undo();
      });
    }).not.toThrow();
    
    expect(mockSetStorage).toHaveBeenCalled();
  });

  it('should return null when no cards available', () => {
    const { result } = renderHook(() => useSwipe([]));
    
    let returned: CareerROI | null = 'initial';
    act(() => {
      returned = result.current.swipeLeft();
    });
    
    expect(returned).toBeNull();
  });
});
