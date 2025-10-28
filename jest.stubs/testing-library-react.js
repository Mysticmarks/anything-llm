const { setCurrentStore } = require("./react-store");

function areDepsEqual(prev = [], next = []) {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function createStore(hook) {
  const stateValues = [];
  const refValues = [];
  const callbackValues = [];
  const effectValues = [];

  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let isRendering = false;
  let pendingRender = false;
  let lastProps = {};

  const result = { current: undefined };

  function scheduleRender() {
    if (isRendering) {
      pendingRender = true;
      return;
    }
    render(lastProps);
  }

  function runEffects() {
    effectValues.forEach((effect, index) => {
      if (!effect) return;
      if (effect.shouldRun) {
        if (typeof effect.cleanup === "function") {
          effect.cleanup();
        }
        const cleanup = effect.fn();
        effect.cleanup = typeof cleanup === "function" ? cleanup : null;
        effect.shouldRun = false;
      }
    });
  }

  function render(props) {
    lastProps = props;
    stateIndex = 0;
    refIndex = 0;
    callbackIndex = 0;
    effectIndex = 0;
    isRendering = true;
    setCurrentStore(store);
    try {
      result.current = hook(props);
    } finally {
      setCurrentStore(null);
      isRendering = false;
    }
    runEffects();
    if (pendingRender) {
      pendingRender = false;
      render(lastProps);
    }
  }

  const store = {
    result,
    render,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in stateValues)) {
        stateValues[index] = typeof initial === "function" ? initial() : initial;
      }
      const setState = (value) => {
        const nextValue = typeof value === "function" ? value(stateValues[index]) : value;
        if (nextValue !== stateValues[index]) {
          stateValues[index] = nextValue;
          scheduleRender();
        }
      };
      return [stateValues[index], setState];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refValues)) {
        refValues[index] = { current: initial };
      }
      return refValues[index];
    },
    useCallback(fn, deps = []) {
      const index = callbackIndex++;
      const entry = callbackValues[index];
      if (!entry || !areDepsEqual(entry.deps, deps)) {
        callbackValues[index] = { memoized: fn, deps };
      }
      return callbackValues[index].memoized;
    },
    useEffect(fn, deps) {
      const index = effectIndex++;
      const prev = effectValues[index];
      const shouldRun =
        !deps || !prev || !prev.deps || !areDepsEqual(prev.deps, deps);
      effectValues[index] = {
        fn,
        deps,
        cleanup: prev?.cleanup ?? null,
        shouldRun,
      };
    },
    cleanup() {
      effectValues.forEach((effect) => effect?.cleanup?.());
      effectValues.length = 0;
      stateValues.length = 0;
      refValues.length = 0;
      callbackValues.length = 0;
      setCurrentStore(null);
    },
  };

  return store;
}

function renderHook(callback, { initialProps } = {}) {
  const store = createStore(callback);
  store.render(initialProps || {});

  return {
    result: store.result,
    rerender(newProps = initialProps || {}) {
      store.render(newProps);
    },
    unmount() {
      store.cleanup();
    },
  };
}

function act(fn) {
  fn();
}

module.exports = { renderHook, act };
