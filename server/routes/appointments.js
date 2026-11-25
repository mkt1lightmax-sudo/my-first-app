const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { can, requirePermission, requireOwner } = require("../lib/permissions");
const slots = require("../lib/surveySlots");

const router = express.Router();

// งาน (ที่ไม่ยกเลิก) และวันหยุดของช่างคนนี้ ในช่วงวันที่กำหนด — ใช้เช็กคิวสำรวจ
async function loadBusy(staffIds, fromDate, toDate, excludeId = null) {
  if (!staffIds.length) return { appts: [], offs: [] };
  const appts = await query(
    `SELECT id, type, customer_name, scheduled_start, scheduled_end, assigned_staff_id
     FROM appointments
     WHERE assigned_staff_id = ANY($1) AND status <> 'cancelled'
       AND scheduled_end > ($2::date - 1)::timestamptz AND scheduled_start < ($3::date + 2)::timestamptz
       AND ($4::int IS NULL OR id <> $4)`,
    [staffIds, fromDate, toDate, excludeId]
  );
  const offs = await query(
    `SELECT staff_id, off_date::text AS off_date, period FROM staff_time_off
     WHERE staff_id = ANY($1) AND off_date BETWEEN $2 AND $3`,
    [staffIds, fromDate, toDate]
  );
  return { appts: appts.rows, offs: offs.rows };
}

// งานสำรวจ: ต้องเป็นช่องคิวมาตรฐาน และช่างต้องว่าง (ยกเว้นแอดมิน/ผู้ช่วยแอดมินเลือก "เวลาอื่น")
// คืนข้อความ error หรือ null ถ้าผ่าน
async function checkSurveyBooking(staff, appt, { override, excludeId }) {
  if (appt.type !== "site_survey" || appt.status === "cancelled") return null;
  const allowOverride = Boolean(override) && can(staff, "appointments.override");
  if (allowOverride) return null;
  if (!slots.isStandardSlot(appt.scheduled_start, appt.scheduled_end)) {
    return `งานสำรวจต้องเลือกช่องเวลา ${slots.SLOT_TIMES.join(" / ")} (ครั้งละ ${slots.SURVEY_HOURS} ชม.)`;
  }
  if (!appt.assigned_staff_id) return "กรุณาเลือกช่างสำรวจ";
  const day = slots.bangkokDate(appt.scheduled_start);
  const staffId = Number(appt.assigned_staff_id);
  const { appts, offs } = await loadBusy([staffId], day, day, excludeId);
  const reason = slots.conflictReason(slots.surveyWindow(appt.scheduled_start, appt.scheduled_end), appts, offs);
  return reason ? `ช่างไม่ว่างช่วงนี้ (${reason}) — เลือกช่องเวลาอื่น` : null;
}

// ช่องคิวสำรวจของวันนั้น: แต่ละช่องบอกว่าช่างคนไหนว่าง / ไม่ว่างเพราะอะไร
// ?date=YYYY-MM-DD&exclude=<id งานที่กำลังแก้>
router.get("/survey-slots", requireAuth, async (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: "date ต้องเป็น YYYY-MM-DD" });
  const excludeId = req.query.exclude ? Number(req.query.exclude) : null;

  const surveyors = (await query("SELECT id, name FROM staff WHERE role = 'surveyor' ORDER BY name")).rows;
  const { appts, offs } = await loadBusy(surveyors.map((s) => s.id), date, date, excludeId);

  const result = slots.SLOT_TIMES.map((time) => {
    const window = slots.slotWindow(date, time);
    const free = [];
    const busy = [];
    for (const s of surveyors) {
      const reason = slots.conflictReason(
        window,
        appts.filter((a) => a.assigned_staff_id === s.id),
        offs.filter((o) => o.staff_id === s.id)
      );
      if (reason) busy.push({ id: s.id, name: s.name, reason });
      else free.push({ id: s.id, name: s.name });
    }
    return { time, start: window.work.start.toISOString(), end: window.work.end.toISOString(), free, busy };
  });

  res.json({ ok: true, date, surveyors, slots: result });
});

const EDITABLE_FIELDS = [
  "type",
  "survey_id",
  "customer_name",
  "customer_phone",
  "customer_address",
  "map_url",
  "latitude",
  "longitude",
  "scheduled_start",
  "scheduled_end",
  "assigned_staff_id",
  "status",
  "notes",
  // ค่าสำรวจ (เปลี่ยนได้เฉพาะคนที่มีสิทธิ์ appointments.fee)
  "survey_fee",
  "survey_fee_paid",
  "survey_fee_note",
  "survey_fee_paid_at",
  "survey_fee_paid_by",
];

const FEE_FIELDS = ["survey_fee", "survey_fee_paid", "survey_fee_note"];

// ทำความสะอาดค่าสำรวจจากฟอร์ม + ใส่ว่าใครกดจ่ายแล้วเมื่อไหร่ (ไม่รับค่าพวกนี้จากหน้าเว็บตรงๆ)
function applyFeeFields(body, existing, staff) {
  delete body.survey_fee_paid_at;
  delete body.survey_fee_paid_by;
  if ("survey_fee" in body) {
    const n = Number(body.survey_fee);
    body.survey_fee = body.survey_fee === "" || body.survey_fee == null || !Number.isFinite(n) || n <= 0 ? null : n;
  }
  if ("survey_fee_note" in body) body.survey_fee_note = String(body.survey_fee_note || "").trim() || null;
  if ("survey_fee_paid" in body) {
    body.survey_fee_paid = Boolean(body.survey_fee_paid);
    const was = Boolean(existing?.survey_fee_paid);
    if (body.survey_fee_paid && !was) {
      body.survey_fee_paid_at = new Date();
      body.survey_fee_paid_by = staff.id;
    } else if (!body.survey_fee_paid && was) {
      body.survey_fee_paid_at = null;
      body.survey_fee_paid_by = null;
    }
  }
}

// มีการเปลี่ยนค่าสำรวจไหม (เทียบกับของเดิม)
function feeChanged(body, existing) {
  const norm = (f, v) => (v == null || v === "" ? "" : f === "survey_fee" ? String(Number(v)) : f === "survey_fee_paid" ? String(Boolean(v)) : String(v));
  return FEE_FIELDS.some((f) => f in body && norm(f, body[f]) !== norm(f, existing?.[f] ?? (f === "survey_fee_paid" ? false : null)));
}

const TYPE_LABELS = {
  site_survey: "สำรวจหน้างาน",
  presentation: "นำเสนองาน",
  installation: "ติดตั้ง",
};

// นัดหมายที่ผูกกับลูกค้า → เลื่อนสถานะลูกค้าตามขั้นตอนการขายให้อัตโนมัติ (ไม่ถอยหลัง, ไม่แตะลูกค้าที่ "ไม่สนใจ")
const STATUS_ORDER = ["new", "survey_booked", "quoted", "won"];
const STATUS_FOR_TYPE = { site_survey: "survey_booked", presentation: "quoted", installation: "won" };
async function advanceCustomerStatus(appointment, staffId) {
  const target = STATUS_FOR_TYPE[appointment.type];
  if (!appointment.survey_id || !target || appointment.status === "cancelled") return;
  const sv = (await query("SELECT id, status FROM surveys WHERE id = $1 AND deleted_at IS NULL", [appointment.survey_id])).rows[0];
  if (!sv || sv.status === "lost" || STATUS_ORDER.indexOf(sv.status) >= STATUS_ORDER.indexOf(target)) return;
  await query("UPDATE surveys SET status = $2, updated_at = now() WHERE id = $1", [sv.id, target]);
  await query("INSERT INTO survey_history (survey_id, staff_id, action, changes) VALUES ($1, $2, 'update', $3)", [
    sv.id,
    staffId,
    JSON.stringify({ status: { from: sv.status, to: target } }),
  ]);
}

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

  // ช่องบังคับ: เบอร์โทร, ที่อยู่หรือลิงก์แผนที่, ผู้รับผิดชอบ
  const missing = [];
  if (!/^0\d{8,9}$/.test(String(req.body.customer_phone || "").replace(/[\s-]/g, ""))) missing.push("เบอร์โทร");
  if (!String(req.body.customer_address || "").trim() && !String(req.body.map_url || "").trim()) missing.push("ที่อยู่ หรือ ลิงก์แผนที่");
  if (!req.body.assigned_staff_id) missing.push("ผู้รับผิดชอบ");
  if (missing.length) return res.status(400).json({ ok: false, error: `กรุณากรอก: ${missing.join(", ")}` });
  const mapUrl = /^https?:\/\//i.test(String(req.body.map_url || "").trim()) ? String(req.body.map_url).trim() : null;
  const hoursError = slots.workHoursError(scheduled_start, scheduled_end);
  if (hoursError) return res.status(400).json({ ok: false, error: hoursError });

  const slotError = await checkSurveyBooking(req.staff, { ...req.body, status: req.body.status ?? "scheduled" }, { override: req.body.override });
  if (slotError) return res.status(409).json({ ok: false, error: slotError });

  const result = await query(
    `INSERT INTO appointments (
       type, survey_id, customer_name, customer_phone, customer_address,
       scheduled_start, scheduled_end, assigned_staff_id, status, notes, created_by, map_url, latitude, longitude
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
      mapUrl,
      Number.isFinite(Number(req.body.latitude)) && req.body.latitude !== null && req.body.latitude !== undefined ? Number(req.body.latitude) : null,
      Number.isFinite(Number(req.body.longitude)) && req.body.longitude !== null && req.body.longitude !== undefined ? Number(req.body.longitude) : null,
    ]
  );

  let created = result.rows[0];
  if (FEE_FIELDS.some((f) => f in req.body) && feeChanged(req.body, null)) {
    if (can(req.staff, "appointments.fee")) {
      const fee = { ...req.body };
      applyFeeFields(fee, null, req.staff);
      created = (
        await query(
          `UPDATE appointments SET survey_fee = $1, survey_fee_paid = $2, survey_fee_note = $3, survey_fee_paid_at = $4, survey_fee_paid_by = $5
           WHERE id = $6 RETURNING *`,
          [fee.survey_fee ?? null, fee.survey_fee_paid ?? false, fee.survey_fee_note ?? null, fee.survey_fee_paid_at ?? null, fee.survey_fee_paid_by ?? null, created.id]
        )
      ).rows[0];
    }
  }

  await notifyAssignment(created, req.staff.id);
  await advanceCustomerStatus(created, req.staff.id);

  res.status(201).json({ ok: true, appointment: created });
});

router.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.from) {
    params.push(req.query.from);
    // งานหลายวัน: นับงานที่ยังไม่จบในช่วงนี้ด้วย (เริ่มก่อนช่วงแต่จบในช่วง)
    conditions.push(`a.scheduled_end >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    conditions.push(`a.scheduled_start <= $${params.length}`);
  }
  if (req.query.type) {
    params.push(req.query.type);
    conditions.push(`a.type = $${params.length}`);
  }
  if (req.query.assigned_staff_id) {
    params.push(req.query.assigned_staff_id);
    conditions.push(`a.assigned_staff_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`a.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT a.*, s.name AS assigned_staff_name, s.role AS assigned_staff_role,
            sv.customer_code, cs.name AS sales_name, fp.name AS survey_fee_paid_by_name
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.assigned_staff_id
     LEFT JOIN surveys sv ON sv.id = a.survey_id
     LEFT JOIN staff cs ON cs.id = sv.sales_staff_id
     LEFT JOIN staff fp ON fp.id = a.survey_fee_paid_by
     ${where}
     ORDER BY a.scheduled_start ASC`,
    params
  );
  res.json({ ok: true, appointments: result.rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.*, s.name AS assigned_staff_name, s.role AS assigned_staff_role,
            sv.customer_code, cs.name AS sales_name, fp.name AS survey_fee_paid_by_name
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.assigned_staff_id
     LEFT JOIN surveys sv ON sv.id = a.survey_id
     LEFT JOIN staff cs ON cs.id = sv.sales_staff_id
     LEFT JOIN staff fp ON fp.id = a.survey_fee_paid_by
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

  // ค่าสำรวจ: เปลี่ยนได้เฉพาะแอดมิน / ผู้ช่วยแอดมิน / เซล — คนอื่นส่งมาก็ไม่สนใจค่าที่ไม่เปลี่ยน
  if (feeChanged(req.body, existing.rows[0])) {
    if (!can(req.staff, "appointments.fee")) return res.status(403).json({ ok: false, error: "คุณแก้ค่าสำรวจไม่ได้" });
  } else {
    for (const f of FEE_FIELDS) delete req.body[f];
  }
  applyFeeFields(req.body, existing.rows[0], req.staff);

  if ("map_url" in req.body) {
    const t = String(req.body.map_url || "").trim();
    req.body.map_url = /^https?:\/\//i.test(t) ? t : null;
  }

  // เปลี่ยนเวลา / ช่าง / ประเภท / เปิดงานที่ยกเลิกกลับมา → เช็กคิวสำรวจใหม่
  // (เทียบเวลาระดับนาที เพราะฟอร์มส่งมาแค่ระดับนาที)
  const norm = (f, v) => (v == null || v === "" ? "" : f.startsWith("scheduled") ? String(Math.floor(new Date(v).getTime() / 60000)) : String(v));
  const scheduleChanged = ["type", "scheduled_start", "scheduled_end", "assigned_staff_id", "status"].some(
    (f) => f in req.body && norm(f, req.body[f]) !== norm(f, existing.rows[0][f])
  );
  // เปลี่ยนเวลา → ต้องอยู่ในเวลาทำงาน 08:00–18:00
  const timeChanged = ["scheduled_start", "scheduled_end"].some((f) => f in req.body && norm(f, req.body[f]) !== norm(f, existing.rows[0][f]));
  if (timeChanged) {
    const m = { ...existing.rows[0], ...req.body };
    const hoursError = slots.workHoursError(m.scheduled_start, m.scheduled_end);
    if (hoursError) return res.status(400).json({ ok: false, error: hoursError });
  }
  if (scheduleChanged) {
    const merged = { ...existing.rows[0], ...req.body };
    const slotError = await checkSurveyBooking(req.staff, merged, { override: req.body.override, excludeId: existing.rows[0].id });
    if (slotError) return res.status(409).json({ ok: false, error: slotError });
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
  await advanceCustomerStatus(updated, req.staff.id);
  if (updated.assigned_staff_id !== existing.rows[0].assigned_staff_id) {
    await notifyAssignment(updated, req.staff.id);
  }

  res.json({ ok: true, appointment: updated });
});

// ลบนัดหมายถาวร — เฉพาะเจ้าของระบบ (คนอื่นใช้สถานะ "ยกเลิก" แทน)
router.delete("/:id", requireAuth, requireOwner, async (req, res) => {
  const result = await query("DELETE FROM appointments WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "appointment not found" });
  }
  res.json({ ok: true });
});

module.exports = router;
