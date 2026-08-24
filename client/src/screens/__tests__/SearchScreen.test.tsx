import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../SearchScreen';
import { apiClient } from '../../api/client';

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
  CareerDetailView: () => null,
  Button: () => null,
}));

jest.mock('../../api/client', () => ({
  apiClient: {
    getCareers: jest.fn().mockResolvedValue({ records: [] }),
    searchCareers: jest.fn().mockResolvedValue({ records: [] }),
    get: jest.fn().mockResolvedValue({ states: [{ area_code: '06', area_name: 'California' }] }),
  },
}));

describe('SearchScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the selected state to popular careers and typed search requests', async () => {
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
