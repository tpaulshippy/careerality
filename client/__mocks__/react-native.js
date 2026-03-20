module.exports = {
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles) => styles },
  useColorScheme: () => 'light',
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  NativeModules: {},
  ActivityIndicator: 'ActivityIndicator',
};
