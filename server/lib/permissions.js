// สิทธิ์ของแต่ละตำแหน่ง — แก้ที่ไฟล์นี้ที่เดียว (หน้าเว็บมีสำเนาใน web/src/lib/permissions.ts ต้องแก้ให้ตรงกัน)
//
// ตำแหน่ง: เจ้าของ (admin + is_owner) / admin / assistant (ผู้ช่วยแอดมิน: เหมือนแอดมิน แต่จัดการพนักงานและลบงานไม่ได้) / sales / surveyor / installer / viewer
const PERMISSIONS = {
  "customers.create": ["admin", "assistant", "sales", "surveyor"],      // เพิ่มลูกค้าใหม่
  "customers.edit": ["admin", "assistant", "sales", "surveyor"],        // แก้ข้อมูลลูกค้า — เฉพาะที่ตัวเองสร้าง/ได้รับมอบหมาย (ดู customers.editAll)
  "customers.filterByStaff": ["admin", "assistant"],                   // หน้าลูกค้า: กรองตามผู้สร้าง/เซล
  "customers.assignSales": ["admin", "assistant"],                     // เปลี่ยนเซลผู้ดูแลลูกค้า
  "customers.editAll": ["admin"],                                       // แก้ข้อมูลลูกค้าได้ทุกคน + ลบ/กู้คืนจากถังขยะ
  "appointments.create": ["admin", "assistant"],                         // สร้างงานนัดหมาย — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.editAny": ["admin", "assistant"],                        // แก้งานของทุกคน — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.editOwn": [],                                            // แก้เฉพาะงานที่มอบหมายให้ตัวเอง — ปิดไว้ (2026-11-25): นอกจากเจ้าของ/แอดมิน/ผู้ช่วยแอดมิน ให้ดูได้อย่างเดียว (เดิม surveyor, installer)
  "chat.view": ["admin", "assistant", "sales", "viewer"],               // ดูแชท
  "chat.viewAll": ["admin", "assistant", "viewer"],                     // เห็นแชททุกห้อง (เซลล์เห็นเฉพาะของตัวเอง + ที่ยังไม่มีคนดูแล)
  "chat.reply": ["admin", "assistant", "sales"],                        // ตอบแชท / รับเรื่อง / ติดป้าย
  "chat.assignOthers": ["admin", "assistant"],                          // มอบหมายแชทให้คนอื่น
  "reports.view": ["admin", "assistant", "sales", "viewer"],            // ดูรายงานยอดขาย (เซลล์เห็นเฉพาะของตัวเอง)
  "reports.viewAll": ["admin", "assistant", "viewer"],                  // ดูยอดขายของทุกคน
  "appointments.fee": ["admin", "assistant"],                            // กรอกค่าสำรวจ / กด "จ่ายแล้ว" — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.override": ["admin", "assistant"],                     // สำรวจ: จองนอกช่องคิว / จองซ้อนได้ ("เวลาอื่น")
  "timeoff.manageAll": ["admin", "assistant"],                         // แจ้งหยุดแทนพนักงานคนอื่น
  "staff.manage": ["admin"],                              // เพิ่ม/ลบพนักงาน (แอดมินจัดการแอดมินด้วยกันไม่ได้)
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
