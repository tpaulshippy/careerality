import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CareerPickerModal } from '../CareerPickerModal';
import { apiClient } from '../../api/client';
import { CatalogBundle, loadCatalog, queryCareers } from '../../data/catalog';

jest.mock('react-native', () => {
  const base = jest.requireActual('../../../__mocks__/react-native.js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    ...base,
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
    }) =>
      React.createElement(
        base.View,
        null,
        (data ?? []).map((item: unknown, index: number) =>
          React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : index },
            renderItem({ item, index })
          )
        )
      ),
  };
});

jest.mock('../../api/client', () => ({
  apiClient: {
    // Swipe metadata always comes from the server; records hydrate locally.
    getSwipeHistory: jest.fn().mockResolvedValue({ swipes: [] }),
    getCareers: jest.fn(),
    searchCareers: jest.fn(),
  },
}));

jest.mock('../../data/catalog', () => {
  const actual = jest.requireActual('../../data/catalog');
  return {
    ...actual,
    // Pass through to the real implementation, but record the calls so the
    // modal's wiring (params, per_page, excludeIds) is observable.
    queryCareers: jest.fn((...args: unknown[]) =>
      (actual.queryCareers as (...a: unknown[]) => unknown)(...args)
    ),
  };
});

const queryCareersMock = queryCareers as jest.Mock;

// Small deterministic bundle: two national rows, no server dependency.
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
    [0, 0, 1, 86070, 40000, 2, 150, 4, "Bachelor's degree", 0, 1, 0.9, 40000, 9, 1.0, 86070],
    [1, 0, 2, 120000, 80000, 4, 200, 4, "Bachelor's degree", 0, 2, 0.85, 30000, 15, 1.0, 120000],
  ],
  map: {},
};

const props = {
  visible: true,
  onClose: jest.fn(),
  onSelect: jest.fn(),
};

describe('CareerPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadCatalog(fixture);
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({ swipes: [] });
  });

  it('lists the demand top-50 through queryCareers with no server calls', async () => {
    const screen = await render(<CareerPickerModal {...props} />);

    await waitFor(() => expect(screen.getByText('Registered Nurses')).toBeTruthy());
    expect(screen.getByText('Software Developers')).toBeTruthy();
    expect(queryCareersMock).toHaveBeenCalledWith({
      page: 1,
      sort: 'demand',
      area_code: '99',
      per_page: 50,
      excludeIds: [],
    });
    expect(apiClient.getCareers).not.toHaveBeenCalled();
    expect(apiClient.searchCareers).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Registered Nurses'));
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('excludes already-swiped careers from the browse list', async () => {
    (apiClient.getSwipeHistory as jest.Mock).mockResolvedValue({
      swipes: [{ id: 7, career_id: 1, direction: 'right', created_at: new Date().toISOString() }],
    });
    const screen = await render(<CareerPickerModal {...props} />);

    await waitFor(() => expect(screen.getByText('Software Developers')).toBeTruthy());
    expect(screen.queryByText('Registered Nurses')).toBeNull();
    expect(queryCareersMock).toHaveBeenCalledWith(
      expect.objectContaining({ excludeIds: [1] })
    );
  });

  it('searches through queryCareers scoped to the national area', async () => {
    const screen = await render(<CareerPickerModal {...props} />);
    await waitFor(() => expect(screen.getByText('Registered Nurses')).toBeTruthy());

    fireEvent.changeText(
      screen.getByPlaceholderText('Search careers (e.g. registered nurse)'),
      'nurse'
    );

    await waitFor(() =>
      expect(queryCareersMock).toHaveBeenCalledWith({ q: 'nurse', area_code: '99', per_page: 50 })
    );
    await waitFor(() => expect(screen.queryByText('Software Developers')).toBeNull());
    expect(screen.getByText('Registered Nurses')).toBeTruthy();
    expect(apiClient.searchCareers).not.toHaveBeenCalled();
  });
});
