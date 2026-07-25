const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, email, role FROM staff ORDER BY name");
  res.json({ ok: true, staff: result.rows });
});

// เพิ่มพนักงานใหม่ — แอดมินเท่านั้น
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ ok: false, error: "name, email, password, role is required" });
  }

  const existing = await query("SELECT id FROM staff WHERE email = $1", [email]);
  if (existing.rows[0]) {
    return res.status(409).json({ ok: false, error: "อีเมลนี้มีบัญชีอยู่แล้ว" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO staff (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [name, email, passwordHash, role]
  );

  res.status(201).json({ ok: true, staff: result.rows[0] });
});

// ลบพนักงาน — แอดมินเท่านั้น (ลบตัวเองไม่ได้ กันล็อกตัวเองออก)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  if (Number(req.params.id) === req.staff.id) {
    return res.status(400).json({ ok: false, error: "ลบบัญชีตัวเองไม่ได้" });
  }
  const result = await query("DELETE FROM staff WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "staff not found" });
  }
  res.json({ ok: true });
});

module.exports = router;
