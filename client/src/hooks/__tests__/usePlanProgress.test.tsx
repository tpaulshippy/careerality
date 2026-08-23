import { renderHook, act, waitFor } from '@testing-library/react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlanProgress, planProgressKey } from '../usePlanProgress';

// Force the web localStorage code path in useLocalStorage
beforeAll(() => {
  (Platform as { OS: string }).OS = 'web';
});

afterEach(() => {
  (Platform as { OS: string }).OS = 'web';
});

class MockStorage {
  private store: Record<string, string> = {};

  getItem = jest.fn((key: string): string | null => this.store[key] ?? null);

  setItem = jest.fn((key: string, value: string): void => {
    this.store[key] = String(value);
  });

  removeItem = jest.fn((key: string): void => {
    delete this.store[key];
  });

  clear = (): void => {
    this.store = {};
  };
}

describe('usePlanProgress', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: mockStorage,
    });
  });

  it('starts with zero progress for an unknown career', async () => {
    const { result } = renderHook(() => usePlanProgress());
    await waitFor(() => expect(result.current.completions).toEqual({}));
    expect(result.current.progressFor('29-1141.00')).toBe(0);
    expect(result.current.isComplete('29-1141.00', 'see-the-work')).toBe(false);
  });

  it('toggles steps and computes fractional progress', async () => {
    const { result } = renderHook(() => usePlanProgress());
    await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());

    act(() => {
      result.current.toggleStep('29-1141.00', 'see-the-work');
      result.current.toggleStep('29-1141.00', 'watch-workers');
    });
    expect(result.current.progressFor('29-1141.00')).toBeCloseTo(2 / 6);
    expect(result.current.isComplete('29-1141.00', 'see-the-work')).toBe(true);
    expect(result.current.progressFor('15-1252.00')).toBe(0);

    act(() => {
      result.current.toggleStep('29-1141.00', 'see-the-work');
    });
    expect(result.current.progressFor('29-1141.00')).toBeCloseTo(1 / 6);
    expect(result.current.isComplete('29-1141.00', 'see-the-work')).toBe(false);
  });

  it('reaches full progress when every step is done and caps at 1', async () => {
    const { result } = renderHook(() => usePlanProgress());
    await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());

    const stepIds = ['a', 'b', 'c', 'd', 'e', 'f'];
    act(() => {
      stepIds.forEach(id => result.current.toggleStep('41-4012.00', id));
    });
    expect(result.current.progressFor('41-4012.00')).toBe(1);

    act(() => {
      // extra completions beyond totalSteps must not exceed 1
      result.current.toggleStep('41-4012.00', 'g');
    });
    expect(result.current.progressFor('41-4012.00')).toBe(1);
  });

  it('persists completions to storage and reloads them for a fresh hook instance', async () => {
    const first = renderHook(() => usePlanProgress());
    await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
    act(() => {
      first.result.current.toggleStep('29-1171.00', 'learn-skill');
    });
    await waitFor(() =>
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'careerality_plan_progress',
        JSON.stringify({ [planProgressKey('29-1171.00', 'learn-skill')]: true })
      )
    );

    const second = renderHook(() => usePlanProgress());
    await waitFor(() => {
      expect(second.result.current.progressFor('29-1171.00')).toBeCloseTo(1 / 6);
    });
    expect(second.result.current.isComplete('29-1171.00', 'learn-skill')).toBe(true);
  });

  it('keys progress per occupation code so careers stay independent', async () => {
    const { result } = renderHook(() => usePlanProgress());
    await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());

    act(() => {
      result.current.toggleStep('29-1171.00', 'watch-workers');
    });

    expect(planProgressKey('29-1171.00', 'watch-workers')).toBe('29-1171.00:watch-workers');
    expect(result.current.progressFor('27-2021.00')).toBe(0);
  });

  it('preserves toggles made before the stored value finishes loading', async () => {
    // Simulate the native path, where the initial read is genuinely async.
    (Platform as { OS: string }).OS = 'ios';
    let resolveRead: (value: string | null) => void = () => {};
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () => new Promise<string | null>(resolve => { resolveRead = resolve; })
    );
    const stored = JSON.stringify({ [planProgressKey('11-1011.00', 'see-the-work')]: true });
    const { result } = renderHook(() => usePlanProgress());

    act(() => {
      result.current.toggleStep('29-1141.00', 'see-the-work');
    });
    expect(result.current.isComplete('29-1141.00', 'see-the-work')).toBe(true);

    await act(async () => {
      resolveRead(stored);
    });
    expect(result.current.isComplete('29-1141.00', 'see-the-work')).toBe(true);
    expect(result.current.isComplete('11-1011.00', 'see-the-work')).toBe(true);
    expect(result.current.progressFor('29-1141.00')).toBeCloseTo(1 / 6);

    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'careerality_plan_progress',
        JSON.stringify({
          ...JSON.parse(stored),
          [planProgressKey('29-1141.00', 'see-the-work')]: true,
        })
      )
    );
  });
});
