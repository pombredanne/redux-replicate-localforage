'use strict';

var webpack = require('webpack');

module.exports = {
  module: {
    loaders: [
      { test: /\.js$/, loaders: ['babel-loader'], exclude: /node_modules/ }
    ]
  },
  output: {
    library: 'ReduxReplicateLocalforage',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['', '.js']
  }
};
