import React from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGamification, UseGamificationResult } from '../useGamification';
import { XpEvent } from '../../utils/gamification';
import { CareerROI } from '../../types';

let latest: UseGamificationResult | null = null;

const Probe: React.FC = () => {
  latest = useGamification();
  return null;
};

const career = (id: number): CareerROI => ({
  id,
  occupation_code: '15-1211.00',
  occupation_name: 'Software Developer',
  area_code: '99',
  area_name: 'U.S.',
  annual_median_salary: '100000',
  education_cost: '40000',
  years_to_breakeven: 3,
  roi_percentage: '10',
  job_zone: 4,
  education_level: "Bachelor's degree",
  skills: [],
  cost_of_living_index: '100',
  adjusted_salary: '100000',
  industry_code: 'x',
  industry_name: 'x',
  demand_rank: null,
  demand_score: null,
  avg_annual_openings: null,
  projected_growth_percent: null,
});

/** State updates commit on a macrotask in this environment; give them a beat. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
};

const mount = async (): Promise<void> => {
  latest = null;
  await render(<Probe />);
  await flush();
};

const track = async (...events: XpEvent[]): Promise<void> => {
  await act(async () => {
    for (const event of events) {
      latest?.trackEvent(event);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
};

const writtenState = (): {
  xp: number;
  likes: number;
  activeDates: string[];
  achievements: Record<string, string>;
} => {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
  return JSON.parse(calls[calls.length - 1][1]);
};

describe('useGamification', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

  it('starts empty', async () => {
    await mount();
    expect(latest?.isLoaded).toBe(true);
    expect(latest?.state.xp).toBe(0);
    expect(latest?.state.totalReviews).toBe(0);
    expect(latest?.state.achievements).toEqual({});
  });

  it('awards XP, unlocks achievements and persists the state blob', async () => {
    await mount();
    await track({ type: 'swipe_right', career: career(1) });

    expect(AsyncStorage.setItem).toHaveBeenCalled();
    const parsed = writtenState();
    expect(parsed.xp).toBe(10);
    expect(parsed.likes).toBe(1);
    expect(parsed.activeDates.length).toBe(1);
    expect(parsed.achievements['first-steps']).toBeTruthy();
    expect(latest?.xpPill?.amount).toBe(10);
  });

  it('round-trips persisted state into a fresh instance', async () => {
    await mount();
    await track(
      { type: 'swipe_left' },
      { type: 'detail_view', career: career(5) },
      { type: 'feedback' },
    );
    expect(latest?.state.xp).toBe(17);

    await mount();
    expect(latest?.state.xp).toBe(17);
    expect(latest?.state.totalReviews).toBe(1);
    expect(latest?.state.feedbacks).toBe(1);
    expect(latest?.state.detailOpens).toBe(1);
  });

  it('keeps daily idempotency across remounts', async () => {
    await mount();
    await track({ type: 'detail_view', career: career(9) });
    expect(latest?.state.xp).toBe(2);

    await mount();
    let awarded: boolean | undefined;
    await act(async () => {
      awarded = latest?.trackEvent({ type: 'detail_view', career: career(9) })?.awarded;
    });
    expect(awarded).toBe(false);
    expect(latest?.state.xp).toBe(2);
  });

  it('reports level-ups through the trackEvent result', async () => {
    await mount();
    const events: XpEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({ type: 'swipe_right', career: career(i + 1) });
      events.push({ type: 'feedback' });
    }
    let sawLevelUp = false;
    for (const event of events) {
      await act(async () => {
        const result = latest?.trackEvent(event);
        if (result?.leveledUp) sawLevelUp = true;
      });
    }

    expect(latest?.state.xp).toBe(200);
    expect(sawLevelUp).toBe(true);

    await act(async () => {
      latest?.dismissXpPill();
    });
    expect(latest?.xpPill).toBeNull();
  });
});
