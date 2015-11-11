import localforage from 'localforage';
import { unserializable, serializable, getType } from 'unserializable';

const warn = console.warn.bind(console);
const typesKey = storeKey => (`__types__::${storeKey}`);

export default {
  init(storeKey, store) {
    Promise.all([
      localforage.getItem(storeKey),
      localforage.getItem(typesKey(storeKey))
    ]).then(([serializableState, types]) => {
      const state = {};

      for (let reducer in serializableState) {
        let type = types[reducer];
        let value = serializableState[reducer];

        if (unserializable[type]) {
          state[reducer] = unserializable[type](value);
        } else {
          state[reducer] = value;
        }
      }

      store.setState(state);
    }, warn);
  },

  postDispatch(storeKey, store, action) {
    const state = { ...store.getState() };
    const types = {};

    for (let reducer in state) {
      let value = state[reducer];
      let type = getType(value);

      if (type) {
        state[reducer] = serializable[type](value);
        types[reducer] = type;
      }
    }

    Promise.all([
      localforage.setItem(storeKey, state),
      localforage.setItem(typesKey(storeKey), types)
    ]).catch(warn);
  }
};
