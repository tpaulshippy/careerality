import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FilterSheet } from '../FilterSheet';
import { CatalogBundle, loadCatalog } from '../../data/catalog';
import { apiClient } from '../../api/client';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Modal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? children : null,
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: {
    create: (styles: unknown) => styles,
    flatten: (styles: unknown) =>
      Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
  },
  Platform: { OS: 'ios', select: (obj: { ios: unknown }) => obj.ios },
}));

jest.mock('@react-native-picker/picker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const Picker = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Picker.Item = ({ label }: { label: string; value: string }) =>
    React.createElement('Text', { testID: 'picker-item' }, label);
  return { Picker };
});

jest.mock('@ptomasroos/react-native-multi-slider', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../api/client', () => ({
  apiClient: {
    // Mirrors production ordering: "U.S." lands between Texas and Utah.
    get: jest.fn(() =>
      Promise.resolve({
        states: [
          { area_code: '48', area_name: 'Texas' },
          { area_code: '99', area_name: 'U.S.' },
          { area_code: '49', area_name: 'Utah' },
        ],
      })
    ),
    // Server-fallback path: only used while the catalog is still empty.
    getStates: jest.fn(() =>
      Promise.resolve({
        states: [
          { area_code: '48', area_name: 'Texas' },
          { area_code: '99', area_name: 'U.S.' },
          { area_code: '49', area_name: 'Utah' },
        ],
      })
    ),
  },
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      primaryLight: '#E3F2FD',
      background: '#FFFFFF',
      surface: '#F2F2F2',
      border: '#DDDDDD',
      text: { primary: '#000000', secondary: '#666666', muted: '#999999' },
      error: '#FF0000',
      success: '#00CC00',
    },
    shadows: { card: {}, subtle: {} },
  }),
}));

// Small deterministic bundle: Texas + national + Utah, so the national-first
// pinning is observable without depending on the 37k-row shipped bundle.
const fixture: CatalogBundle = {
  version: 1,
  generated_at: '2026-01-01T00:00:00Z',
  source: 'test',
  counts: { areas: 3, industries: 1, occupations: 1, rows: 1 },
  areas: [
    { c: '48', n: 'Texas' },
    { c: '99', n: 'U.S.' },
    { c: '49', n: 'Utah' },
  ],
  occupations: [{ c: '29-1141.00', n: 'Registered Nurses' }],
  industries: [{ c: '62', n: 'Healthcare' }],
  rows: [
    [0, 1, 1, 80000, 40000, 2, 150, 4, "Bachelor's degree", 0, 1, 0.9, 50000, 9, 1.0, 80000],
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

const getMock = apiClient.get as jest.Mock;
const getStatesMock = apiClient.getStates as jest.Mock;

describe('FilterSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCatalog(fixture);
  });

  it('labels the location section and pins the national option first', async () => {
    await render(
      <FilterSheet visible onClose={() => {}} onApply={() => {}} />
    );

    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.queryByText('State Code')).toBeNull();

    const items = await screen.findAllByTestId('picker-item');
    expect(items[0].props.children).toBe('National (all states)');
    expect(items.map(item => item.props.children)).toEqual([
      'National (all states)',
      'Texas',
      'Utah',
    ]);
    expect(screen.queryByText('U.S.')).toBeNull();
    // Local-first: states come from the bundle, no list-endpoint calls.
    expect(getStatesMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('includes the selected sort option in the onApply payload', async () => {
    const onApply = jest.fn();
    await render(<FilterSheet visible onClose={() => {}} onApply={onApply} />);

    await fireEvent.press(screen.getByText('Highest Salary'));
    await fireEvent.press(screen.getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'salary' })
    );
  });

  it('defaults to ROI sort when no sort option is selected', async () => {
    const onApply = jest.fn();
    await render(<FilterSheet visible onClose={() => {}} onApply={onApply} />);

    await fireEvent.press(screen.getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'roi' })
    );
  });

  it('falls back to the server states when the catalog is empty', async () => {
    loadCatalog(emptyBundle);
    await render(
      <FilterSheet visible onClose={() => {}} onApply={() => {}} />
    );

    const items = await screen.findAllByTestId('picker-item');
    expect(items.map(item => item.props.children)).toEqual([
      'National (all states)',
      'Texas',
      'Utah',
    ]);
    expect(getStatesMock).toHaveBeenCalled();
  });
});
