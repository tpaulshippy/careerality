import React from 'react';
import { render, act } from '@testing-library/react-native';
import { SwipeScreen } from '../SwipeScreen';

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
      error: '#FF0000',
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
  Loading: ({ message: _message }) => null,
  ErrorView: () => null,
}));

jest.mock('../../constants/dataSources', () => ({
  API_URL: 'http://localhost:3000/api/roi',
  API_BASE: 'http://localhost:3000',
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

describe('SwipeScreen', () => {
  it('should render SwipeScreen without errors', () => {
    act(() => {
      render(<SwipeScreen />);
    });
  });
});