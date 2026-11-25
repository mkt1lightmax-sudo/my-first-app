// ตำแหน่งหน้างาน (ปักหมุด) — ใช้ร่วมกันระหว่างลูกค้าและนัดหมาย
const { query } = require("../db/pool");
const { can } = require("./permissions");

const googleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

// รับพิกัดจาก body และตรวจว่าอยู่ในแถบประเทศไทย — คืน { lat, lng } หรือ null
function parseLatLng(body) {
  const lat = Number(body?.latitude);
  const lng = Number(body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 4 || lat > 22 || lng < 96 || lng > 107) return null;
  return { lat, lng };
}

// อัปเดตตำแหน่งได้ไหม: เจ้าของ/แอดมิน/ผู้ช่วยแอดมิน หรือคนที่ได้รับมอบหมายงาน (ไม่ยกเลิก) ของลูกค้ารายนี้
async function canUpdateSurveyLocation(staff, surveyId) {
  if (can(staff, "location.update")) return true;
  const r = await query(
    "SELECT 1 FROM appointments WHERE survey_id = $1 AND assigned_staff_id = $2 AND status <> 'cancelled' LIMIT 1",
    [surveyId, staff.id]
  );
  return r.rows.length > 0;
}

// บันทึกตำแหน่งลงลูกค้า + เก็บประวัติ
async function saveSurveyLocation(surveyId, staffId, { lat, lng }) {
  const before = (await query("SELECT latitude, longitude, map_url FROM surveys WHERE id = $1", [surveyId])).rows[0];
  const url = googleMapsUrl(lat, lng);
  await query("UPDATE surveys SET latitude = $2, longitude = $3, map_url = $4, updated_at = now() WHERE id = $1", [surveyId, lat, lng, url]);
  await query("INSERT INTO survey_history (survey_id, staff_id, action, changes) VALUES ($1, $2, 'update', $3)", [
    surveyId,
    staffId,
    JSON.stringify({
      location: {
        from: before?.latitude != null ? `${Number(before.latitude).toFixed(5)}, ${Number(before.longitude).toFixed(5)}` : null,
        to: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      },
    }),
  ]);
  return { latitude: lat, longitude: lng, map_url: url };
}

module.exports = { googleMapsUrl, parseLatLng, canUpdateSurveyLocation, saveSurveyLocation };
