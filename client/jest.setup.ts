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
