const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const { signToken, COOKIE_NAME, COOKIE_OPTIONS } = require("../lib/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// จำการล็อกอิน 90 วัน (ต่ออายุอัตโนมัติเมื่อใช้งาน) — ตั้งค่าที่ lib/jwt.js
const cookieOptions = COOKIE_OPTIONS;

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email and password are required" });
  }

  const result = await query("SELECT id, name, email, password_hash, role, is_owner FROM staff WHERE email = $1", [email]);
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
  res.json({
    ok: true,
    staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role, is_owner: staff.is_owner },
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, staff: req.staff });
});

module.exports = router;
// ใช้ร่วมกับ routes อื่นที่ต้องออก cookie ล็อกอินใหม่ (เช่น เปลี่ยนรหัสผ่านตัวเอง)
module.exports.cookieOptions = cookieOptions;
