const express = require('express');
const jwt = require('jsonwebtoken');

if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env'});
}

if(process.env.SECRET_KEY === undefined) {
  console.error('Environment variable SECRET_KEY is not defined! Exiting...');
  process.exit(1);
}

const idempotentKeys = new Set();

const jwtGuard = (jwt_token) => {
  const token = jwt.verify(jwt_token, process.env.SECRET_KEY);
  if(token.aud !== process.env.JWT_AUDIENCE || token.iss !== process.env.JWT_ISSUER || token.sub !== process.env.JWT_SUBJECT) {
    throw new Error('Invalid token');
  }
  if(idempotentKeys.has(token.jti)) {
    throw new Error('Idempotent key already used');
  }
  idempotentKeys.add(token.jti);
}

const app = express();

app.get('/', (_, res) => {
  res.send('Hello World');
})

app.put('/order', (req, res) => {
  const authorization = req.headers.authorization;
  if(!authorization) {
    console.debug('No authorization header');
    return res.status(401).send('Unauthorized');
  }

  const tokens = authorization.split(' ');
  if(tokens.length !== 2 || tokens[0] !== 'Bearer') {
    console.debug('Invalid authorization header');
    return res.status(401).send('Unauthorized');
  }

  const jwt_token = tokens[1];
  try { jwtGuard() } catch (error) {
    console.debug('Invalid token');
    return res.status(401).send('Unauthorized');
  }

  const token = jwt.decode(jwt_token);
  
})

app.listen(3000, () => {
  console.log('Server is running on port 3000');
})
