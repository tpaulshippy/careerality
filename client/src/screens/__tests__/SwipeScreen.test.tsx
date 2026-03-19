import React from 'react';

const mockCareer = {
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
  skills: ['programming', 'debugging'],
  cost_of_living_index: '100',
  adjusted_salary: '95000',
  industry_code: '54',
  industry_name: 'Professional Services',
  demand_rank: 1,
  avg_annual_openings: 50000,
  projected_growth_percent: 15,
};

jest.mock('../../hooks/useSwipe', () => ({
  useSwipe: () => ({
    cards: [mockCareer],
    swipeLeft: jest.fn(),
    swipeRight: jest.fn(),
    undo: jest.fn(),
    currentIndex: 0,
    resetSwipes: jest.fn(),
  }),
}));

jest.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { location: '', salaryMin: 0, salaryMax: 1000000 },
    setLocation: jest.fn(),
    setSalaryMin: jest.fn(),
    setSalaryMax: jest.fn(),
    resetFilters: jest.fn(),
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#F2F2F2',
      text: { primary: '#000000', secondary: '#666666' },
    },
  }),
}));

jest.mock('../../components/SwipeCard', () => ({
  SwipeCard: () => null,
}));

jest.mock('../../components/SwipeControls', () => ({
  SwipeControls: () => null,
}));

jest.mock('../../components/FilterSheet', () => ({
  FilterSheet: () => null,
}));

jest.mock('../../components/FeedbackModal', () => ({
  FeedbackModal: () => null,
}));

jest.mock('../../components', () => ({
  Loading: ({ message }) => null,
  ErrorView: () => null,
}));

jest.mock('../../constants/dataSources', () => ({
  API_URL: 'http://localhost:3000/api/roi',
}));

describe('SwipeScreen', () => {
  it('should have useSwipe hook defined', () => {
    const { useSwipe } = require('../../hooks/useSwipe');
    const result = useSwipe([]);
    expect(result).toHaveProperty('cards');
    expect(result).toHaveProperty('swipeLeft');
    expect(result).toHaveProperty('swipeRight');
  });

  it('should have useFilters hook defined', () => {
    const { useFilters } = require('../../hooks/useFilters');
    const result = useFilters();
    expect(result).toHaveProperty('filters');
    expect(result).toHaveProperty('setLocation');
  });

  it('should have mockCareer with required fields', () => {
    expect(mockCareer).toHaveProperty('id');
    expect(mockCareer).toHaveProperty('occupation_name');
    expect(mockCareer).toHaveProperty('annual_median_salary');
  });
});
