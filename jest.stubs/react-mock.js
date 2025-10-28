const { getCurrentStore } = require("./react-store");

function getStore() {
  return getCurrentStore();
}

module.exports = {
  __esModule: true,
  default: {},
  useState(initial) {
    return getStore().useState(initial);
  },
  useEffect(effect, deps) {
    return getStore().useEffect(effect, deps);
  },
  useRef(initial) {
    return getStore().useRef(initial);
  },
  useCallback(fn, deps) {
    return getStore().useCallback(fn, deps);
  },
};
