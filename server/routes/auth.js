const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const { signToken, COOKIE_NAME } = require("../lib/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
};

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email and password are required" });
  }

  const result = await query("SELECT id, name, email, password_hash, role FROM staff WHERE email = $1", [email]);
  const staff = result.rows[0];
  if (!staff) {
    return res.status(401).json({ ok: false, error: "invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, staff.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ ok: false, error: "invalid email or password" });
  }

  const token = signToken({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ ok: true, staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role } });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, staff: req.staff });
});

module.exports = router;
