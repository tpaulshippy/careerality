import React from 'react';
import { render, act } from '@testing-library/react-native';
import { DiscoverScreen } from '../DiscoverScreen';

jest.mock('../../hooks/useSwipe', () => ({
  useSwipe: () => ({
    cards: [],
    swipeLeft: jest.fn(),
    swipeRight: jest.fn(),
    undo: jest.fn(),
    currentIndex: 0,
    resetSwipes: jest.fn(),
  }),
}));

jest.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { stateCode: '99', salaryMin: 0, salaryMax: 1000000 },
    setStateCode: jest.fn(),
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
      text: { primary: '#000000', secondary: '#666666', muted: '#999999' },
      error: '#FF0000',
      success: '#00CC00',
    },
    shadows: {
      card: {},
      subtle: {},
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

jest.mock('../../components/CareerDetailView', () => ({
  CareerDetailView: () => null,
}));

jest.mock('../../components/FilterChip', () => ({
  FilterChip: () => null,
}));

jest.mock('../../components', () => ({
  Loading: () => null,
  ErrorView: () => null,
  FilterChip: () => null,
  SwipeCard: () => null,
  SwipeControls: () => null,
  FilterSheet: () => null,
  FeedbackModal: () => null,
  CareerDetailView: () => null,
}));

jest.mock('../../constants/dataSources', () => ({
  API_URL: 'http://localhost:3000/api/roi',
  API_BASE: 'http://localhost:3000',
  LOCATION_OPTIONS: [
    { label: 'All Locations', value: 'all' },
    { label: 'Northeast', value: 'northeast' },
  ],
  SALARY_RANGES: [
    { label: 'Any Salary', min: 0, max: Infinity },
    { label: '$50,000+', min: 50000, max: Infinity },
  ],
}));

jest.mock('../../api/client', () => ({
  apiClient: {
    getCareers: () => Promise.resolve({ records: [] }),
    submitSwipe: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
  }),
}));

describe('DiscoverScreen', () => {
  it('should render DiscoverScreen without errors', () => {
    act(() => {
      render(<DiscoverScreen />);
    });
  });
});
