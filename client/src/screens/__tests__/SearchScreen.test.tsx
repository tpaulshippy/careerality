import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../SearchScreen';
import { apiClient } from '../../api/client';
import { routeNaturalLanguage } from '../../api/jevFilters';

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

jest.mock('../../api/jevFilters', () => {
  const actual = jest.requireActual('../../api/jevFilters');
  return { ...actual, routeNaturalLanguage: jest.fn().mockResolvedValue(null) };
});

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
        undefined,
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

  it('routes a natural-language query and applies real filter params', async () => {
    (routeNaturalLanguage as jest.Mock).mockResolvedValue({
      education_pathway: 'no_degree',
      work_env: 'remote',
      min_salary: 80000,
      requires_clarification: false,
      confidence: 0.5,
      provider: 'fallback',
    });
    const screen = await render(<SearchScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Search careers…'),
      'I hate school but want $80k+ remote',
    );

    await waitFor(() => {
      expect(routeNaturalLanguage).toHaveBeenCalledWith('I hate school but want $80k+ remote');
    }, { timeout: 2000 });
    await waitFor(() => expect(screen.getByTestId('nl-apply')).toBeTruthy(), { timeout: 2000 });

    fireEvent.press(screen.getByTestId('nl-apply'));

    await waitFor(() => {
      expect(apiClient.searchCareers).toHaveBeenCalledWith(
        'remote',
        '06',
        { minSalary: 80000, educationPathway: 'no_degree' },
        expect.any(AbortSignal),
      );
    }, { timeout: 2000 });
    await waitFor(() => expect(screen.getByTestId('nl-applied')).toBeTruthy(), { timeout: 2000 });
  });

  it('clears applied filters and re-searches without them', async () => {
    (routeNaturalLanguage as jest.Mock).mockResolvedValue({
      education_pathway: 'no_degree',
      work_env: 'remote',
      min_salary: 80000,
      requires_clarification: false,
      confidence: 0.5,
      provider: 'fallback',
    });
    const screen = await render(<SearchScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Search careers…'),
      'I hate school but want $80k+ remote',
    );
    await waitFor(() => expect(screen.getByTestId('nl-apply')).toBeTruthy(), { timeout: 2000 });
    fireEvent.press(screen.getByTestId('nl-apply'));
    await waitFor(() => expect(screen.getByTestId('nl-applied')).toBeTruthy(), { timeout: 2000 });

    fireEvent.press(screen.getByTestId('nl-clear'));

    await waitFor(() => {
      const calls = (apiClient.searchCareers as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1][2]).toBeUndefined();
    }, { timeout: 2000 });
    await waitFor(() => expect(screen.queryByTestId('nl-applied')).toBeNull(), { timeout: 2000 });
  });

  it('does not route short keyword searches', async () => {
    const screen = await render(<SearchScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search careers…'), 'nurse');

    await waitFor(() => {
      expect(apiClient.searchCareers).toHaveBeenCalledWith(
        'nurse',
        '06',
        undefined,
        expect.any(AbortSignal),
      );
    }, { timeout: 1000 });
    expect(routeNaturalLanguage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('nl-apply')).toBeNull();
  });
});
