const { startServer } = require('./express');

if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env'});
}

if(process.env.SECRET_KEY === undefined) {
  console.error('Environment variable SECRET_KEY is not defined! Exiting...');
  process.exit(1);
}

startServer();
