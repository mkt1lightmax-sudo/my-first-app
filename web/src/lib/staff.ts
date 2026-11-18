export const STAFF_ROLES = ["admin", "sales", "surveyor", "installer", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "แอดมิน",
  sales: "เซลล์",
  surveyor: "ผู้สำรวจ",
  installer: "ช่างติดตั้ง",
  viewer: "ดูเท่านั้น",
};

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  is_owner: boolean;
};

export function staffRoleLabel(staff: { role: string; is_owner?: boolean }): string {
  return staff.is_owner ? "เจ้าของ" : roleLabel(staff.role);
}

export function roleLabel(role: string): string {
  return STAFF_ROLE_LABELS[role as StaffRole] ?? role;
}
