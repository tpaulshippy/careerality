import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CareerDetailView } from '../CareerDetailView';
import { CareerROI } from '../../types';

jest.mock('../OccupationIconBadge', () => ({
  OccupationIconBadge: () => null,
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#F2F2F2',
      text: { primary: '#000000', secondary: '#666666', muted: '#999999' },
      error: '#FF0000',
      success: '#00CC00',
    },
    shadows: { card: {}, subtle: {} },
  }),
}));

const mockCareer: CareerROI = {
  id: 1,
  occupation_code: '15-1234',
  occupation_name: 'Software Developer',
  area_code: '99',
  area_name: 'U.S.',
  annual_median_salary: '95000',
  education_cost: '40000',
  years_to_breakeven: 3,
  roi_percentage: '137',
  job_zone: 4,
  education_level: "Bachelor's",
  skills: ['programming'],
  cost_of_living_index: '100',
  adjusted_salary: '95000',
  industry_code: '54',
  industry_name: 'Professional Services',
  demand_rank: 1,
  demand_score: null,
  avg_annual_openings: 50000,
  projected_growth_percent: 15,
};

describe('CareerDetailView', () => {
  it('renders the ROI row highlighted in the Investment section', async () => {
    const { getByText } = await render(<CareerDetailView career={mockCareer} />);

    expect(getByText('ROI')).toBeTruthy();
    expect(getByText('137.0%')).toBeTruthy();
  });

  it('does not show the occupation code under the occupation name', async () => {
    const { getByText, queryByText } = await render(<CareerDetailView career={mockCareer} />);

    expect(getByText('Software Developer')).toBeTruthy();
    expect(queryByText('15-1234')).toBeNull();
  });

  it('shows a friendly preparation label instead of the raw job zone', async () => {
    const { getByText, queryByText } = await render(<CareerDetailView career={mockCareer} />);

    expect(getByText('Preparation')).toBeTruthy();
    expect(getByText('Considerable preparation (Zone 4)')).toBeTruthy();
    expect(queryByText('Job Zone')).toBeNull();
  });

  it('maps each job zone to its friendly label', async () => {
    const expected: Record<number, string> = {
      1: 'Little to no preparation (Zone 1)',
      2: 'Some preparation (Zone 2)',
      3: 'Medium preparation (Zone 3)',
      4: 'Considerable preparation (Zone 4)',
      5: 'Extensive preparation (Zone 5)',
    };

    const { getByText, rerender } = await render(
      <CareerDetailView career={{ ...mockCareer, job_zone: 1 }} />
    );

    for (const [zone, label] of Object.entries(expected)) {
      await rerender(<CareerDetailView career={{ ...mockCareer, job_zone: Number(zone) }} />);
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('hides the Cost of Living Index row for the national area', async () => {
    const { queryByText } = await render(<CareerDetailView career={mockCareer} />);

    expect(queryByText('Cost of Living Index')).toBeNull();
  });

  it('hides the Cost of Living Index row when adjusted salary equals median salary', async () => {
    const regional = { ...mockCareer, area_code: '48', area_name: 'Texas' };
    const { queryByText } = await render(<CareerDetailView career={regional} />);

    expect(queryByText('Cost of Living Index')).toBeNull();
  });

  it('shows the Cost of Living Index row for a regional area with an adjusted salary', async () => {
    const regional = {
      ...mockCareer,
      area_code: '48',
      area_name: 'Texas',
      adjusted_salary: '102000',
      cost_of_living_index: '93.1',
    };
    const { getByText } = await render(<CareerDetailView career={regional} />);

    expect(getByText('Cost of Living Index')).toBeTruthy();
    expect(getByText('93.1')).toBeTruthy();
  });

  it('shows the career image and hides it when it fails to load', async () => {
    const { getByTestId, queryByTestId } = await render(<CareerDetailView career={mockCareer} />);

    const image = getByTestId('career-detail-image');
    expect(image.props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/1512.webp'
    );

    await fireEvent(image, 'error');

    expect(queryByTestId('career-detail-image')).toBeNull();
  });
});
