const { verifyToken, signToken, COOKIE_NAME, COOKIE_OPTIONS, RENEW_AFTER_SECONDS } = require("../lib/jwt");
const { query } = require("../db/pool");

// ตรวจว่าล็อกอินอยู่ — และเช็กกับฐานข้อมูลทุกครั้งว่าพนักงานคนนี้ยังมีอยู่
// ถ้าถูกลบไปแล้ว ทุกเครื่องที่ล็อกอินค้างไว้จะถูกเตะออกทันทีในคำขอถัดไป
// (ใช้ชื่อ/ตำแหน่งล่าสุดจากฐานข้อมูลด้วย — แอดมินเปลี่ยนตำแหน่งแล้วมีผลทันที)
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ ok: false, error: "not authenticated" });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ ok: false, error: "invalid or expired session" });
  }

  const result = await query(
    "SELECT id, name, email, role, is_owner, password_changed_at FROM staff WHERE id = $1",
    [payload.id]
  );
  const staff = result.rows[0];
  if (!staff) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ ok: false, error: "บัญชีนี้ถูกลบออกจากระบบแล้ว" });
  }
  // ล็อกอินก่อนเปลี่ยนรหัสผ่าน = หมดอายุ (เทียบเป็นวินาที เพราะ iat ของ JWT เป็นวินาที)
  if (staff.password_changed_at && Math.floor(new Date(staff.password_changed_at).getTime() / 1000) > (payload.iat || 0)) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ ok: false, error: "รหัสผ่านถูกเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่" });
  }

  delete staff.password_changed_at;
  // ฝากงานระหว่างหยุด: วันนี้ฉันรับฝากงานของใครบ้าง (หมดเองเมื่อพ้นวันหยุด)
  staff.coveringIds = (
    await query(
      "SELECT staff_id FROM staff_time_off WHERE cover_staff_id = $1 AND off_date = (now() AT TIME ZONE 'Asia/Bangkok')::date",
      [staff.id]
    )
  ).rows.map((r) => r.staff_id);
  req.staff = staff;

  // ต่ออายุการล็อกอิน: ใช้งานอยู่ = นับ 90 วันใหม่ (ออก cookie ใหม่วันละครั้งพอ)
  if (Date.now() / 1000 - (payload.iat || 0) > RENEW_AFTER_SECONDS) {
    res.cookie(COOKIE_NAME, signToken({ id: staff.id, name: staff.name, email: staff.email, role: staff.role }), COOKIE_OPTIONS);
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
