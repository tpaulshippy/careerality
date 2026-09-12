const React = require('react');

class AnimatedValue {
  constructor(v) { this._value = v; }
  setValue() {}
  interpolate(config) { return config.outputRange[0]; }
  addListener() { return 1; }
  removeListener() {}
}

const animation = () => ({ start: (cb) => cb && cb({ finished: true }), stop: () => {} });

// Renders items through renderItem so list-based screens can be asserted on.
const FlatList = (props) => {
  const items = props.data || [];
  return React.createElement(
    'View',
    null,
    props.ListHeaderComponent || null,
    items.map((item, index) =>
      React.createElement(
        'View',
        { key: props.keyExtractor ? props.keyExtractor(item, index) : index },
        props.renderItem({ item, index, separators: {} }),
      ),
    ),
    typeof props.ListFooterComponent === 'function'
      ? React.createElement(props.ListFooterComponent)
      : props.ListFooterComponent || null,
  );
};

module.exports = {
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  FlatList,
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
  },
  useColorScheme: () => 'light',
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  NativeModules: {},
  ActivityIndicator: 'ActivityIndicator',
  TouchableOpacity: 'TouchableOpacity',
  Linking: { openURL: jest.fn(), canOpenURL: jest.fn(() => Promise.resolve(true)) },
  Animated: {
    Value: AnimatedValue,
    timing: animation,
    sequence: animation,
    loop: animation,
    View: 'View',
  },
};
