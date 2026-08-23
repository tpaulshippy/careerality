const animValue = () => ({
  setValue: jest.fn(),
  stopAnimation: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  interpolate: jest.fn(() => ({ valueOf: () => 0 })),
});

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
    Value: jest.fn(() => animValue()),
    timing: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    sequence: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    parallel: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    delay: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    View: 'Animated.View',
  },
};
