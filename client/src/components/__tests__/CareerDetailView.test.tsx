import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CareerDetailView, SLIDE_INTERVAL_MS } from '../CareerDetailView';
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

  it('shows the first slideshow slot and hides the image when every candidate fails', async () => {
    const { getByTestId, queryByTestId } = await render(<CareerDetailView career={mockCareer} />);

    const image = getByTestId('career-detail-image');
    expect(image.props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-1.webp'
    );

    // Slot 1, 2, 3 and the legacy bare filename all 404.
    for (let i = 0; i < 4; i += 1) {
      const current = queryByTestId('career-detail-image');
      if (!current) break;
      await fireEvent(current, 'error');
    }

    expect(queryByTestId('career-detail-image')).toBeNull();
  });

  it('falls through to the next slot when one fails to load', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    await fireEvent(getByTestId('career-detail-image'), 'error');

    expect(getByTestId('career-detail-image').props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-2.webp'
    );
  });

  it('falls back to the legacy single image when all slideshow slots are missing', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    for (let i = 0; i < 3; i += 1) {
      await fireEvent(getByTestId('career-detail-image'), 'error');
    }

    expect(getByTestId('career-detail-image').props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234.webp'
    );
  });

  it('renders one dot per slideshow slot and advances on tap', async () => {
    const { getByTestId, queryByTestId } = await render(<CareerDetailView career={mockCareer} />);

    expect(getByTestId('career-detail-dot-0')).toBeTruthy();
    expect(getByTestId('career-detail-dot-1')).toBeTruthy();
    expect(getByTestId('career-detail-dot-2')).toBeTruthy();
    expect(queryByTestId('career-detail-dot-3')).toBeNull();

    await fireEvent(getByTestId('career-detail-image'), 'press');

    expect(getByTestId('career-detail-image').props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-2.webp'
    );
  });

  it('jumps to the tapped dot', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    await fireEvent(getByTestId('career-detail-dot-2'), 'press');

    expect(getByTestId('career-detail-image').props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-3.webp'
    );
  });

  it('drops the dot for a slot that failed to load', async () => {
    const { getByTestId, queryByTestId } = await render(<CareerDetailView career={mockCareer} />);

    await fireEvent(getByTestId('career-detail-image'), 'error');

    expect(queryByTestId('career-detail-dot-0')).toBeNull();
    expect(getByTestId('career-detail-dot-1')).toBeTruthy();
  });

  it('hides the dots when only one slideshow slot is left', async () => {
    const { getByTestId, queryByTestId } = await render(
      <CareerDetailView career={mockCareer} />
    );

    // Fail slot 1, then slot 2. That leaves slot 3 as the only frame, so there is
    // nothing to page through and the dots go away.
    await fireEvent(getByTestId('career-detail-image'), 'error');
    await fireEvent(getByTestId('career-detail-image'), 'error');

    expect(getByTestId('career-detail-image').props.source.uri).toBe(
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-3.webp'
    );
    expect(queryByTestId('career-detail-dots')).toBeNull();
  });

  it('never rotates into the legacy image while a slot still works', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    // Three taps walk 1 -> 2 -> 3 -> back to 1. The legacy object is a duplicate of
    // slot 1, so it must never appear as its own step.
    const seen = [getByTestId('career-detail-image').props.source.uri];
    for (let i = 0; i < 3; i += 1) {
      await fireEvent(getByTestId('career-detail-image'), 'press');
      seen.push(getByTestId('career-detail-image').props.source.uri);
    }

    expect(seen).toEqual([
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-1.webp',
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-2.webp',
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-3.webp',
      'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev/151234-1.webp',
    ]);
  });

  it('keeps auto-advancing on schedule across unrelated re-renders', async () => {
    jest.useFakeTimers();
    try {
      const { getByTestId, rerender } = await render(<CareerDetailView career={mockCareer} />);
      const first = getByTestId('career-detail-image').props.source.uri;

      // Burn most of one interval, then re-render, then burn the remainder.
      // Total elapsed time exceeds SLIDE_INTERVAL_MS, but if the effect restarted the
      // interval on re-render neither stub would ever reach the full duration and the
      // slideshow would stall. `urls` and `rotation` are memoised so it does not.
      await act(async () => {
        jest.advanceTimersByTime(SLIDE_INTERVAL_MS - 1000);
      });
      expect(getByTestId('career-detail-image').props.source.uri).toBe(first);

      await rerender(<CareerDetailView career={{ ...mockCareer }} />);

      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      expect(getByTestId('career-detail-image').props.source.uri).not.toBe(first);
    } finally {
      jest.useRealTimers();
    }
  });

  it('makes the image inert, not a dead button, when only one photo is available', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    // Fail slots 1 and 2 so the legacy fallback is all that remains.
    await fireEvent(getByTestId('career-detail-image'), 'error');
    await fireEvent(getByTestId('career-detail-image'), 'error');

    const image = getByTestId('career-detail-image');
    const wrapper = image.parent;
    expect(wrapper.props.accessibilityRole).toBe('image');
    expect(wrapper.props.disabled).toBe(true);
    expect(wrapper.props.onPress).toBeUndefined();
  });

  it('keeps the image tappable when there is more than one photo', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    const wrapper = getByTestId('career-detail-image').parent;
    expect(wrapper.props.accessibilityRole).toBe('button');
    expect(wrapper.props.disabled).toBe(false);
  });

  it('marks the current dot as selected for screen readers', async () => {
    const { getByTestId } = await render(<CareerDetailView career={mockCareer} />);

    expect(getByTestId('career-detail-dot-0').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByTestId('career-detail-dot-1').props.accessibilityState).toEqual({
      selected: false,
    });
  });
});
