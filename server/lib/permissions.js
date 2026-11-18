// สิทธิ์ของแต่ละตำแหน่ง — แก้ที่ไฟล์นี้ที่เดียว (หน้าเว็บมีสำเนาใน web/src/lib/permissions.ts ต้องแก้ให้ตรงกัน)
//
// ตำแหน่ง: เจ้าของ (admin + is_owner) / admin / sales / surveyor / installer / viewer
const PERMISSIONS = {
  "customers.edit": ["admin", "sales", "surveyor"],        // เพิ่ม/แก้ข้อมูลลูกค้า
  "appointments.create": ["admin", "sales"],               // สร้างงานนัดหมาย
  "appointments.editAny": ["admin", "sales"],              // แก้งานของทุกคน
  "appointments.editOwn": ["surveyor", "installer"],       // แก้เฉพาะงานที่มอบหมายให้ตัวเอง
  "chat.view": ["admin", "sales", "viewer"],               // ดูแชท
  "chat.viewAll": ["admin", "viewer"],                     // เห็นแชททุกห้อง (เซลล์เห็นเฉพาะของตัวเอง + ที่ยังไม่มีคนดูแล)
  "chat.reply": ["admin", "sales"],                        // ตอบแชท / รับเรื่อง / ติดป้าย
  "chat.assignOthers": ["admin"],                          // มอบหมายแชทให้คนอื่น
  "staff.manage": ["admin"],                               // เพิ่ม/ลบพนักงาน (แอดมินจัดการแอดมินด้วยกันไม่ได้)
};

// เจ้าของทำได้ทุกอย่าง
function can(staff, permission) {
  if (!staff) return false;
  if (staff.is_owner) return true;
  return (PERMISSIONS[permission] || []).includes(staff.role);
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!can(req.staff, permission)) {
      return res.status(403).json({ ok: false, error: "คุณไม่มีสิทธิ์ทำรายการนี้" });
    }
    next();
  };
}

function requireOwner(req, res, next) {
  if (!req.staff?.is_owner) {
    return res.status(403).json({ ok: false, error: "เฉพาะเจ้าของระบบเท่านั้น" });
  }
  next();
}

module.exports = { can, requirePermission, requireOwner };
