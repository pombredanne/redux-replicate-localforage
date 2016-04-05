# redux-replicate-localforage

[![npm version](https://img.shields.io/npm/v/redux-replicate-localforage.svg?style=flat-square)](https://www.npmjs.com/package/redux-replicate-localforage)
[![npm downloads](https://img.shields.io/npm/dm/redux-replicate-localforage.svg?style=flat-square)](https://www.npmjs.com/package/redux-replicate-localforage)

Replicator for [`redux-replicate`](https://github.com/loggur/redux-replicate) designed to locally persist the state of [`redux`](https://github.com/rackt/redux) stores using [`localforage`](https://github.com/mozilla/localforage).


## Table of contents

1.  [Installation](#installation)
2.  [Usage](#usage)
3.  [Example using `react-redux-provide`](#example-using-react-redux-provide)
4.  [Example using `compose`](#example-using-compose)


## Installation

```
npm install redux-replicate-localforage --save
```


## Usage

Use with [`redux-replicate`](https://github.com/loggur/redux-replicate).


## Example using [`react-redux-provide`](https://github.com/loggur/react-redux-provide)

```js
// src/replication.js

import localforage from 'redux-replicate-localforage';
import { theme } from './providers/index';

theme.replication = {
  reducerKeys: ['themeName'],
  replicator: localforage
};
```


## Example using `compose`

```js
import { createStore, combineReducers, compose } from 'redux';
import replicate from 'redux-replicate';
import localforage from 'redux-replicate-localforage';
import reducers from './reducers';

const initialState = {
  wow: 'such storage',
  very: 'cool'
};

const key = 'superCoolStorageUnit';
const replication = replicate(key, true, localforage);
const create = compose(replication)(createStore);
const store = create(combineReducers(reducers), initialState);
```
