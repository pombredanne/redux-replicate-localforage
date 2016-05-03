import localforage from 'localforage';
import sha from 'sha-1';
import { stringify, parse } from 'deserializable';

const dataStore = localforage.createInstance({ name: 'data' });
const queryStore = localforage.createInstance({ name: 'queries' });

const warn = typeof console !== 'undefined'
  ? console.warn.bind(console)
  : () => {};

function getItemKey(key, reducerKey) {
  if (reducerKey) {
    return `${key}/${reducerKey}`;
  }

  return key;
}

function getQueryableKey(state, reducerKey = '__ENTIRE_STATE__') {
  if (typeof state !== 'string') {
    state = stringify(state);
  }

  if (state.length > 40) {
    state = sha(state);
  }

  return `${encodeURIComponent(reducerKey)}=${encodeURIComponent(state)}`;
}

export default {
  getInitialState({ key, reducerKey }, setState) {
    const itemKey = getItemKey(key, reducerKey);

    dataStore
      .getItem(itemKey)
      .then(state => {
        if (state === null) {
          setState();
        } else {
          setState(parse(state));
        }
      })
      .catch(error => {
        warn(error);
        setState();
      });
  },

  onStateChange({ key, reducerKey, queryable }, state, nextState) {
    const itemKey = getItemKey(key, reducerKey);

    if (!queryable) {
      dataStore
        .setItem(itemKey, stringify(nextState))
        .catch(warn);
      return;
    }

    const queryableKey = getQueryableKey(nextState, reducerKey);

    Promise
      .all([
        dataStore.getItem(itemKey),
        dataStore.getItem(queryableKey),
        dataStore.setItem(itemKey, stringify(nextState))
      ])
      .then(([ prevState, keyMap ]) => {
        const prevQueryableKey = getQueryableKey(prevState, reducerKey);

        keyMap = keyMap || {};
        keyMap[key] = true;

        Promise
          .all([
            queryStore.getItem(prevQueryableKey),
            queryStore.setItem(queryableKey, keyMap)
          ])
          .then(([ prevKeyMap ]) => {
            if (prevKeyMap && queryableKey !== prevQueryableKey) {
              delete prevKeyMap[key];
              queryStore.setItem(prevQueryableKey, prevKeyMap);
            }
          })
          .catch(warn);
      })
      .catch(warn);
  },

  handleQuery(query, setResult) {

  }
};
