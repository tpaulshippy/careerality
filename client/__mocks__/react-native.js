class AnimatedValue {
  constructor(v) { this._value = v; }
  setValue(v) { this._value = v; }
  stopAnimation() {}
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
    absoluteFillObject: {},
  },
  useColorScheme: () => 'light',
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  NativeModules: {},
  ActivityIndicator: 'ActivityIndicator',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  Modal: 'Modal',
  Dimensions: { get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }) },
  Easing: {
    linear: (t) => t,
    quad: (t) => t * t,
    out: (easing) => easing || ((t) => t),
    in: (easing) => easing || ((t) => t),
    back: () => (t) => t,
  },
  Animated: {
    Value: AnimatedValue,
    timing: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    sequence: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    parallel: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    delay: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    View: 'Animated.View',
  },
};
