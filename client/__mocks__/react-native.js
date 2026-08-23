class AnimatedValue {
  constructor(v) { this._value = v; }
  setValue(v) { this._value = v; }
  interpolate(config) { return config.outputRange[0]; }
  addListener() { return 1; }
  removeListener() {}
}
module.exports = {
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
  },
  useColorScheme: () => 'light',
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  NativeModules: {},
  ActivityIndicator: 'ActivityIndicator',
  TouchableOpacity: 'TouchableOpacity',
  Animated: {
    Value: AnimatedValue,
    timing: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    View: 'View',
  },
};
