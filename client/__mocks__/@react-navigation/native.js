/* eslint-disable @typescript-eslint/no-require-imports */
const React = require('react');
module.exports = {
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
    navigate: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: (cb) => {
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
};
