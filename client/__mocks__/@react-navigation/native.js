module.exports = {
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: {},
  }),
};
