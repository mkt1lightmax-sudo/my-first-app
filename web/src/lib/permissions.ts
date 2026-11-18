// สำเนาของ server/lib/permissions.js — ใช้ซ่อน/แสดงปุ่มในหน้าเว็บ (หลังบ้านเช็กซ้ำอีกชั้นเสมอ)
// แก้สิทธิ์ต้องแก้ทั้งสองไฟล์ให้ตรงกัน

type StaffLike = { id: number; role: string; is_owner?: boolean } | null | undefined;

const PERMISSIONS = {
  "customers.edit": ["admin", "sales", "surveyor"],
  "appointments.create": ["admin", "sales"],
  "appointments.editAny": ["admin", "sales"],
  "appointments.editOwn": ["surveyor", "installer"],
  "chat.view": ["admin", "sales", "viewer"],
  "chat.viewAll": ["admin", "viewer"],
  "chat.reply": ["admin", "sales"],
  "chat.assignOthers": ["admin"],
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
