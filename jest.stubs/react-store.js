let currentStore = null;

function setCurrentStore(store) {
  currentStore = store;
}

function getCurrentStore() {
  if (!currentStore) {
    throw new Error("No active hook store. Call renderHook before using React hooks.");
  }
  return currentStore;
}

module.exports = { setCurrentStore, getCurrentStore };
