import localforage from 'localforage';
import sha from 'sha-1';
import { stringify as _stringify, parse as _parse } from 'deserializable';

const hasIDB = Boolean(
  typeof window !== 'undefined'
  && (
    window.indexedDB
    || window.mozIndexedDB
    || window.webkitIndexedDB
    || window.msIndexedDB
  )
);

const stringify = hasIDB ? value => value : _stringify;
const parse = hasIDB ? value => value : _parse;

const ENTIRE_STATE = '__ENTIRE_STATE__';
const EMPTY_STATE = '__EMPTY_STATE__';

const dataStore = localforage.createInstance({ name: 'data' });
const queryStore = localforage.createInstance({ name: 'queries' });

const reading = {};
const writing = {};
const debounce = {};
let queryBuffer = null;

const warn = typeof console !== 'undefined'
  ? console.warn.bind(console)
  : () => {};

function getItemKey(key, reducerKey) {
  if (reducerKey) {
    return `${key}/${reducerKey}`;
  }

  return key;
}

function getQueryableKey(state, reducerKey = ENTIRE_STATE) {
  if (typeof state !== 'string') {
    if (hasIDB) {
      state = JSON.stringify(state);
    } else {
      state = stringify(state);
    }
  }

  if (state.length > 40) {
    state = sha(state);
  }

  return `${encodeURIComponent(reducerKey)}=${encodeURIComponent(state)}`;
}

function getInitialState({ key, reducerKey }, setState) {
  const itemKey = getItemKey(key, reducerKey);
  const handler = (error, state) => {
    if (error) {
      warn(error);
      setState();
    } else if (typeof state === 'undefined' || state === null) {
      setState();
    } else {
      setState(parse(state));
    }
  };

  if (reading[itemKey]) {
    reading[itemKey].push(handler);
  } else {
    reading[itemKey] = [ handler ];

    function clearHandlers(error, state) {
      if (typeof writing[itemKey] !== 'undefined') {
        state = writing[itemKey];
      }

      const handlers = reading[itemKey];

      delete reading[itemKey];

      while (handlers.length) {
        handlers.shift()(error, state);
      }
    }

    dataStore
      .getItem(itemKey)
      .then(state => {
        clearHandlers(null, state);
      })
      .catch(error => {
        clearHandlers(error);
      });
  }
}

function onStateChange({ key, reducerKey, queryable }, state, nextState) {
  const itemKey = getItemKey(key, reducerKey);

  writing[itemKey] = nextState;

  if (queryable && !queryBuffer) {
    queryBuffer = [];
  }

  clearTimeout(debounce[itemKey]);
  debounce[itemKey] = setTimeout(() => {
    nextState = writing[itemKey];
    delete writing[itemKey];

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
              queryStore
                .setItem(prevQueryableKey, prevKeyMap)
                .then(clearQueryBuffer)
                .catch(warn);
            } else {
              clearQueryBuffer();
            }
          })
          .catch(warn);
      })
      .catch(warn);
  }, localforageReplicator.debounce);
}

function clearQueryBuffer() {
  if (queryBuffer) {
    while (queryBuffer.length) {
      queryBuffer.shift()();
    }

    queryBuffer = null;
  }
}

function handleQuery(query, options, setResult) {
  let keys = null;
  let semaphore = 1;
  const clear = () => {
    if (--semaphore === 0) {
      keys = Object.keys(keys);

      if (options.length) {
        setResult(keys && keys.length || 0);
      } else if (options.keys) {
        setResult(keys);
      } else {
        getMultiple(keys, options.select, setResult);
      }
    }
  };

  if (typeof query !== 'object') {
    query = { [ENTIRE_STATE]: query };
  }

  Object.keys(query).forEach(reducerKey => {
    const contents = query[reducerKey];
    const queryableKey = getQueryableKey(contents, reducerKey, false);
    function queryHandler() {
      queryStore
        .getItem(queryableKey)
        .then(keyMap => {
          if (keys) {
            for (let key in keys) {
              if (typeof keyMap[key] === 'undefined') {
                delete keys[key];
              }
            }
          } else {
            keys = keyMap || {};
          }

          clear();
        })
        .catch(error => {
          warn(error);
          clear();
        });
    }

    semaphore++;

    if (queryBuffer) {
      queryBuffer.push(queryHandler);
    } else {
      queryHandler();
    }
  });

  clear();
}

function getMultiple(keys, reducerKeys, setResult) {
  const result = [];
  let semaphore = keys.length * reducerKeys.length;
  const clear = () => {
    if (--semaphore === 0) {
      setResult(result);
    }
  };

  if (semaphore) {
    for (let key of keys) {
      let item = {};

      result.push(item);

      for (let reducerKey of reducerKeys) {
        getInitialState({ key, reducerKey }, state => {
          item[reducerKey] = state;
          clear();
        });
      }
    }
  } else {
    semaphore = 1;
    clear();
  }
}

const localforageReplicator = {
  getInitialState, onStateChange, handleQuery, debounce: 10
};

export default localforageReplicator;
