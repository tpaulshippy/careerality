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

  it('opens detail view before showing interest feedback and saves the career as liked', async () => {
    const career = {
      id: 42,
      occupation_name: 'Registered Nurse',
      occupation_code: '291141',
      annual_median_salary: 80000,
      roi_percentage: 120,
      demand_rank: 1,
    };
    (apiClient.getCareers as jest.Mock).mockResolvedValue({ records: [career] });
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
  });
});
