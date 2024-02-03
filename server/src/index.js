const express = require('express');

if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env'});
}

if(process.env.SECRET_KEY === undefined) {
  console.error('Environment variable SECRET_KEY is not defined! Exiting...');
  process.exit(1);
}

const app = express();

app.get('/', (_, res) => {
  res.send('Hello World');
})

app.listen(3000, () => {
  console.log('Server is running on port 3000');
})
