import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import { CounselorScreen } from '../CounselorScreen';
import { apiClient } from '../../api/client';
import { CounselorChatResponse } from '../../types';

jest.mock('../../components/CareerDetailView', () => ({
  CareerDetailView: () => null,
}));

jest.mock('../../components/OccupationIconBadge', () => ({
  OccupationIconBadge: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#136399',
      primaryLight: '#E3F2FD',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      border: '#E5E7EB',
      text: { primary: '#1F2937', secondary: '#6B7280', muted: '#9CA3AF' },
    },
  }),
}));

jest.mock('../../constants/dataSources', () => ({
  API_BASE: 'http://localhost:3000',
  API_URL: 'http://localhost:3000/api/roi',
}));

const mockResponse: CounselorChatResponse = {
  reply: 'Based on your swipe history you should like software developers.',
  suggestions: [
    {
      id: 1,
      occupation_code: '15-1252',
      occupation_name: 'Software Developers',
      area_code: '99',
      area_name: 'National',
      annual_median_salary: '130160.00',
      education_cost: '40000.00',
      years_to_breakeven: 2,
      roi_percentage: '22.5',
      job_zone: 4,
      education_level: "Bachelor's degree",
      skills: ['Programming'],
      cost_of_living_index: '100.00',
      adjusted_salary: '130160.00',
      industry_code: 'cross-industry',
      industry_name: 'Cross industry',
      demand_rank: 3,
      demand_score: 99,
      avg_annual_openings: 100000,
      projected_growth_percent: 25,
    },
  ],
  quick_replies: ['Explain ROI for software developers', 'What are my next steps?'],
};

jest.mock('../../api/client', () => ({
  apiClient: {
    addCounselorChat: jest.fn(),
  },
}));

const addCounselorChatMock = apiClient.addCounselorChat as jest.Mock;

const renderScreen = async () => {
  const utils = render(<CounselorScreen />);
  return utils;
};

describe('CounselorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    addCounselorChatMock.mockResolvedValue(mockResponse);
  });

  it('renders the empty-state greeting with example prompts', async () => {
    const { getByText, queryByText } = await renderScreen();
    expect(getByText('Your virtual career counselor')).toBeTruthy();
    expect(getByText('Recommend careers for me')).toBeTruthy();
    // No conversation has happened yet
    expect(queryByText('Clear conversation')).toBeTruthy();
  });

  it('sends a message and renders the counselor reply with suggestions', async () => {
    const { getByTestId, findByText, getByText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByTestId('counselor-input'), 'Recommend careers for me');
    });
    await act(async () => {
      fireEvent.press(getByTestId('counselor-send'));
    });

    expect(addCounselorChatMock).toHaveBeenCalledWith('Recommend careers for me');

    await waitFor(() => {
      expect(addCounselorChatMock).toHaveBeenCalled();
    });
    await findByText(/swipe history/i);

    expect(getByText(/software developers\./i)).toBeTruthy();
    expect(getByText('Software Developers')).toBeTruthy();
    expect(getByText('$130,160 median')).toBeTruthy();
    expect(getByText('22.5% ROI')).toBeTruthy();
    expect(getByText('Explain ROI for software developers')).toBeTruthy();
  });

  it('tapping an example prompt sends that message', async () => {
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('What are my next steps?'));
    });

    expect(addCounselorChatMock).toHaveBeenCalledWith('What are my next steps?');
    await waitFor(() => expect(getByText(/swipe history|momentum/i)).toBeTruthy());
  });

  it('clears the conversation', async () => {
    const { getByTestId, getByText, findByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByTestId('counselor-send'));
    });
    await findByText(/swipe history/i);
    expect(window.localStorage.getItem('careerality_counselor_chat')).not.toBeNull();

    fireEvent.press(getByTestId('clear-conversation'));
    expect(JSON.parse(window.localStorage.getItem('careerality_counselor_chat') || '[]')).toEqual([]);
    expect(getByText('Your virtual career counselor')).toBeTruthy();
  });
});
