# redux-replicate-localforage

[![npm version](https://img.shields.io/npm/v/redux-replicate-localforage.svg?style=flat-square)](https://www.npmjs.com/package/redux-replicate-localforage)
[![npm downloads](https://img.shields.io/npm/dm/redux-replicate-localforage.svg?style=flat-square)](https://www.npmjs.com/package/redux-replicate-localforage)

Replicator for [`redux-replicate`](https://github.com/loggur/redux-replicate) designed to locally persist the state of [`redux`](https://github.com/rackt/redux) stores using [`localforage`](https://github.com/mozilla/localforage).


## Installation

```
npm install redux-replicate redux-replicate-localforage --save
```


## Usage

Use with [`redux-replicate`](https://github.com/loggur/redux-replicate).


## Example using `compose`

```js
import { createStore, combineReducers, compose } from 'redux';
import replicate from 'redux-replicate';
import localforageReplicator from 'redux-replicate-localforage';
import reducers from './reducers';

const initialState = {
  wow: 'such storage',
  very: 'cool'
};

const storeKey = 'superCoolStorageUnit';
const replication = replicate(storeKey, localforageReplicator);
const create = compose(replication)(createStore);
const store = create(combineReducers(reducers), initialState);
```


## Example using [`react-redux-provide`](https://github.com/loggur/react-redux-provide)

```js
import React from 'react';
import ReactDOM from 'react-dom';
import { assignProviders } from 'react-redux-provide';
import provideMap from 'react-redux-provide-map';
import replicate from 'redux-replicate';
import localforageReplicator from 'redux-replicate-localforage';
import App from './components/App';

const coolMap = {
  ...provideMap('coolMap', 'coolItem'),
  enhancer: replicate('coolMap', localforageReplicator)
};

assignProviders({ coolMap }, { App });

ReactDOM.render(<App/>, document.getElementById('root'));
```
