import React from 'react';
import { render } from '@testing-library/react-native';
import { LikedScreen } from '../LikedScreen';
import { apiClient } from '../../api/client';
import { CareerROI } from '../../types';

jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      const stable = React.useRef(cb);
      React.useEffect(() => {
        stable.current();
      }, []);
    },
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('../../api/client', () => ({
  apiClient: { getLikedCareers: jest.fn(), removeSwipe: jest.fn() },
}));

jest.mock('../../components', () => ({
  CareerDetailView: () => null,
  OccupationIconBadge: () => null,
}));

const makeCareer = (overrides: Partial<CareerROI> = {}): CareerROI =>
  ({
    id: 1,
    occupation_code: '29-1141.00',
    occupation_name: 'Registered Nurses',
    area_code: '99',
    area_name: 'U.S.',
    annual_median_salary: '86070.0',
    education_cost: '40000.0',
    years_to_breakeven: 2,
    roi_percentage: '12.5',
    job_zone: 4,
    education_level: "Bachelor's degree",
    skills: ['Monitoring'],
    cost_of_living_index: '100.0',
    adjusted_salary: '86070.0',
    industry_code: 'cross-industry',
    industry_name: 'cross-industry',
    demand_rank: null,
    avg_annual_openings: null,
    projected_growth_percent: null,
    demand_score: null,
    ...overrides,
  }) as CareerROI;

describe('LikedScreen', () => {
  beforeEach(() => {
    (apiClient.getLikedCareers as jest.Mock).mockReset();
  });

  it('gives each plan button an accessible role and career-specific label', async () => {
    (apiClient.getLikedCareers as jest.Mock).mockResolvedValue({
      records: [
        { ...makeCareer({ id: 1 }), swipe_id: 7 },
        {
          ...makeCareer({ id: 2, occupation_code: '15-1252.00', occupation_name: 'Software Developers' }),
          swipe_id: 8,
        },
      ],
    });
    const screen = await render(<LikedScreen />);
    await screen.findByText('Registered Nurses');

    const nursesButton = screen.getByTestId('plan-button-7');
    expect(nursesButton.props.accessibilityRole).toBe('button');
    expect(nursesButton.props.accessibilityLabel).toBe('Open action plan for Registered Nurses');

    const devsButton = screen.getByTestId('plan-button-8');
    expect(devsButton.props.accessibilityLabel).toBe('Open action plan for Software Developers');
  });
});
