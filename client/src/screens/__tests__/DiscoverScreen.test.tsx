import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { DiscoverScreen } from '../DiscoverScreen';
import { apiClient } from '../../api/client';
import { rankCareers } from '../../api/jevRank';
import { CareerROI } from '../../types';
import { InterestLevel } from '../../components/FeedbackModal';

let mockSwipedCareer: CareerROI | null = null;

interface CapturedFeedbackModalProps {
  visible: boolean;
  careerName: string;
  onSubmit: (interest: InterestLevel, notes?: string) => void;
  onClose: () => void;
}

interface CapturedSwipeControlsProps {
  onSkip: () => void;
  onLike: () => void;
  onUndo?: () => void;
  disabled?: boolean;
}

let mockFeedbackModalProps: CapturedFeedbackModalProps | null = null;
let mockSwipeControlsProps: CapturedSwipeControlsProps | null = null;

jest.mock('../../hooks/useSwipe', () => {
  // Stable identities: inline jest.fn()s would change every render and
  // retrigger DiscoverScreen's fetch effect in an infinite loop.
  const swipeLeft = jest.fn(() => mockSwipedCareer);
  const swipeRight = jest.fn(() => mockSwipedCareer);
  const undo = jest.fn();
  const resetSwipes = jest.fn();
  return {
    useSwipe: () => ({
      cards: [],
      swipeLeft,
      swipeRight,
      undo,
      currentIndex: 0,
      resetSwipes,
    }),
  };
});

jest.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { stateCode: '99', salaryMin: 0, salaryMax: 1000000, sortBy: 'roi' },
    setStateCode: jest.fn(),
    setSalaryMin: jest.fn(),
    setSalaryMax: jest.fn(),
    setSortBy: jest.fn(),
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
  FeedbackModal: (props: CapturedFeedbackModalProps) => {
    mockFeedbackModalProps = props;
    return null;
  },
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
  SwipeControls: (props: CapturedSwipeControlsProps) => {
    mockSwipeControlsProps = props;
    return null;
  },
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
    getCareers: jest.fn(() => Promise.resolve({ records: [] })),
    getSwipeHistory: jest.fn(() => Promise.resolve({ swipes: [] })),
    submitSwipe: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../api/jevRank', () => ({
  rankCareers: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

const submitSwipeMock = apiClient.submitSwipe as jest.Mock;
const getCareersMock = apiClient.getCareers as jest.Mock;
const getSwipeHistoryMock = apiClient.getSwipeHistory as jest.Mock;
const rankCareersMock = rankCareers as jest.Mock;

const career = { id: 42, occupation_name: 'Software Developers' } as CareerROI;

const rankedRecords = [
  { id: 1, occupation_code: '15-1252.00', occupation_name: 'Software Developers' },
  { id: 2, occupation_code: '29-1141.00', occupation_name: 'Registered Nurses' },
] as CareerROI[];

const jevResults = [
  { occupation_code: '29-1141.00', p_like: 0.9, fit_score: 1.8, driver: 'culture', confidence: 0.9, provider: 'jev' },
  { occupation_code: '15-1252.00', p_like: 0.3, fit_score: 0.4, driver: 'culture', confidence: 0.9, provider: 'jev' },
];

const fallbackResults = jevResults.map(r => ({ ...r, provider: 'fallback' as const }));

describe('DiscoverScreen', () => {
  beforeEach(() => {
    mockSwipedCareer = null;
    mockFeedbackModalProps = null;
    mockSwipeControlsProps = null;
    submitSwipeMock.mockClear();
    getCareersMock.mockReset();
    getCareersMock.mockResolvedValue({ records: [] });
    getSwipeHistoryMock.mockReset();
    getSwipeHistoryMock.mockResolvedValue({ swipes: [] });
    rankCareersMock.mockReset();
    rankCareersMock.mockResolvedValue(null);
  });

  it('should render DiscoverScreen without errors', async () => {
    await render(<DiscoverScreen />);
  });

  it('shows feedback modal after a right swipe and submits the swipe with feedback', async () => {
    mockSwipedCareer = career;
    await render(<DiscoverScreen />);
    await waitFor(() => expect(mockSwipeControlsProps).not.toBeNull());

    await act(async () => {
      mockSwipeControlsProps?.onLike();
    });

    // Modal opens for the swiped career; POST is held until the modal resolves
    await waitFor(() => expect(mockFeedbackModalProps?.visible).toBe(true));
    expect(mockFeedbackModalProps?.careerName).toBe('Software Developers');
    expect(submitSwipeMock).not.toHaveBeenCalled();

    await act(async () => {
      mockFeedbackModalProps?.onSubmit('very_interested');
    });

    expect(submitSwipeMock).toHaveBeenCalledWith(42, 'right', 'very_interested');
    await waitFor(() => expect(mockFeedbackModalProps?.visible).toBe(false));
  });

  it('appends trimmed notes to the feedback string', async () => {
    mockSwipedCareer = career;
    await render(<DiscoverScreen />);
    await waitFor(() => expect(mockSwipeControlsProps).not.toBeNull());

    await act(async () => {
      mockSwipeControlsProps?.onLike();
    });
    await waitFor(() => expect(mockFeedbackModalProps?.visible).toBe(true));

    await act(async () => {
      mockFeedbackModalProps?.onSubmit('very_interested', '  great pay  ');
    });

    expect(submitSwipeMock).toHaveBeenCalledWith(42, 'right', 'very_interested: great pay');
  });

  it('submits the right swipe without feedback when the modal is dismissed', async () => {
    mockSwipedCareer = career;
    await render(<DiscoverScreen />);
    await waitFor(() => expect(mockSwipeControlsProps).not.toBeNull());

    await act(async () => {
      mockSwipeControlsProps?.onLike();
    });
    await waitFor(() => expect(mockFeedbackModalProps?.visible).toBe(true));

    await act(async () => {
      mockFeedbackModalProps?.onClose();
    });

    expect(submitSwipeMock).toHaveBeenCalledWith(42, 'right', undefined);
    await waitFor(() => expect(mockFeedbackModalProps?.visible).toBe(false));
  });

  it('submits left swipes immediately without showing the feedback modal', async () => {
    mockSwipedCareer = career;
    await render(<DiscoverScreen />);
    await waitFor(() => expect(mockSwipeControlsProps).not.toBeNull());

    await act(async () => {
      mockSwipeControlsProps?.onSkip();
    });

    await waitFor(() => expect(submitSwipeMock).toHaveBeenCalledWith(42, 'left', undefined));
    expect(mockFeedbackModalProps?.visible).toBe(false);
  });

  it('ranks silently with no Jev badge for fully Jev-ranked results', async () => {
    getCareersMock.mockResolvedValue({ records: rankedRecords });
    getSwipeHistoryMock.mockResolvedValue({ swipes: [{ career_id: 1 }, { career_id: 2 }] });
    rankCareersMock.mockResolvedValue({ results: jevResults, provider: 'jev' });

    const { queryByText } = await render(<DiscoverScreen />);
    await waitFor(() => expect(rankCareersMock).toHaveBeenCalled());
    await act(async () => {});
    expect(queryByText(/Jev-ranked/)).toBeNull();
  });

  it('keeps server order with no badge for fallback results', async () => {
    getCareersMock.mockResolvedValue({ records: rankedRecords });
    getSwipeHistoryMock.mockResolvedValue({ swipes: [{ career_id: 1 }] });
    rankCareersMock.mockResolvedValue({ results: fallbackResults, provider: 'fallback' });

    const { queryByText } = await render(<DiscoverScreen />);
    await waitFor(() => expect(getCareersMock).toHaveBeenCalled());
    // Let the rank promise settle, then assert no badge was set.
    await waitFor(() => expect(rankCareersMock).toHaveBeenCalled());
    await act(async () => {});
    expect(queryByText(/Jev-ranked/)).toBeNull();
  });

  it('appends unranked pages with no badge', async () => {
    getCareersMock.mockResolvedValue({ records: rankedRecords, pagy: { pages: 2 } });
    getSwipeHistoryMock.mockResolvedValue({ swipes: [{ career_id: 1 }] });
    rankCareersMock.mockResolvedValue({ results: jevResults, provider: 'jev' });

    mockSwipedCareer = career;
    const { queryByText } = await render(<DiscoverScreen />);
    await waitFor(() => expect(rankCareersMock).toHaveBeenCalled());
    await act(async () => {});

    // Swiping near the end loads the next (unranked) page, still with no badge.
    await act(async () => {
      mockSwipeControlsProps?.onLike();
    });
    await waitFor(() => expect(getCareersMock).toHaveBeenCalledTimes(2));
    expect(queryByText(/Jev-ranked/)).toBeNull();
  });
});
