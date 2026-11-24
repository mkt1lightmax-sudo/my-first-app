// เครื่องมือ HTML ที่ใช้ภายในทีม (เช่น ทำภาพนำเสนอลูกค้า) — ต้องล็อกอินก่อนถึงเปิดได้ เพราะมีราคาแพ็กเกจอยู่ข้างใน
// ตัวไฟล์เก็บในตาราง app_files (อัปเดตด้วย server/db/uploadTool.js) ไม่เก็บใน GitHub
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const TOOLS = new Set(["presentation"]);

router.get("/:name", requireAuth, async (req, res) => {
  if (!TOOLS.has(req.params.name)) return res.status(404).json({ ok: false, error: "not found" });
  const row = (await query("SELECT content FROM app_files WHERE name = $1", [req.params.name])).rows[0];
  if (!row) return res.status(404).send("ยังไม่ได้อัปโหลดเครื่องมือนี้");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "private, no-cache");
  res.send(row.content);
});

module.exports = router;
