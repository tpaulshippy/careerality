import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { InsightsScreen } from '../InsightsScreen';
import { apiClient } from '../../api/client';
import { CareerROI, RoiResponse, SwipeApiRecord } from '../../types';

jest.mock('../../api/client', () => ({
  apiClient: {
    getSwipeHistory: jest.fn(),
    getLikedCareers: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../components', () => ({
  CareerDetailView: () => null,
  OccupationIconBadge: () => null,
}));

const getSwipeHistory = apiClient.getSwipeHistory as jest.Mock;
const getLikedCareers = apiClient.getLikedCareers as jest.Mock;
const get = apiClient.get as jest.Mock;

const swipe = (overrides: Partial<SwipeApiRecord> = {}): SwipeApiRecord => ({
  id: 1,
  career_id: 100,
  direction: 'right',
  feedback: 'very_interested',
  created_at: new Date().toISOString(),
  ...overrides,
});

const likedCareer = (overrides: Partial<CareerROI> = {}): CareerROI => ({
  id: 1,
  occupation_code: '29-1141',
  occupation_name: 'Registered Nurses',
  area_code: '99',
  area_name: 'National',
  annual_median_salary: '80000',
  education_cost: '40000',
  years_to_breakeven: 2,
  roi_percentage: '150',
  job_zone: 3,
  education_level: "Bachelor's degree",
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '80000',
  industry_code: '62',
  industry_name: 'Healthcare',
  demand_rank: null,
  demand_score: null,
  avg_annual_openings: null,
  projected_growth_percent: null,
  swipe_id: 1,
  swiped_at: new Date().toISOString(),
  ...overrides,
} as CareerROI);

const roiPage = (ids: number[]): RoiResponse => ({
  records: ids.map((id) =>
    likedCareer({ id, roi_percentage: String(50 + id), annual_median_salary: String(40000 + id) })
  ),
  pagy: { page: 1, items: 20, count: ids.length, pages: 1 },
});

describe('InsightsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue(roiPage([1, 2, 3]));
  });

  it('shows the empty state with a CTA when there is no swipe history', async () => {
    getSwipeHistory.mockResolvedValue({ swipes: [] });
    getLikedCareers.mockResolvedValue({ records: [] });

    const { getByText } = await render(<InsightsScreen />);

    await waitFor(() => expect(getByText('No insights yet')).toBeTruthy());
    expect(getByText('Start Exploring')).toBeTruthy();
  });

  it('renders activity stats and feedback bars from history', async () => {
    getSwipeHistory.mockResolvedValue({
      swipes: [
        swipe({ id: 1, direction: 'right', feedback: 'very_interested' }),
        swipe({ id: 2, direction: 'right', feedback: 'mild_interest' }),
        swipe({ id: 3, direction: 'left' }),
      ],
    });
    getLikedCareers.mockResolvedValue({
      records: [likedCareer(), likedCareer({ id: 2, occupation_code: '15-1252' })],
    });

    const { getByText } = await render(<InsightsScreen />);

    await waitFor(() => expect(getByText('What you value')).toBeTruthy());
    expect(getByText('Very interested')).toBeTruthy();
    expect(getByText('Your taste profile')).toBeTruthy();
    expect(getByText('Healthcare')).toBeTruthy();
    expect(getByText('Standout picks')).toBeTruthy();
    expect(getByText('Highest ROI')).toBeTruthy();
  });

  it('shows the feedback hint when no right swipes carry feedback', async () => {
    getSwipeHistory.mockResolvedValue({
      swipes: [
        swipe({ id: 1, direction: 'right', feedback: undefined }),
        swipe({ id: 2, direction: 'left' }),
      ],
    });
    getLikedCareers.mockResolvedValue({ records: [] });

    const { queryByText, getByText } = await render(<InsightsScreen />);

    await waitFor(() => expect(getByText('Want deeper insights?')).toBeTruthy());
    expect(queryByText('What you value')).toBeNull();
  });

  it('shows an error state when the API fails', async () => {
    getSwipeHistory.mockRejectedValue(new Error('boom'));

    const { findByText } = await render(<InsightsScreen />);
    expect(await findByText('Failed to load your insights')).toBeTruthy();
  });
});
