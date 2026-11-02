import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../SearchScreen';
import { apiClient } from '../../api/client';
import { CatalogBundle, loadCatalog } from '../../data/catalog';

jest.mock('@react-native-picker/picker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const Picker = ({ children }: { children: React.ReactNode }) => React.createElement('Picker', null, children);
  Picker.Item = ({ children }: { children: React.ReactNode }) => React.createElement('Picker.Item', null, children);
  return { Picker };
});

jest.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { stateCode: '06' },
    setStateCode: jest.fn(),
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      success: '#00A86B',
      primaryLight: '#DDEEFF',
      background: '#FFFFFF',
      surface: '#F2F2F2',
      border: '#CCCCCC',
      text: { primary: '#000000', secondary: '#666666', muted: '#999999' },
      error: '#FF0000',
    },
    shadows: { subtle: {} },
  }),
}));

jest.mock('../../components', () => ({
  CareerDetailView: ({ onInterest }: { onInterest?: () => void }) =>
    React.createElement('CareerDetailView', { testID: 'career-detail-view', onInterest }),
  Button: () => null,
  FeedbackModal: ({ visible, onSubmit, onClose }: { visible: boolean; onSubmit: (interest: string) => void; onClose: () => void }) =>
    visible ? React.createElement('FeedbackModal', { testID: 'feedback-modal', onSubmit, onClose }) : null,
}));

jest.mock('../../api/client', () => ({
  apiClient: {
    getCareers: jest.fn().mockResolvedValue({ records: [] }),
    searchCareers: jest.fn().mockResolvedValue({ records: [] }),
    submitSwipe: jest.fn().mockResolvedValue(undefined),
    getCareerInArea: jest.fn().mockResolvedValue({ skills: [] }),
    getSwipeHistory: jest.fn().mockResolvedValue({ swipes: [] }),
    get: jest.fn().mockResolvedValue({ states: [{ area_code: '06', area_name: 'California' }] }),
    // Server-fallback path: only used while the catalog is still empty.
    getStates: jest.fn().mockResolvedValue({ states: [{ area_code: '06', area_name: 'California' }] }),
  },
}));

// Small deterministic bundle scoped to California + national, so popular and
// typed search results are observable without the 37k-row shipped bundle.
// rows: [occIdx, areaIdx, id, salary, eduCost, breakeven, roi, jobZone,
//        eduLevel, indIdx, demandRank, demandScore, openings, growth,
//        colIndex, adjSalary]
const fixture: CatalogBundle = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  source: 'test',
  counts: { areas: 2, industries: 1, occupations: 2, rows: 4 },
  areas: [
    { c: '99', n: 'National' },
    { c: '06', n: 'California' },
  ],
  occupations: [
    { c: '29-1141.00', n: 'Registered Nurse' },
    { c: '15-1252.00', n: 'Software Developers' },
  ],
  industries: [{ c: '62', n: 'Healthcare' }],
  rows: [
    [0, 1, 42, 80000, 40000, 2, 120, 4, "Bachelor's degree", 0, 1, 0.9, 50000, 9, 1.0, 80000],
    [1, 1, 43, 120000, 80000, 4, 200, 4, "Bachelor's degree", 0, 2, 0.85, 30000, 15, 1.0, 120000],
    [0, 0, 44, 82000, 40000, 2, 125, 4, "Bachelor's degree", 0, 1, 0.9, 52000, 9, 1.0, 82000],
    [1, 0, 45, 121000, 80000, 4, 205, 4, "Bachelor's degree", 0, 2, 0.85, 31000, 15, 1.0, 121000],
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

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCatalog(fixture);
  });

  it('loads popular careers and typed search results local-first with no list-endpoint calls', async () => {
    const screen = await render(<SearchScreen />);

    // Popular list comes from the bundle (demand sort, California scope).
    await waitFor(() => expect(screen.getByTestId('search-result-42')).toBeTruthy());
    expect(screen.getByTestId('search-result-43')).toBeTruthy();
    expect(apiClient.getCareers).not.toHaveBeenCalled();
    expect(apiClient.getStates).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Search careers…'), 'nurse');

    // Typed search filters the bundle in-area; the server search endpoint
    // is never hit while the catalog is populated.
    await waitFor(() => expect(screen.getByTestId('search-result-42')).toBeTruthy());
    expect(screen.queryByTestId('search-result-43')).toBeNull();
    expect(apiClient.searchCareers).not.toHaveBeenCalled();
  });

  it('opens detail view before showing interest feedback and saves the career as liked', async () => {
    const screen = await render(<SearchScreen />);

    await waitFor(() => expect(screen.getByTestId('search-result-42')).toBeTruthy());
    expect(screen.queryByTestId('feedback-modal')).toBeNull();
    fireEvent.press(screen.getByTestId('search-result-42'));
    await waitFor(() => expect(screen.getByTestId('career-detail-view')).toBeTruthy());
    screen.getByTestId('career-detail-view').props.onInterest();

    await waitFor(() => expect(screen.getByTestId('feedback-modal')).toBeTruthy());
    fireEvent(screen.getByTestId('feedback-modal'), 'onSubmit', 'very_interested');

    await waitFor(() => {
      expect(apiClient.submitSwipe).toHaveBeenCalledWith(42, 'right', 'very_interested');
    });
    expect(apiClient.getCareers).not.toHaveBeenCalled();
  });

  it('excludes swiped careers from the popular list local-first', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [{ id: 1, career_id: 42, direction: 'right', created_at: new Date().toISOString() }],
    });
    const screen = await render(<SearchScreen />);

    // Only the unswiped career (43) shows; the swiped one (42) is excluded.
    await waitFor(() => expect(screen.getByTestId('search-result-43')).toBeTruthy());
    expect(screen.queryByTestId('search-result-42')).toBeNull();
  });

  it('falls back to the server list when the catalog is empty', async () => {
    loadCatalog(emptyBundle);
    const career = {
      id: 42,
      occupation_name: 'Registered Nurse',
      occupation_code: '291141',
      annual_median_salary: 80000,
      roi_percentage: 120,
      demand_rank: 1,
    };
    (apiClient.getCareers as jest.Mock).mockResolvedValue({ records: [career] });
    (apiClient.searchCareers as jest.Mock).mockResolvedValue({ records: [career] });
    const screen = await render(<SearchScreen />);

    await waitFor(() => {
      expect(apiClient.getCareers).toHaveBeenCalledWith({
        page: 1,
        sort: 'demand',
        area_code: '06',
      });
    });

    fireEvent.changeText(screen.getByPlaceholderText('Search careers…'), 'nurse');

    await waitFor(() => {
      expect(apiClient.searchCareers).toHaveBeenCalledWith(
        'nurse',
        '06',
        expect.any(AbortSignal),
      );
    }, { timeout: 1000 });
  });
});
