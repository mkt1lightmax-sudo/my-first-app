export const STAFF_ROLES = ["admin", "sales", "surveyor", "installer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "ผู้ดูแลระบบ",
  sales: "ฝ่ายขาย",
  surveyor: "ผู้สำรวจ",
  installer: "ช่างติดตั้ง",
};

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
};

export function roleLabel(role: string): string {
  return STAFF_ROLE_LABELS[role as StaffRole] ?? role;
}
