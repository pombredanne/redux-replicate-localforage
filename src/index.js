import localforage from 'localforage';
import { stringify, parse } from 'deserializable';

const warn = typeof console !== 'undefined'
  ? console.warn.bind(console)
  : () => {};

export default {
  getInitialState(key, setState) {
    localforage
      .getItem(key)
      .then(state => {
        setState(parse(state));
      }, error => {
        warn(error);
        setState();
      });
  },

  onStateChange(key, state, nextState, action) {
    localforage
      .setItem(key, stringify(nextState))
      .catch(warn);
  }
};
