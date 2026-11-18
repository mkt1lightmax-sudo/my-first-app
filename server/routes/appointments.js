const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");
const { can, requirePermission } = require("../lib/permissions");

const router = express.Router();

const EDITABLE_FIELDS = [
  "type",
  "survey_id",
  "customer_name",
  "customer_phone",
  "customer_address",
  "scheduled_start",
  "scheduled_end",
  "assigned_staff_id",
  "status",
  "notes",
];

const TYPE_LABELS = {
  site_survey: "สำรวจหน้างาน",
  presentation: "นำเสนองาน",
  installation: "ติดตั้ง",
};

// สร้างแจ้งเตือนให้พนักงานที่ถูกมอบหมายงาน (ไม่แจ้งเตือนตัวเองถ้ามอบหมายให้ตัวเอง)
async function notifyAssignment(appointment, actingStaffId) {
  if (!appointment.assigned_staff_id || appointment.assigned_staff_id === actingStaffId) return;

  const typeLabel = TYPE_LABELS[appointment.type] ?? appointment.type;
  const date = new Date(appointment.scheduled_start).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const message = `คุณได้รับมอบหมายงาน${typeLabel}: ${appointment.customer_name} วันที่ ${date}`;

  await query("INSERT INTO notifications (staff_id, type, message, appointment_id) VALUES ($1, $2, $3, $4)", [
    appointment.assigned_staff_id,
    "appointment_assigned",
    message,
    appointment.id,
  ]);
}

router.post("/", requireAuth, requirePermission("appointments.create"), async (req, res) => {
  const { type, customer_name, scheduled_start, scheduled_end } = req.body;
  if (!type || !customer_name || !scheduled_start || !scheduled_end) {
    return res.status(400).json({ ok: false, error: "type, customer_name, scheduled_start, scheduled_end is required" });
  }

  const result = await query(
    `INSERT INTO appointments (
       type, survey_id, customer_name, customer_phone, customer_address,
       scheduled_start, scheduled_end, assigned_staff_id, status, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      req.body.type,
      req.body.survey_id ?? null,
      req.body.customer_name,
      req.body.customer_phone ?? null,
      req.body.customer_address ?? null,
      req.body.scheduled_start,
      req.body.scheduled_end,
      req.body.assigned_staff_id ?? null,
      req.body.status ?? "scheduled",
      req.body.notes ?? null,
      req.staff.id,
    ]
  );

  await notifyAssignment(result.rows[0], req.staff.id);

  res.status(201).json({ ok: true, appointment: result.rows[0] });
});

router.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.from) {
    params.push(req.query.from);
    conditions.push(`scheduled_start >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    conditions.push(`scheduled_start <= $${params.length}`);
  }
  if (req.query.type) {
    params.push(req.query.type);
    conditions.push(`type = $${params.length}`);
  }
  if (req.query.assigned_staff_id) {
    params.push(req.query.assigned_staff_id);
    conditions.push(`assigned_staff_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT a.*, s.name AS assigned_staff_name
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.assigned_staff_id
     ${where}
     ORDER BY scheduled_start ASC`,
    params
  );
  res.json({ ok: true, appointments: result.rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.*, s.name AS assigned_staff_name
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.assigned_staff_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "appointment not found" });
  }
  res.json({ ok: true, appointment: result.rows[0] });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const existing = await query("SELECT * FROM appointments WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) {
    return res.status(404).json({ ok: false, error: "appointment not found" });
  }

  // ผู้สำรวจ/ช่างติดตั้ง แก้ได้เฉพาะงานที่มอบหมายให้ตัวเอง และย้ายงานไปให้คนอื่นไม่ได้
  if (!can(req.staff, "appointments.editAny")) {
    const ownJob = can(req.staff, "appointments.editOwn") && existing.rows[0].assigned_staff_id === req.staff.id;
    if (!ownJob) {
      return res.status(403).json({ ok: false, error: "คุณไม่มีสิทธิ์แก้งานนี้" });
    }
    if ("assigned_staff_id" in req.body && Number(req.body.assigned_staff_id) !== req.staff.id) {
      return res.status(403).json({ ok: false, error: "คุณย้ายงานไปให้คนอื่นไม่ได้" });
    }
  }

  const setClauses = [];
  const params = [];
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      params.push(req.body[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) {
    return res.status(400).json({ ok: false, error: "no fields to update" });
  }
  params.push(new Date());
  setClauses.push(`updated_at = $${params.length}`);
  params.push(req.params.id);

  const result = await query(
    `UPDATE appointments SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );

  const updated = result.rows[0];
  if (updated.assigned_staff_id !== existing.rows[0].assigned_staff_id) {
    await notifyAssignment(updated, req.staff.id);
  }

  res.json({ ok: true, appointment: updated });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const result = await query("DELETE FROM appointments WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "appointment not found" });
  }
  res.json({ ok: true });
});

module.exports = router;
