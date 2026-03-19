const storage = {};
module.exports = {
  getItem: jest.fn((key) => Promise.resolve(storage[key] || null)),
  setItem: jest.fn((key, value) => { storage[key] = value; return Promise.resolve(); }),
  removeItem: jest.fn((key) => { delete storage[key]; return Promise.resolve(); }),
  clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); return Promise.resolve(); }),
};
