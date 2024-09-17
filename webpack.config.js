const path = require('path');

module.exports = {
  entry: './client/main.js',  // Adjust this path to your actual main JS file
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    port: 3000,
    open: true
  }
};