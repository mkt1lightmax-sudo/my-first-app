const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { requirePermission, requireOwner } = require("../lib/permissions");
const { signToken, COOKIE_NAME } = require("../lib/jwt");
const { cookieOptions } = require("./auth");

const router = express.Router();

// เปลี่ยนรหัสผ่าน — เจ้าของระบบคนเดียวเท่านั้น (เปลี่ยนให้พนักงานคนไหนก็ได้ รวมถึงตัวเอง)
// เครื่องที่ล็อกอินด้วยรหัสเดิมจะถูกเตะออกทุกเครื่อง; ถ้าเปลี่ยนของตัวเอง เครื่องนี้ยังอยู่ในระบบต่อ
router.put("/:id/password", requireAuth, requireOwner, async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) return res.status(400).json({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
  if (password.length > 128) return res.status(400).json({ ok: false, error: "รหัสผ่านยาวเกินไป" });

  const target = (await query("SELECT id, name, email, role, is_owner FROM staff WHERE id = $1", [req.params.id])).rows[0];
  if (!target) return res.status(404).json({ ok: false, error: "staff not found" });

  const hash = await bcrypt.hash(password, 10);
  // ใช้เวลาของเซิร์ฟเวอร์นี้ (ไม่ใช่ now() ของฐานข้อมูล) ให้ตรงกับเวลาใน token ที่ออกให้ด้านล่าง
  await query("UPDATE staff SET password_hash = $2, password_changed_at = $3 WHERE id = $1", [target.id, hash, new Date()]);

  if (target.id === req.staff.id) {
    const token = signToken({ id: target.id, name: target.name, email: target.email, role: target.role });
    res.cookie(COOKIE_NAME, token, cookieOptions);
  }
  res.json({ ok: true, name: target.name });
});

const ROLES = ["admin", "assistant", "sales", "surveyor", "installer", "viewer"];

router.get("/", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, email, role, is_owner FROM staff ORDER BY name");
  res.json({ ok: true, staff: result.rows });
});

// เพิ่มพนักงานใหม่ — เจ้าของ/แอดมิน (สร้างแอดมินได้เฉพาะเจ้าของ)
// แก้ชื่อพนักงาน — เฉพาะเจ้าของระบบ (แก้ได้ทุกคนรวมถึงตัวเอง) ชื่อใหม่แสดงทุกหน้าทันที
router.put("/:id/name", requireAuth, requireOwner, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "กรุณากรอกชื่อ" });
  if (name.length > 60) return res.status(400).json({ ok: false, error: "ชื่อยาวเกิน 60 ตัวอักษร" });
  const result = await query("UPDATE staff SET name = $2 WHERE id = $1 RETURNING id, name, email, role, is_owner", [req.params.id, name]);
  if (!result.rows[0]) return res.status(404).json({ ok: false, error: "staff not found" });
  res.json({ ok: true, staff: result.rows[0] });
});

router.post("/", requireAuth, requirePermission("staff.manage"), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ ok: false, error: "name, email, password, role is required" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: "ตำแหน่งไม่ถูกต้อง" });
  }
  if (role === "admin" && !req.staff.is_owner) {
    return res.status(403).json({ ok: false, error: "เฉพาะเจ้าของระบบเท่านั้นที่เพิ่มแอดมินได้" });
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

// เปลี่ยนตำแหน่ง — เจ้าของเปลี่ยนได้ทุกคน, แอดมินเปลี่ยนได้เฉพาะคนที่ไม่ใช่แอดมิน และตั้งใครเป็นแอดมินไม่ได้
// มีผลทันทีทุกเครื่อง เพราะระบบเช็กตำแหน่งจากฐานข้อมูลทุกครั้ง
router.patch("/:id", requireAuth, requirePermission("staff.manage"), async (req, res) => {
  const role = req.body?.role;
  if (!ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: "ตำแหน่งไม่ถูกต้อง" });
  }
  if (Number(req.params.id) === req.staff.id) {
    return res.status(400).json({ ok: false, error: "เปลี่ยนตำแหน่งของตัวเองไม่ได้" });
  }

  const target = (await query("SELECT id, role, is_owner FROM staff WHERE id = $1", [req.params.id])).rows[0];
  if (!target) return res.status(404).json({ ok: false, error: "staff not found" });
  if (target.is_owner) {
    return res.status(403).json({ ok: false, error: "เปลี่ยนตำแหน่งเจ้าของระบบไม่ได้" });
  }
  if ((target.role === "admin" || role === "admin") && !req.staff.is_owner) {
    return res.status(403).json({ ok: false, error: "เฉพาะเจ้าของระบบเท่านั้นที่ตั้งหรือเปลี่ยนตำแหน่งแอดมินได้" });
  }

  const result = await query("UPDATE staff SET role = $2 WHERE id = $1 RETURNING id, name, email, role, is_owner", [target.id, role]);
  res.json({ ok: true, staff: result.rows[0] });
});

// ลบพนักงาน — เจ้าของ/แอดมิน (ลบตัวเองไม่ได้, ลบเจ้าของไม่ได้, ลบแอดมินได้เฉพาะเจ้าของ)
router.delete("/:id", requireAuth, requirePermission("staff.manage"), async (req, res) => {
  if (Number(req.params.id) === req.staff.id) {
    return res.status(400).json({ ok: false, error: "ลบบัญชีตัวเองไม่ได้" });
  }

  const target = await query("SELECT is_owner, role FROM staff WHERE id = $1", [req.params.id]);
  if (!target.rows[0]) {
    return res.status(404).json({ ok: false, error: "staff not found" });
  }
  if (target.rows[0].is_owner) {
    return res.status(403).json({ ok: false, error: "ลบบัญชีเจ้าของระบบไม่ได้" });
  }
  if (target.rows[0].role === "admin" && !req.staff.is_owner) {
    return res.status(403).json({ ok: false, error: "เฉพาะเจ้าของระบบเท่านั้นที่ลบแอดมินได้" });
  }

  await query("DELETE FROM staff WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
