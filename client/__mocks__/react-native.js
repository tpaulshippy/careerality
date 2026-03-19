module.exports = {
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles) => styles },
  useColorScheme: () => 'light',
  Platform: { OS: 'ios', select: (obj: any) => obj.ios },
  NativeModules: {},
};
