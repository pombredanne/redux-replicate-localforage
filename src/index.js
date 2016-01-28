import localforage from 'localforage';
import { stringify, parse } from 'deserializable';

const warn = typeof console !== 'undefined'
  ? console.warn.bind(console)
  : () => {};

export default {
  init(storeKey, store, setReady) {
    if (!store._localforageInitialized) {
      store._localforageInitialized = {};
    }

    localforage.getItem(storeKey).then(serializedState => {
      const state = parse(serializedState);

      setReady(true);

      if (store._localforageInitialized[storeKey]) {
        store.setState(state);
      } else {
        store._localforageInitialized[storeKey] = true;
        store.setState({ ...state, ...store.getState() });
      }
    }, (error) => {
      warn(error);
      setReady(true);
    });
  },

  postReduction(storeKey, state, action) {
    const serializedState = stringify(state);

    localforage.setItem(storeKey, serializedState).catch(warn);
  }
};
