import localforage from 'localforage';
import sha from 'sha-1';
import { stringify as _stringify, parse as _parse } from 'deserializable';

const dataStore = localforage.createInstance({ name: 'data' });
const queryStore = localforage.createInstance({ name: 'queries' });

window.localforageReplicator = { dataStore, queryStore };

const hasIDB = Boolean(
  window.indexedDB
  || window.mozIndexedDB
  || window.webkitIndexedDB
  || window.msIndexedDB
);

const stringify = hasIDB ? value => value : _stringify;
const parse = hasIDB ? value => value : _parse;

const ENTIRE_STATE = '__ENTIRE_STATE__';
const EMPTY_STATE = '__EMPTY_STATE__';

const reading = {};
const writing = {};
const debounce = {};
const writingQuery = {};
let writingQueryCount = 0;
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
  if (typeof state === 'undefined') {
    state = EMPTY_STATE;
  } else {
    if (typeof state !== 'string') {
      state = hasIDB ? JSON.stringify(state) : stringify(state);
    }

    if (state.length > 40) {
      state = sha(state);
    }
  }

  return `${encodeURIComponent(reducerKey)}=${encodeURIComponent(state)}`;
}

function getInitialState({ store, reducerKey, setState, setError }) {
  const { key } = store;
  const itemKey = getItemKey(key, reducerKey);
  const handler = (error, state) => {
    if (error) {
      setError(error);
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

function onStateChange({
  store,
  reducerKey,
  nextState,
  queryable,
  setStatus,
  setError
}) {
  const { key } = store;
  const itemKey = getItemKey(key, reducerKey);
  const queryableKey = queryable && getQueryableKey(nextState, reducerKey);
  const handleError = error => {
    warn(error);
    setError(error);
  };

  writing[itemKey] = nextState;

  if (queryable) {
    writingQueryCount++;

    if (!queryBuffer) {
      queryBuffer = [];
    }
  }

  clearTimeout(debounce[itemKey]);
  debounce[itemKey] = setTimeout(() => {
    nextState = writing[itemKey];
    delete writing[itemKey];

    if (!queryable) {
      dataStore
        .setItem(itemKey, stringify(nextState))
        .then(() => setStatus())
        .catch(handleError);
      return;
    }

    Promise
      .all([
        dataStore.getItem(itemKey),
        dataStore.getItem(queryableKey),
        dataStore.setItem(itemKey, stringify(nextState))
      ])
      .then(([ prevState, keyMap ]) => {
        const prevQueryableKey = getQueryableKey(prevState, reducerKey);

        keyMap = writingQuery[queryableKey] || keyMap || {};
        keyMap[key] = true;

        writingQuery[queryableKey] = keyMap;

        Promise
          .all([
            queryStore.getItem(prevQueryableKey),
            queryStore.setItem(queryableKey, keyMap)
          ])
          .then(([ prevKeyMap ]) => {
            if (prevKeyMap && queryableKey !== prevQueryableKey) {
              prevKeyMap = writingQuery[prevQueryableKey] || prevKeyMap;
              delete prevKeyMap[key];

              writingQuery[prevQueryableKey] = prevKeyMap;

              queryStore
                .setItem(prevQueryableKey, prevKeyMap)
                .then(clearQueryBuffer)
                .then(() => setStatus())
                .catch(handleError);
            } else {
              clearQueryBuffer();
              setStatus();
            }
          })
          .catch(handleError);
      })
      .catch(handleError);
  }, localforageReplicator.debounce);
}

function clearQueryBuffer() {
  writingQueryCount--;

  if (queryBuffer && !writingQueryCount) {
    while (queryBuffer.length) {
      queryBuffer.shift()();
    }

    queryBuffer = null;
  }
}

function handleQuery({ query, options, setResult, setError }) {
  let keys = null;
  let semaphore = 1;
  const clear = () => {
    if (--semaphore === 0) {
      const { begin = 0 } = options;

      keys = Object.keys(keys);

      if (options.sortBy) {
        for (let reducerKey in options.sortBy) {
          if (options.select.indexOf(reducerKey) < 0) {
            options.select.push(reducerKey);
          }
        }

        getMultiple(keys, options.select, result => {
          for (let reducerKey in options.sortBy) {
            let ascending = options.sortBy[reducerKey] > 0;

            result.sort(ascending
              ? (a, b) => {
                if (a[reducerKey] > b[reducerKey]) {
                  return 1;
                } else if (a[reducerKey] < b[reducerKey]) {
                  return -1;
                } else {
                  return 0;
                }
              }
              : (a, b) => {
                if (a[reducerKey] < b[reducerKey]) {
                  return 1;
                } else if (a[reducerKey] > b[reducerKey]) {
                  return -1;
                } else {
                  return 0;
                }
              }
            );
          }

          if (typeof options.end !== 'undefined') {
            setResult(result.slice(begin, options.end));
          } else if (options.limit) {
            setResult(result.slice(begin, begin + options.limit));
          } else {
            setResult(result);
          }
        });
      } else if (options.length) {
        setResult(keys && keys.length || 0);
      } else if (options.keys) {
        setResult(keys);
      } else if (typeof options.end !== 'undefined') {
        setResult(result.slice(begin, options.end));
      } else if (options.limit) {
        setResult(result.slice(begin, begin + options.limit));
      } else {
        getMultiple(keys, options.select, setResult, setError);
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
              if (!keyMap || typeof keyMap[key] === 'undefined') {
                delete keys[key];
              }
            }
          } else {
            keys = keyMap || {};
          }

          clear();
        })
        .catch(error => {
          setError(error);
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

function getMultiple(keys, reducerKeys, setResult, setError) {
  const result = [];
  let error = null;
  let semaphore = keys.length * reducerKeys.length;
  const clear = () => {
    if (--semaphore === 0) {
      if (error) {
        setError(error);
      } else {
        setResult(result);
      }
    }
  };

  if (semaphore) {
    for (let key of keys) {
      let item = {};

      result.push(item);

      for (let reducerKey of reducerKeys) {
        getInitialState({
          // TODO: figure out how to pass a store to handleQuery
          store: { key },
          reducerKey,
          setState: state => {
            item[reducerKey] = state;
            clear();
          },
          setError: err => {
            error = err;
          }
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
