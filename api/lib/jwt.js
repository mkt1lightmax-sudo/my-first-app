const jwt = require("jsonwebtoken");

const COOKIE_NAME = "session";
const EXPIRES_IN = "7d";

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set — copy .env.example to .env and fill it in");
  }
  return process.env.JWT_SECRET;
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken, COOKIE_NAME };
