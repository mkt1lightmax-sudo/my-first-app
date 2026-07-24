export const APPOINTMENT_TYPES = ["site_survey", "presentation", "installation"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  site_survey: "สำรวจหน้างาน",
  presentation: "นำเสนองาน",
  installation: "ติดตั้ง",
};

export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "rescheduled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "นัดหมายแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  rescheduled: "เลื่อนนัด",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-navy/10 text-brand-navy",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  rescheduled: "bg-amber-100 text-amber-700",
};

export type Appointment = {
  id: number;
  type: AppointmentType;
  survey_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  scheduled_start: string;
  scheduled_end: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
  status: AppointmentStatus;
  notes: string | null;
};

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
