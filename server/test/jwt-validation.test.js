const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { startServer, stopServer } = require('../src/express');
beforeAll(startServer);
afterAll(async () => {
  await new Promise((resolve) => setTimeout(() => resolve(), 500)); // avoid jest open handle error
  stopServer();
});

test('jwt validation success', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);
  
  expect(() => jwt.verify(jwt_token, process.env.SECRET_KEY)).not.toThrow();
  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(204);
  });
});

test('no authorization header', () => {
  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT'
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('wrong authorization type', () => {
  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic YmVuOTU4MzpiZW45NTgz'
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('missing authorization type', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': jwt_token
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('missing sub claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('wrong sub claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    sub: 'wrong-sub',
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('missing iss claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('wrong iss claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: 'wrong-iss',
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('missing aud claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('wrong aud claim', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({
    aud: 'wrong-aud',
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('missing jti claim', () => {
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(401);
  });
});

test('duplicate jwt', () => {
  const jti = uuid.v4();
  const jwt_token = jwt.sign({ 
    aud: process.env.JWT_AUDIENCE,
    iss: process.env.JWT_ISSUER,
    sub: process.env.JWT_SUBJECT, 
    jti,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60
  }, process.env.SECRET_KEY);

  return fetch('http://localhost:3000/order-dry-run', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  }).then(res => {
    expect(res.status).toBe(204);
    return fetch('http://localhost:3000/order-dry-run', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwt_token}`
      }
    })
  }).then(res => {
    expect(res.status).toBe(401);
  });
});
