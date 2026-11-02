import React from 'react';
import { render } from '@testing-library/react-native';
import { LikedScreen } from '../LikedScreen';
import { apiClient } from '../../api/client';
import { CareerROI } from '../../types';
import { CatalogBundle, loadCatalog } from '../../data/catalog';

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
  apiClient: {
    getLikedCareers: jest.fn(),
    // Swipe metadata always comes from the server; records hydrate locally.
    getSwipeHistory: jest.fn().mockResolvedValue({ swipes: [] }),
    removeSwipe: jest.fn(),
  },
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

// Small deterministic bundle so liked records hydrate locally by career_id
// without depending on the 37k-row shipped bundle.
// rows: [occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone,
//        eduLevel, indIdx, demandRank, demandScore, openings, growth,
//        colIndex, adjSalary]
const fixture: CatalogBundle = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  source: 'test',
  counts: { areas: 1, industries: 1, occupations: 2, rows: 2 },
  areas: [{ c: '99', n: 'National' }],
  occupations: [
    { c: '29-1141.00', n: 'Registered Nurses' },
    { c: '15-1252.00', n: 'Software Developers' },
  ],
  industries: [{ c: '62', n: 'Healthcare' }],
  rows: [
    [0, 0, 1, 86070, 40000, 2, 150, 4, "Bachelor's degree", 0, null, null, null, null, 1.0, 86070],
    [1, 0, 2, 120000, 80000, 4, 200, 4, "Bachelor's degree", 0, null, null, null, null, 1.0, 120000],
  ],
  map: {},
};

const emptyBundle: CatalogBundle = {
  version: 1,
  generated_at: null,
  source: 'test',
  counts: { areas: 0, industries: 0, occupations: 0, rows: 0 },
  areas: [],
  occupations: [],
  industries: [],
  rows: [],
  map: {},
};

const swipe = (id: number, career_id: number) => ({
  id,
  career_id,
  direction: 'right' as const,
  created_at: new Date().toISOString(),
});

describe('LikedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCatalog(fixture);
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({ swipes: [] });
  });

  it('gives each plan button an accessible role and career-specific label when plans are enabled', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(7, 1), swipe(8, 2)],
    });
    const screen = await render(<LikedScreen plansEnabled />);
    await screen.findByText('Registered Nurses');

    const nursesButton = screen.getByTestId('plan-button-7');
    expect(nursesButton.props.accessibilityRole).toBe('button');
    expect(nursesButton.props.accessibilityLabel).toBe('Open action plan for Registered Nurses');

    const devsButton = screen.getByTestId('plan-button-8');
    expect(devsButton.props.accessibilityLabel).toBe('Open action plan for Software Developers');
    // Local-first: records hydrate from the bundle, no list-endpoint calls.
    expect(apiClient.getLikedCareers).not.toHaveBeenCalled();
  });

  it('hides plan buttons when plans are disabled', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(7, 1)],
    });
    const screen = await render(<LikedScreen />);
    await screen.findByText('Registered Nurses');

    expect(screen.queryByTestId('plan-button-7')).toBeNull();
    expect(screen.getByText('✕')).toBeTruthy();
    expect(apiClient.getLikedCareers).not.toHaveBeenCalled();
  });

  it('falls back to the server list when the catalog is empty', async () => {
    loadCatalog(emptyBundle);
    (apiClient.getLikedCareers as jest.Mock).mockResolvedValue({
      records: [
        { ...makeCareer({ id: 1 }), swipe_id: 7 },
        {
          ...makeCareer({ id: 2, occupation_code: '15-1252.00', occupation_name: 'Software Developers' }),
          swipe_id: 8,
        },
      ],
    });
    const screen = await render(<LikedScreen plansEnabled />);
    await screen.findByText('Registered Nurses');

    expect(apiClient.getLikedCareers).toHaveBeenCalled();
    // Empty placeholder: no wasted swipe-history round trip in front.
    expect(apiClient.getSwipeHistory).not.toHaveBeenCalled();
    expect(screen.getByTestId('plan-button-8').props.accessibilityLabel).toBe(
      'Open action plan for Software Developers'
    );
  });

  it('falls back to the server list when a like is outside the feed-only bundle', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(9, 999)],
    });
    (apiClient.getLikedCareers as jest.Mock).mockResolvedValue({
      records: [{ ...makeCareer({ id: 999, occupation_name: 'Metro-Only Career' }), swipe_id: 9 }],
    });
    const screen = await render(<LikedScreen plansEnabled />);
    await screen.findByText('Metro-Only Career');

    expect(apiClient.getLikedCareers).toHaveBeenCalled();
  });
});
