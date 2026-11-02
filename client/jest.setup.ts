// React 19 / react-test-renderer requires this flag for act() support.
// Without it every act() call logs "The current testing environment is
// not configured to support act(...)".
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-worklets', () => ({}));

// eslint-disable-next-line no-console
const originalError = console.error;
// eslint-disable-next-line no-console
console.error = (...args: Parameters<typeof console.error>) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('react-test-renderer is deprecated') ||
     message.includes('You called act(async') ||
     message.includes('not wrapped in act'))
  ) {
    return;
  }
  originalError(...args);
};
