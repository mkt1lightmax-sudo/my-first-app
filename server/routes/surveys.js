const express = require("express");
const { query } = require("../db/pool");
const { calculateSolarRecommendation } = require("../lib/solarCalculator");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// ฟิลด์ทั้งหมดที่แก้ไขได้ตรงๆ จาก request body (ไม่รวมฟิลด์ระบบ เช่น id, ผลคำนวณ, created_by, timestamps)
const EDITABLE_FIELDS = [
  "customer_name",
  "customer_phone",
  "customer_address",
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

router.post("/", requireAuth, async (req, res) => {
  if (!req.body.customer_name) {
    return res.status(400).json({ ok: false, error: "customer_name is required" });
  }

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

  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const result = await query(
    `INSERT INTO surveys (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
    params
  );

  res.status(201).json({ ok: true, survey: result.rows[0] });
});

router.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (req.query.created_by) {
    params.push(req.query.created_by);
    conditions.push(`created_by = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM surveys ${where} ORDER BY created_at DESC`, params);
  res.json({ ok: true, surveys: result.rows });
});

router.get("/:id", requireAuth, async (req, res) => {
  const result = await query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
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

  res.json({ ok: true, survey, calculation });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const existing = await query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }

  const merged = { ...existing.rows[0], ...req.body };
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

  res.json({ ok: true, survey: result.rows[0] });
});

router.post("/:id/calculate", requireAuth, async (req, res) => {
  const existing = await query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }

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

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const result = await query("DELETE FROM surveys WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "survey not found" });
  }
  res.json({ ok: true });
});

module.exports = router;
