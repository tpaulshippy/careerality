import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SwipeCard } from '../SwipeCard';
import { CareerROI } from '../../types';

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Tap: () => ({ onEnd: jest.fn().mockReturnThis() }),
    Pan: () => ({
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
    }),
    Race: () => ({}),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useSharedValue: (init: unknown) => ({ value: init }),
  useAnimatedStyle: () => ({}),
  runOnJS: (fn: (...args: unknown[]) => void) => fn,
  withSpring: (val: unknown) => val,
}));

jest.mock('../OccupationIconBadge', () => ({
  OccupationIconBadge: () => null,
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#F2F2F2',
      text: { primary: '#000000', secondary: '#666666', muted: '#999999' },
      error: '#FF0000',
      success: '#00CC00',
    },
    shadows: { card: {}, subtle: {} },
  }),
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
  demand_score: null,
  avg_annual_openings: 50000,
  projected_growth_percent: 15,
};

describe('SwipeCard', () => {
  it('shows a loading spinner over the image until the image loads', async () => {
    const { getByTestId, queryByTestId } = await render(<SwipeCard career={mockCareer} />);

    expect(getByTestId('swipe-card-image-loading')).toBeTruthy();

    await fireEvent(getByTestId('swipe-card-image'), 'load');

    expect(queryByTestId('swipe-card-image-loading')).toBeNull();
  });

  it('shows the spinner again when the career changes after a swipe', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(<SwipeCard career={mockCareer} />);

    await fireEvent(getByTestId('swipe-card-image'), 'load');
    expect(queryByTestId('swipe-card-image-loading')).toBeNull();

    const nextCareer = { ...mockCareer, id: 2, occupation_code: '29-1141' };
    await rerender(<SwipeCard career={nextCareer} />);

    expect(getByTestId('swipe-card-image-loading')).toBeTruthy();
  });
});
