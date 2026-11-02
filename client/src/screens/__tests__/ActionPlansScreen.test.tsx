import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { ActionPlansScreen } from '../ActionPlansScreen';
import { apiClient } from '../../api/client';
import { CareerROI } from '../../types';
import { CatalogBundle, loadCatalog } from '../../data/catalog';

beforeAll(() => {
  (Platform as { OS: string }).OS = 'web';
});

afterEach(() => {
  (Platform as { OS: string }).OS = 'web';
});

// Extend the shared react-native mock with the Animated pieces this screen uses.
jest.mock('react-native', () => {
  const base = jest.requireActual('../../../__mocks__/react-native.js');
  const animatedValue = () => ({ setValue: jest.fn(), addListener: jest.fn(), removeListener: jest.fn() });
  return {
    ...base,
    Animated: {
      Value: jest.fn(animatedValue),
      spring: jest.fn(() => ({ start: jest.fn() })),
      timing: jest.fn(() => ({ start: jest.fn() })),
      Text: base.Text,
      View: base.View,
    },
  };
});

const makeCareer = (overrides: Partial<CareerROI>): CareerROI =>
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
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('../../api/client', () => ({
  apiClient: {
    getLikedCareers: jest.fn(),
    // Swipe metadata always comes from the server; records hydrate locally.
    getSwipeHistory: jest.fn().mockResolvedValue({ swipes: [] }),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../components', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require('react-native');
  return {
    FilterChip: (props: { label: string; selected?: boolean; onPress?: () => void }) =>
      React.createElement(
        rn.TouchableOpacity,
        { testID: `filter-chip-${props.label}`, onPress: props.onPress },
        React.createElement(rn.Text, null, props.label)
      ),
    CareerDetailView: () => null,
    OccupationIconBadge: () => null,
  };
});

// Small deterministic bundle so plans hydrate locally by career_id without
// depending on the 37k-row shipped bundle. Two rows share one occupation in
// different areas to cover the dedupe test.
// rows: [occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone,
//        eduLevel, indIdx, demandRank, demandScore, openings, growth,
//        colIndex, adjSalary]
const fixture: CatalogBundle = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  source: 'test',
  counts: { areas: 2, industries: 1, occupations: 2, rows: 3 },
  areas: [
    { c: '99', n: 'National' },
    { c: '34', n: 'New Jersey' },
  ],
  occupations: [
    { c: '29-1141.00', n: 'Registered Nurses' },
    { c: '15-1252.00', n: 'Software Developers' },
  ],
  industries: [{ c: '62', n: 'Healthcare' }],
  rows: [
    [0, 0, 1, 86070, 40000, 2, 150, 4, "Bachelor's degree", 0, null, null, null, null, 1.0, 86070],
    [1, 0, 2, 120000, 80000, 4, 200, 4, "Bachelor's degree", 0, null, null, null, null, 1.0, 120000],
    [0, 1, 3, 88000, 42000, 2, 155, 4, "Bachelor's degree", 0, null, null, null, null, 1.1, 80000],
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

describe('ActionPlansScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    loadCatalog(fixture);
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({ swipes: [] });
    (apiClient.getLikedCareers as jest.Mock).mockResolvedValue({ records: [] });
  });

  it('shows an empty state with a Discover CTA when nothing is liked', async () => {
    const screen = await render(<ActionPlansScreen />);
    expect(await screen.findByText('No action plans yet')).toBeTruthy();
    expect(screen.getByText('Browse careers')).toBeTruthy();
    expect(apiClient.getLikedCareers).not.toHaveBeenCalled();
  });

  it('falls back to the server list when the catalog is empty', async () => {
    loadCatalog(emptyBundle);
    (apiClient.getLikedCareers as jest.Mock).mockResolvedValue({
      records: [{ ...makeCareer({ id: 1 }), swipe_id: 1 }],
    });
    const screen = await render(<ActionPlansScreen />);
    expect(await screen.findByText('Registered Nurses')).toBeTruthy();
    expect(apiClient.getLikedCareers).toHaveBeenCalled();
  });

  it('renders one row per liked career with next-step teasers', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1), swipe(2, 2)],
    });
    const screen = await render(<ActionPlansScreen />);
    expect(await screen.findByText('Registered Nurses')).toBeTruthy();
    expect(screen.getByText('Software Developers')).toBeTruthy();
    expect(screen.getAllByText('Try: See the work')).toHaveLength(2);
    expect(apiClient.getLikedCareers).not.toHaveBeenCalled();
  });

  it('copies the outreach message via the native clipboard and confirms', async () => {
    (Platform as { OS: string }).OS = 'ios';
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1)],
    });
    const screen = await render(<ActionPlansScreen />);
    await screen.findByText('Registered Nurses');

    fireEvent.press(screen.getByTestId('plan-row-0'));
    fireEvent.press(await screen.findByTestId('step-copy-5'));

    await waitFor(() =>
      expect(ExpoClipboard.setStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('career as a Registered Nurses')
      )
    );
    expect(await screen.findByText('Copied ✓')).toBeTruthy();
  });

  it('exposes each step checkbox with its checked state to screen readers', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1)],
    });
    const screen = await render(<ActionPlansScreen />);
    await screen.findByText('Registered Nurses');

    fireEvent.press(screen.getByTestId('plan-row-0'));
    const checkbox = await screen.findByTestId('step-checkbox-0');
    expect(checkbox.props.accessibilityRole).toBe('checkbox');
    expect(checkbox.props.accessibilityState).toEqual({ checked: false });

    fireEvent.press(checkbox);
    await waitFor(() =>
      expect(screen.getByTestId('step-checkbox-0').props.accessibilityState).toEqual({ checked: true })
    );
  });

  // NOTE: tests below this point interact with the plan detail view, which
  // leaves the shared act() scope in a state that breaks renders of later
  // test instances (React 19 + RNTL beta). Keep new tests above them.
  it('shows a helpful message when a filter has no matches', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1)],
    });
    const screen = await render(<ActionPlansScreen />);
    await screen.findByText('Registered Nurses');

    fireEvent.press(screen.getByTestId('filter-chip-Done'));
    expect(
      await screen.findByText('Nothing finished yet — every plan starts with a single step.')
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('show-all-chip'));
    expect(await screen.findByText('Registered Nurses')).toBeTruthy();
  });

  it('dedupes multiple areas of the same occupation into a single plan', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1), swipe(2, 3)],
    });
    const screen = await render(<ActionPlansScreen />);
    await screen.findByText('Registered Nurses');
    expect(screen.getAllByText('Registered Nurses')).toHaveLength(1);
  });

  it('checking steps updates progress text and teaser live', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [swipe(1, 1)],
    });
    const screen = await render(<ActionPlansScreen />);
    await screen.findByText('Registered Nurses');

    fireEvent.press(screen.getByTestId('plan-row-0'));
    await screen.findByText('See the work');

    fireEvent.press(screen.getByTestId('step-checkbox-0'));
    fireEvent.press(screen.getByTestId('step-checkbox-1'));

    fireEvent.press(screen.getByTestId('back-to-plans'));
    await screen.findByText('Registered Nurses');
    expect(await screen.findByText('Try: Find live job postings')).toBeTruthy();
    expect(screen.getByText('33% of 6 steps')).toBeTruthy();
  });
});
