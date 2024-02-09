const express = require("express");
const jwt = require("jsonwebtoken");
const uber_eats_puppeteer = require("./puppeteer");

const idempotentKeys = new Set();
let mostRecentOrder = undefined;

/**
 * Runs checks on the passed JWT token to ensure it is valid
 * @param {string} jwt_token The JWT token to validate
 * @throws {Error} If the token is invalid
 */
const jwtGuard = (jwt_token) => {
  const token = jwt.verify(jwt_token, process.env.SECRET_KEY);
  if (
    token.aud !== process.env.JWT_AUDIENCE ||
    token.iss !== process.env.JWT_ISSUER ||
    token.sub !== process.env.JWT_SUBJECT ||
    !token.jti
  ) {
    throw new Error("Invalid token");
  }
  if (token.iat > Date.now() || token.exp < Date.now()) {
    throw new Error("Token expired");
  }
  if (idempotentKeys.has(token.jti)) {
    throw new Error("Idempotent key already used");
  }
  idempotentKeys.add(token.jti);
};

/**
 * Performs authorization checks on the request by looking at the Authorization header. Response will be sent with code 401 'Unauthorized' if any checks fail.
 * @param {express.Request} req The express request object
 * @param {express.Response} res The express response object
 * @returns {jwt.JwtPayload | undefined} The decoded JWT token if it was valid, undefined otherwise
 */
const authorizationCheck = (req, res) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    console.info("No authorization header");
    res.status(401).send("Unauthorized");
    return undefined;
  }

  const tokens = authorization.split(" ");
  if (tokens.length !== 2 || tokens[0] !== "Bearer") {
    console.info("Invalid authorization header");
    res.status(401).send("Unauthorized");
    return undefined;
  }

  const jwt_token = tokens[1];
  try {
    jwtGuard(jwt_token);
  } catch (error) {
    console.info(error.message);
    res.status(401).send("Unauthorized");
    return undefined;
  }

  return jwt.decode(jwt_token);
};

/**
 * Runs through the process of creating an Uber Eats order, but does not actually place the order. This is useful for testing the process without actually placing an order.
 * @param {express.Request} req The express request object
 * @param {express.Response} res The express response object
 */
const orderDryRunHandler = async (req, res) => {
  const token = authorizationCheck(req, res);
  if (!token) return;

  res.status(204).send("No Content");
};

/**
 * Creates an Uber Eats order. This will validate the request and, if successful, place an Uber Eats order. The response will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @param {express.Request} req The express request object
 * @param {express.Response} res The express response object
 */
const orderHandler = (req, res) => {
  const token = authorizationCheck(req, res);
  if (!token) return;

  if (
    uber_eats_puppeteer.getUberEatsOrderStatus(mostRecentOrder)?.status === 200
  ) {
    res.status(409).send("Conflict");
    reutrn;
  }

  mostRecentOrder = token.jti;
  res.status(202).send("Accepted");
  uber_eats_puppeteer.createUberEatsOrder(token.jti, () => {});
};

/**
 * Gets the response for a given order ID previously created by calling PUT to /order.
 * @param {express.Request} req The express request object
 * @param {express.Response} res The express response object
 */
const orderGetter = (req, res) => {
  const id = req.query.id;
  const response = uber_eats_puppeteer.getUberEatsOrderStatus(
    id ?? mostRecentOrder
  );
  if (!response) {
    res.status(404).send({ status: 404, message: "Not Found" });
    return;
  }
  res.status(response.status).send(response);
};

const app = express();
let server;

/**
 * Starts the Uber Eats order application server on port 3000.
 */
const startServer = () => {
  if (server) return;

  app.get("/", (_, res) => {
    res.send("Hello World");
  });
  app.put("/order-dry-run", orderDryRunHandler);
  app.put("/order", orderHandler);
  app.get("/order", orderGetter);
  app.get("/order-status", (_, res) => {
    res.sendFile("static/order.html", { root: __dirname });
  });
  app.get("/loading.svg", (_, res) => {
    res.sendFile("static/loading.svg", { root: __dirname });
  });
  app.get("/success.png", (_, res) => {
    res.sendFile("static/success.png", { root: __dirname });
  });
  app.get("/error.png", (_, res) => {
    res.sendFile("static/error.png", { root: __dirname });
  });

  server = app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
};

const stopServer = () => {
  if (!server) return;

  server.close();
  server.unref();
  server = undefined;
};

module.exports = {
  startServer,
  stopServer,
};
