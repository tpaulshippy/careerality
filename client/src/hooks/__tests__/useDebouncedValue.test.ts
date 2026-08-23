import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('nurse', 250));
    expect(result.current).toBe('nurse');
  });

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    rerender({ value: 'nu' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('');

    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(result.current).toBe('');
  });

  it('updates after the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    rerender({ value: 'nurse' });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe('nurse');
  });

  it('resets the timer on rapid changes and only applies the latest value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    rerender({ value: 'n' });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    rerender({ value: 'nu' });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    rerender({ value: 'nur' });
    expect(result.current).toBe('');

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe('nur');
  });

  it('supports non-string values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 0 },
    });

    rerender({ value: 42 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(42);
  });
});
