// สำเนาของ server/lib/permissions.js — ใช้ซ่อน/แสดงปุ่มในหน้าเว็บ (หลังบ้านเช็กซ้ำอีกชั้นเสมอ)
// แก้สิทธิ์ต้องแก้ทั้งสองไฟล์ให้ตรงกัน

type StaffLike = { id: number; role: string; is_owner?: boolean } | null | undefined;

const PERMISSIONS = {
  "customers.create": ["admin", "assistant", "sales", "surveyor"],      // เพิ่มลูกค้าใหม่
  "customers.edit": ["admin", "assistant", "sales", "surveyor"],        // แก้ข้อมูลลูกค้า — เฉพาะที่ตัวเองสร้าง/ได้รับมอบหมาย (ดู customers.editAll)
  "customers.filterByStaff": ["admin", "assistant"],                   // หน้าลูกค้า: กรองตามผู้สร้าง/เซล
  "customers.assignSales": ["admin", "assistant"],                     // เปลี่ยนเซลผู้ดูแลลูกค้า
  "location.update": ["admin", "assistant"],                            // อัปเดตตำแหน่งหน้างาน (+ ช่าง/ผู้สำรวจที่ได้รับมอบหมายงานของลูกค้านั้น)
  "customers.editAll": ["admin"],                                       // แก้ข้อมูลลูกค้าได้ทุกคน + ลบ/กู้คืนจากถังขยะ
  "appointments.create": ["admin", "assistant"],                         // สร้างงานนัดหมาย — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.editAny": ["admin", "assistant"],                        // แก้งานของทุกคน — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.editOwn": [],                                            // แก้เฉพาะงานที่มอบหมายให้ตัวเอง — ปิดไว้ (2026-11-25): นอกจากเจ้าของ/แอดมิน/ผู้ช่วยแอดมิน ให้ดูได้อย่างเดียว (เดิม surveyor, installer)
  "chat.view": ["admin", "assistant", "sales", "viewer", "surveyor"],    // ดูแชท (ผู้สำรวจ: เฉพาะแชทที่มอบหมายให้ตัวเอง)
  "chat.viewAll": ["admin", "assistant", "viewer"],
  "chat.reply": ["admin", "assistant", "sales", "surveyor"],             // ตอบแชท / รับเรื่อง / ติดป้าย
  "chat.seeUnassigned": ["admin", "assistant", "sales", "viewer"],       // เห็นแชทที่ยังไม่มีคนดูแล (ผู้สำรวจไม่เห็น — ได้เฉพาะที่แอดมินมอบหมาย)
  "chat.assignOthers": ["admin", "assistant"],
  "reports.view": ["admin", "assistant", "sales", "viewer"],
  "reports.viewAll": ["admin", "assistant", "viewer"],
  "appointments.fee": ["admin", "assistant"],                            // กรอกค่าสำรวจ / กด "จ่ายแล้ว" — เซลปิดไว้ชั่วคราว (2026-11-25) จนกว่าทีมใช้งานคล่อง เปิดคืนได้โดยเติม "sales"
  "appointments.override": ["admin", "assistant"],                     // สำรวจ: จองนอกช่องคิว / จองซ้อนได้ ("เวลาอื่น")
  "timeoff.manageAll": ["admin", "assistant"],                         // แจ้งหยุดแทนพนักงานคนอื่น
  "staff.manage": ["admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(staff: StaffLike, permission: Permission): boolean {
  if (!staff) return false;
  if (staff.is_owner) return true;
  return (PERMISSIONS[permission] as readonly string[]).includes(staff.role);
}

export function isOwner(staff: StaffLike): boolean {
  return Boolean(staff?.is_owner);
}

export function canEditAppointment(staff: StaffLike, assignedStaffId: number | null | undefined): boolean {
  if (can(staff, "appointments.editAny")) return true;
  return can(staff, "appointments.editOwn") && !!staff && assignedStaffId === staff.id;
}
