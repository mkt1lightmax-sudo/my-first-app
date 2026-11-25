// แจ้งหยุดของพนักงาน (ใช้กันคิวสำรวจ) — แจ้งของตัวเองได้ทุกคน, แอดมิน/ผู้ช่วยแอดมินแจ้งแทนคนอื่นได้
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { can } = require("../lib/permissions");

const router = express.Router();
const PERIODS = ["full", "morning", "afternoon"];
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ ok: false, error: "from / to ต้องเป็น YYYY-MM-DD" });
  const r = await query(
    `SELECT t.id, t.staff_id, s.name AS staff_name, t.off_date::text AS off_date, t.period, t.note,
            t.cover_staff_id, cv.name AS cover_name
     FROM staff_time_off t JOIN staff s ON s.id = t.staff_id LEFT JOIN staff cv ON cv.id = t.cover_staff_id
     WHERE t.off_date BETWEEN $1 AND $2
     ORDER BY t.off_date, s.name`,
    [from, to]
  );
  res.json({ ok: true, timeOff: r.rows });
});

// body: { off_date, period, note?, staff_id? } — วันเดียวกันแจ้งซ้ำ = แก้ของเดิม
router.post("/", requireAuth, async (req, res) => {
  const { off_date, period, note } = req.body || {};
  const staffId = req.body?.staff_id ? Number(req.body.staff_id) : req.staff.id;
  if (!isDate(off_date) || !PERIODS.includes(period)) {
    return res.status(400).json({ ok: false, error: "กรุณาเลือกวันที่และช่วงที่หยุด" });
  }
  if (staffId !== req.staff.id && !can(req.staff, "timeoff.manageAll")) {
    return res.status(403).json({ ok: false, error: "แจ้งหยุดแทนคนอื่นไม่ได้" });
  }
  // ฝากงานให้ (ถ้ามี) — ต้องไม่ใช่ตัวเอง
  const coverId = req.body?.cover_staff_id ? Number(req.body.cover_staff_id) : null;
  if (coverId && coverId === staffId) return res.status(400).json({ ok: false, error: "ฝากงานให้ตัวเองไม่ได้" });
  const r = await query(
    `INSERT INTO staff_time_off (staff_id, off_date, period, note, created_by, cover_staff_id) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (staff_id, off_date) DO UPDATE SET period = EXCLUDED.period, note = EXCLUDED.note, cover_staff_id = EXCLUDED.cover_staff_id
     RETURNING id, staff_id, off_date::text AS off_date, period, note, cover_staff_id`,
    [staffId, off_date, period, note || null, req.staff.id, coverId]
  );
  res.json({ ok: true, timeOff: r.rows[0] });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const row = (await query("SELECT staff_id FROM staff_time_off WHERE id = $1", [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ ok: false, error: "ไม่พบรายการ" });
  if (row.staff_id !== req.staff.id && !can(req.staff, "timeoff.manageAll")) {
    return res.status(403).json({ ok: false, error: "ยกเลิกวันหยุดของคนอื่นไม่ได้" });
  }
  await query("DELETE FROM staff_time_off WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
