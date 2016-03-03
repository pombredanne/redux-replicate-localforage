import localforage from 'localforage';
import { stringify, parse } from 'deserializable';

const warn = typeof console !== 'undefined'
  ? console.warn.bind(console)
  : () => {};

/**
 * Replicates the state using localforage.
 *
 * @param {Object|Function} selector Optional
 * @param {Boolean} overrideInitialState Optional
 * @return {Object}
 * @api public
 */
export default function localforageReplicator(selector, overrideInitialState) {
  return {
    init(storeKey, store, select) {
      const { _initializedLocalforage = {} } = store;
      const callback = () => (_initializedLocalforage[storeKey] = true);
      const getValue = (key, initialValue, setValue) => {
        localforage
          .getItem(`${storeKey}/${key}`)
          .then(value => {
            setValue(key, parse(value));
          }, error => {
            warn(error);
            setValue();
          });
      };

      if (!store._initializedLocalforage) {
        store._initializedLocalforage = _initializedLocalforage;
      }

      if (overrideInitialState || _initializedLocalforage[storeKey]) {
        select(selector, getValue, callback);
      } else {
        select(selector, (key, initialValue, setValue) => {
          if (typeof initialValue !== 'undefined') {
            setValue();
          } else {
            getValue(key, initialValue, setValue);
          }
        }, callback);
      }
    },

    postReduction(storeKey, select, previousState) {
      select(selector, (key, value) => {
        if (previousState[key] !== value) {
          localforage
            .setItem(`${storeKey}/${key}`, stringify(value))
            .catch(warn);
        }
      });
    }
  };
}
