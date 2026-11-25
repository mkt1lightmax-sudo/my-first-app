const jwt = require("jsonwebtoken");

const COOKIE_NAME = "session";
// จำการล็อกอิน 90 วัน และต่ออายุใหม่ทุกครั้งที่เปิดใช้ (ดู middleware/auth.js) — ใช้แอปอยู่เรื่อยๆ ก็ไม่ต้องล็อกอินใหม่
const SESSION_DAYS = 90;
const EXPIRES_IN = `${SESSION_DAYS}d`;
// ต่ออายุเมื่อ token เก่ากว่านี้ (ไม่ต้องออก cookie ใหม่ทุกคำขอ)
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};

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

module.exports = { signToken, verifyToken, COOKIE_NAME, COOKIE_OPTIONS, RENEW_AFTER_SECONDS };
