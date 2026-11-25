const express = require("express");
const { query } = require("../db/pool");
const { calculateSolarRecommendation } = require("../lib/solarCalculator");
const { requireAuth } = require("../middleware/auth");
const { can, requirePermission } = require("../lib/permissions");

const router = express.Router();

// ฟิลด์ทั้งหมดที่แก้ไขได้ตรงๆ จาก request body (ไม่รวมฟิลด์ระบบ เช่น id, ผลคำนวณ, created_by, timestamps)
const EDITABLE_FIELDS = [
  "customer_name",
  "customer_phone",
  "customer_address",
  "map_url",
  "sales_staff_id",
  "latitude",
  "longitude",
  // หมวด 1: ประเภทสถานที่
  "site_type",
  "site_type_other",
  "business_type",
  "business_hours",
  // หมวด 2: ข้อมูลค่าไฟ
  "bill_range",
  "monthly_bill_thb",
  "monthly_usage_kwh",
  "can_send_bill",
  "peak_usage_time",
  "weekend_usage",
  // หมวด 3: อุปกรณ์ไฟฟ้าหลัก
  "main_equipment",
  "main_equipment_other",
  "ac_count",
  "ac_size",
  "ac_simultaneous_count",
  "ac_usage_start",
  "ac_usage_end",
  "ac_daily_hours",
  "ac_usage_period",
  "other_equipment_type",
  "other_equipment_count",
  "other_equipment_usage_time",
  // หมวด 4: ข้อมูลระบบไฟ
  "meter_type",
  // หมวด 5: ความต้องการของลูกค้า
  "customer_needs",
  "interested_system",
  "budget",
  "install_timeline",
  // หมวด 6: ข้อมูลหน้างาน
  "roof_type",
  "roof_type_other",
  "shading_presence",
  "requested_photos",
  "roof_area_sqm",
  "roof_direction",
  "shading_level",
  // หมวด 7: สรุปสำหรับทีมประเมิน
  "battery_interest",
  "documents_received",
  // ผลจากหน้าคำนวณเทียบ On-Grid vs Hybrid+Battery
  "recommended_system_type",
  "recommended_battery_kwh",
  "notes",
  "status",
];

// ช่องบังคับ: ชื่อ, เบอร์โทร (ตัวเลข 9–10 หลัก), ที่อยู่หรือลิงก์แผนที่ — คืนข้อความ error หรือ null
function validateRequired(s) {
  const missing = [];
  if (!String(s.customer_name || "").trim()) missing.push("ชื่อลูกค้า");
  const phone = String(s.customer_phone || "").replace(/[\s-]/g, "");
  if (!/^0\d{8,9}$/.test(phone)) missing.push("เบอร์โทร (ตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0)");
  if (!String(s.customer_address || "").trim() && !String(s.map_url || "").trim()) missing.push("ที่อยู่ หรือ ลิงก์แผนที่");
  return missing.length ? `กรุณากรอก: ${missing.join(", ")}` : null;
}

// ลิงก์แผนที่ต้องเป็น http(s) เท่านั้น (กันลิงก์แปลกๆ)
function cleanMapUrl(v) {
  const t = String(v || "").trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : null;
}

// แก้ได้ไหม: แอดมิน/เจ้าของแก้ได้ทุกคน, คนอื่นแก้ได้เฉพาะลูกค้าที่ตัวเองสร้าง หรือได้รับมอบหมายงานของลูกค้านี้
async function canEditSurvey(staff, survey) {
  if (can(staff, "customers.editAll")) return true;
  if (!can(staff, "customers.edit")) return false;
  if (survey.created_by === staff.id || survey.sales_staff_id === staff.id) return true;
  const r = await query("SELECT 1 FROM appointments WHERE survey_id = $1 AND assigned_staff_id = $2 LIMIT 1", [survey.id, staff.id]);
  return r.rows.length > 0;
}
const NOT_YOURS = { ok: false, error: "แก้ได้เฉพาะลูกค้าที่คุณสร้างหรือได้รับมอบหมาย — ถ้าต้องแก้ ติดต่อแอดมิน" };

// เทียบค่าเก่า/ใหม่ เพื่อเก็บประวัติเฉพาะช่องที่เปลี่ยนจริง
const normValue = (v) => (v == null || v === "" || (Array.isArray(v) && v.length === 0) ? null : Array.isArray(v) ? JSON.stringify(v) : String(v));
function diffFields(before, after) {
  const changes = {};
  for (const f of EDITABLE_FIELDS) {
    if (!(f in after)) continue;
    if (normValue(before[f]) !== normValue(after[f])) changes[f] = { from: before[f] ?? null, to: after[f] ?? null };
  }
  return changes;
}

async function logHistory(surveyId, staffId, action, changes = null) {
  await query("INSERT INTO survey_history (survey_id, staff_id, action, changes) VALUES ($1, $2, $3, $4)", [
    surveyId,
    staffId,
    action,
    changes ? JSON.stringify(changes) : null,
  ]);
}

const TRASH_DAYS = 30;

// รหัสลูกค้าถัดไปของเดือนนี้: LM-ปีพ.ศ.2หลัก+เดือน-ลำดับ เช่น LM-6911-004
async function nextCustomerCode() {
  const now = new Date();
  const y = Number(now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" })) + 543;
  const m = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok", month: "2-digit" });
  const prefix = `LM-${String(y).slice(-2)}${m}`;
  const r = await query(
    "SELECT COALESCE(MAX(split_part(customer_code, '-', 3)::int), 0) AS n FROM surveys WHERE customer_code LIKE $1",
    [`${prefix}-%`]
  );
  return `${prefix}-${String(r.rows[0].n + 1).padStart(3, "0")}`;
}

// ฟอร์มจริงถาม "มีร่มเงาไหม" แบบ 3 ตัวเลือก (none/yes/unsure) แต่เครื่องคำนวณต้องการระดับความเข้ม 4 ระดับ
// ถ้าเลือก "มี" ใช้ระดับที่กรอกเพิ่ม (shading_level), ถ้า "ไม่แน่ใจ" ใช้ moderate แบบระมัดระวังไว้ก่อน
function resolveShadingLevel({ shading_presence, shading_level }) {
  if (shading_presence === "none") return "none";
  if (shading_presence === "yes") return shading_level || "moderate";
  if (shading_presence === "unsure") return "moderate";
  return shading_level || "none";
}

// คำนวณผลลัพธ์จาก input ของ survey แล้วคืน object ที่พร้อมเซฟ (ไม่ throw ถ้าข้อมูลยังไม่พอคำนวณ — แค่ปล่อยเป็น null)
function tryCalculate(survey) {
  try {
    const result = calculateSolarRecommendation({
      monthly_bill_thb: survey.monthly_bill_thb,
      monthly_usage_kwh: survey.monthly_usage_kwh,
      roof_area_sqm: survey.roof_area_sqm,
      roof_direction: survey.roof_direction,
      shading_level: resolveShadingLevel(survey),
    });
    return {
      recommended_kwp: result.recommended_kwp,
      recommended_panel_count: result.recommended_panel_count,
      estimated_monthly_savings_thb: result.estimated_monthly_savings_thb,
      estimated_payback_years: result.estimated_payback_years,
      roof_area_limited: result.roof_area_limited,
      calculated_at: new Date(),
    };
  } catch {
    return {
      recommended_kwp: null,
      recommended_panel_count: null,
      estimated_monthly_savings_thb: null,
      estimated_payback_years: null,
      roof_area_limited: null,
      calculated_at: null,
    };
  }
}

router.post("/", requireAuth, requirePermission("customers.create"), async (req, res) => {
  if ("map_url" in req.body) req.body.map_url = cleanMapUrl(req.body.map_url);
  const invalid = validateRequired(req.body);
  if (invalid) return res.status(400).json({ ok: false, error: invalid });
  // เซลผู้ดูแล: แอดมิน/ผู้ช่วยแอดมินเลือกได้ — คนอื่นถ้าเป็นเซลจะเป็นของตัวเอง
  if (can(req.staff, "customers.assignSales") && req.body.sales_staff_id) req.body.sales_staff_id = Number(req.body.sales_staff_id);
  else req.body.sales_staff_id = req.staff.role === "sales" ? req.staff.id : null;

  const calc = tryCalculate(req.body);

  const columns = ["created_by"];
  const params = [req.staff.id];
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      columns.push(field);
      params.push(req.body[field]);
    }
  }
  for (const [field, value] of Object.entries(calc)) {
    columns.push(field);
    params.push(value);
  }

  // ออกรหัสลูกค้า — ถ้าชนกับคนที่บันทึกพร้อมกัน ลองใหม่ด้วยเลขถัดไป
  columns.push("customer_code");
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  let result;
  for (let attempt = 0; ; attempt++) {
    try {
      result = await query(`INSERT INTO surveys (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`, [
        ...params,
        await nextCustomerCode(),
      ]);
      break;
    } catch (err) {
      if (err.code !== "23505" || attempt >= 4) throw err;
    }
  }

  await logHistory(result.rows[0].id, req.staff.id, "create");
  res.status(201).json({ ok: true, survey: result.rows[0] });
});

router.get("/", requireAuth, async (req, res) => {
  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${String(req.query.q).trim()}%`);
    conditions.push(`(customer_code ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR customer_phone ILIKE $${params.length})`);
  }
  if (req.query.sales_staff_id) {
    params.push(req.query.sales_staff_id);
    conditions.push(`sales_staff_id = $${params.length}`);
  }
  if (req.query.created_by) {
    params.push(req.query.created_by);
    conditions.push(`created_by = $${params.length}`);
  }

  const where = `WHERE ${conditions.map((c) => c.replace(/\b(deleted_at|status|created_by|sales_staff_id|customer_code|customer_name|customer_phone)\b/g, "s.$1")).join(" AND ")}`;
  const result = await query(
    `SELECT s.*, st.name AS created_by_name, ss.name AS sales_name
     FROM surveys s LEFT JOIN staff st ON st.id = s.created_by LEFT JOIN staff ss ON ss.id = s.sales_staff_id
     ${where} ORDER BY s.created_at DESC`,
    params
  );

  // ผู้สร้างแต่ละคน + จำนวนลูกค้า (สำหรับตัวกรอง — เจ้าของ/แอดมิน/ผู้ช่วยแอดมิน)
  let creators = [];
  if (can(req.staff, "customers.filterByStaff")) {
    creators = (
      await query(
        `SELECT st.id, st.name, COUNT(s.id)::int AS count
         FROM surveys s JOIN staff st ON st.id = s.sales_staff_id
         WHERE s.deleted_at IS NULL GROUP BY st.id, st.name ORDER BY count DESC, st.name`
      )
    ).rows;
  }
  res.json({ ok: true, surveys: result.rows, creators });
});

// ถังขยะ (แอดมิน): ลูกค้าที่ถูกลบภายใน 30 วัน — เกิน 30 วันลบถาวรตอนเปิดหน้านี้
router.get("/trash", requireAuth, requirePermission("customers.editAll"), async (req, res) => {
  await query(`DELETE FROM surveys WHERE deleted_at < now() - interval '${TRASH_DAYS} days'`);
  const r = await query(
    `SELECT s.id, s.customer_name, s.customer_phone, s.customer_address, s.deleted_at, d.name AS deleted_by_name,
            s.deleted_at + interval '${TRASH_DAYS} days' AS purge_at
     FROM surveys s LEFT JOIN staff d ON d.id = s.deleted_by
     WHERE s.deleted_at IS NOT NULL ORDER BY s.deleted_at DESC`
  );
  res.json({ ok: true, surveys: r.rows, days: TRASH_DAYS });
});

router.post("/:id/restore", requireAuth, requirePermission("customers.editAll"), async (req, res) => {
  const r = await query("UPDATE surveys SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id", [
    req.params.id,
  ]);
  if (!r.rows[0]) return res.status(404).json({ ok: false, error: "ไม่พบในถังขยะ" });
  await logHistory(r.rows[0].id, req.staff.id, "restore");
  res.json({ ok: true });
});

// ประวัติการแก้ไขของลูกค้าคนนี้
router.get("/:id/history", requireAuth, async (req, res) => {
  const r = await query(
    `SELECT h.id, h.action, h.changes, h.created_at, st.name AS staff_name
     FROM survey_history h LEFT JOIN staff st ON st.id = h.staff_id
     WHERE h.survey_id = $1 ORDER BY h.created_at DESC LIMIT 100`,
    [req.params.id]
  );
  // เปลี่ยนเซลผู้ดูแล: แสดงเป็นชื่อแทนเลขรหัส
  const ids = new Set();
  for (const h of r.rows) {
    const c = h.changes?.sales_staff_id;
    if (c) [c.from, c.to].forEach((v) => v && ids.add(Number(v)));
  }
  if (ids.size) {
    const names = Object.fromEntries(
      (await query("SELECT id, name FROM staff WHERE id = ANY($1)", [[...ids]])).rows.map((x) => [x.id, x.name])
    );
    for (const h of r.rows) {
      const c = h.changes?.sales_staff_id;
      if (c) h.changes.sales_staff_id = { from: names[c.from] ?? c.from, to: names[c.to] ?? c.to };
    }
  }
  res.json({ ok: true, history: r.rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT s.*, st.name AS created_by_name, ss.name AS sales_name
     FROM surveys s LEFT JOIN staff st ON st.id = s.created_by LEFT JOIN staff ss ON ss.id = s.sales_staff_id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [req.params.id]
  );
  const survey = result.rows[0];
  if (!survey) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }

  // คำนวณผลลัพธ์แบบเต็ม (รวม install cost / generation ที่ไม่ได้เก็บลง DB) จาก input ที่บันทึกไว้
  let calculation = null;
  try {
    calculation = calculateSolarRecommendation({
      ...survey,
      shading_level: resolveShadingLevel(survey),
    });
  } catch {
    calculation = null;
  }

  res.json({ ok: true, survey, calculation, canEdit: await canEditSurvey(req.staff, survey) });
});

router.patch("/:id", requireAuth, requirePermission("customers.edit"), async (req, res) => {
  const existing = await query("SELECT * FROM surveys WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
  if (!existing.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }
  if (!(await canEditSurvey(req.staff, existing.rows[0]))) return res.status(403).json(NOT_YOURS);
  if ("map_url" in req.body) req.body.map_url = cleanMapUrl(req.body.map_url);
  if ("sales_staff_id" in req.body) {
    const next = req.body.sales_staff_id ? Number(req.body.sales_staff_id) : null;
    if (next !== existing.rows[0].sales_staff_id && !can(req.staff, "customers.assignSales")) {
      return res.status(403).json({ ok: false, error: "เปลี่ยนเซลผู้ดูแลได้เฉพาะแอดมินและผู้ช่วยแอดมิน" });
    }
    req.body.sales_staff_id = next;
  }

  const merged = { ...existing.rows[0], ...req.body };
  // แก้ข้อมูลติดต่อ → ต้องยังครบตามช่องบังคับ
  // (ปักหมุดอย่างเดียว ไม่ต้องเช็ก — ช่างหน้างานต้องบันทึกตำแหน่งได้เสมอ)
  if (["customer_name", "customer_phone", "customer_address"].some((f) => f in req.body)) {
    const invalid = validateRequired(merged);
    if (invalid) return res.status(400).json({ ok: false, error: invalid });
  }
  const changes = diffFields(existing.rows[0], req.body);
  const calc = tryCalculate(merged);

  const setClauses = [];
  const params = [];
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      params.push(req.body[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }
  for (const [field, value] of Object.entries(calc)) {
    params.push(value);
    setClauses.push(`${field} = $${params.length}`);
  }
  params.push(new Date());
  setClauses.push(`updated_at = $${params.length}`);
  params.push(req.params.id);

  const result = await query(
    `UPDATE surveys SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (Object.keys(changes).length) await logHistory(existing.rows[0].id, req.staff.id, "update", changes);
  res.json({ ok: true, survey: result.rows[0] });
});

router.post("/:id/calculate", requireAuth, requirePermission("customers.edit"), async (req, res) => {
  const existing = await query("SELECT * FROM surveys WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
  if (!existing.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }
  if (!(await canEditSurvey(req.staff, existing.rows[0]))) return res.status(403).json(NOT_YOURS);

  try {
    const result = calculateSolarRecommendation({
      ...existing.rows[0],
      shading_level: resolveShadingLevel(existing.rows[0]),
    });
    const updated = await query(
      `UPDATE surveys SET
         recommended_kwp = $1, recommended_panel_count = $2, estimated_monthly_savings_thb = $3,
         estimated_payback_years = $4, roof_area_limited = $5, calculated_at = now(), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [
        result.recommended_kwp,
        result.recommended_panel_count,
        result.estimated_monthly_savings_thb,
        result.estimated_payback_years,
        result.roof_area_limited,
        req.params.id,
      ]
    );
    res.json({ ok: true, survey: updated.rows[0] });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ลบ = ย้ายไปถังขยะ (กู้คืนได้ 30 วัน) — เฉพาะเจ้าของ/แอดมิน
router.delete("/:id", requireAuth, requirePermission("customers.editAll"), async (req, res) => {
  const result = await query(
    "UPDATE surveys SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [req.params.id, req.staff.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }
  await logHistory(result.rows[0].id, req.staff.id, "delete");
  res.json({ ok: true });
});

module.exports = router;
