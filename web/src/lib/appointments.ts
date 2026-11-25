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
  map_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  customer_code?: string | null; // รหัสลูกค้า (ถ้างานผูกกับลูกค้า)
  sales_name?: string | null; // เซลที่ดูแลลูกค้า
  survey_fee?: string | number | null; // ค่าสำรวจ (บาท)
  survey_fee_paid?: boolean;
  survey_fee_note?: string | null;
  survey_fee_paid_at?: string | null;
  survey_fee_paid_by_name?: string | null;
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

// สีประจำประเภทงาน — โทนอ่อน สุภาพ ไม่ฉูดฉาด (ใช้ในปฏิทินและรายการงาน)
export const APPOINTMENT_TYPE_STYLES: Record<AppointmentType, { dot: string; bar: string; badge: string }> = {
  site_survey: { dot: "bg-[#7C93B0]", bar: "border-l-[#7C93B0]", badge: "bg-[#EEF2F7] text-[#4A5F7A]" },
  presentation: { dot: "bg-[#C4A574]", bar: "border-l-[#C4A574]", badge: "bg-[#F7F1E6] text-[#7A6440]" },
  installation: { dot: "bg-[#86A893]", bar: "border-l-[#86A893]", badge: "bg-[#EDF4EF] text-[#4C6B57]" },
};

// คิวสำรวจ (จาก /appointments/survey-slots)
export type SurveySlot = {
  time: string;
  start: string;
  end: string;
  free: { id: number; name: string }[];
  busy: { id: number; name: string; reason: string }[];
};

// วันหยุดพนักงาน
export type TimeOffPeriod = "full" | "morning" | "afternoon";
export const TIME_OFF_LABELS: Record<TimeOffPeriod, string> = {
  full: "ทั้งวัน",
  morning: "ครึ่งเช้า",
  afternoon: "ครึ่งบ่าย",
};
export type TimeOff = { id: number; staff_id: number; staff_name?: string; off_date: string; period: TimeOffPeriod; note: string | null };

// ชื่อเรียกคนที่ได้รับมอบหมาย ตามประเภทงาน
export const ASSIGNEE_LABELS: Record<AppointmentType, string> = {
  site_survey: "ผู้สำรวจ",
  presentation: "ผู้นำเสนอ",
  installation: "ช่าง",
};

// บรรทัด "เซล: X · ผู้สำรวจ: Y" ของงาน
export function jobPeople(a: Appointment) {
  const parts: string[] = [];
  if (a.sales_name) parts.push(`เซล: ${a.sales_name}`);
  parts.push(`${ASSIGNEE_LABELS[a.type]}: ${a.assigned_staff_name || "ยังไม่ระบุ"}`);
  return parts.join(" · ");
}

// ป้ายค่าสำรวจ: null ถ้าไม่มีค่าสำรวจ
export function surveyFeeBadge(a: Appointment): { text: string; className: string } | null {
  const fee = a.survey_fee != null ? Number(a.survey_fee) : 0;
  if (!fee) return null;
  const amount = fee.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  return a.survey_fee_paid
    ? { text: `ค่าสำรวจ ${amount} · จ่ายแล้ว ✓`, className: "bg-[#EDF4EF] text-[#4C6B57]" }
    : { text: `ค่าสำรวจ ${amount} · ยังไม่จ่าย`, className: "bg-[#FBEFE3] text-[#9A5B23]" };
}
