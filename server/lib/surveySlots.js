// คิวสำรวจหน้างาน: เลือกได้เฉพาะช่องเวลาที่กำหนด งานละ 2 ชม. คิดแยกตามช่างสำรวจ
// - งานที่คร่อมพักเที่ยง (12:00–13:00) เช่น นัด 11:00 จบ 13:00 → พักเที่ยงหลังงาน ช่างว่างอีกทีตอน 14:00
// - ช่างแจ้งหยุดได้: ทั้งวัน / ครึ่งเช้า (ก่อน 12:00) / ครึ่งบ่าย (ตั้งแต่ 13:00)
// เวลาทั้งหมดคิดตามเวลาไทย (+07:00)

const SLOT_TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const SURVEY_HOURS = 2;
const HOUR = 60 * 60 * 1000;
const TZ = "+07:00";

const at = (date, hhmm) => new Date(`${date}T${hhmm}:00${TZ}`);
// วันที่ (YYYY-MM-DD) ตามเวลาไทย
const bangkokDate = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const hhmm = (d) => new Date(d).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

// ช่วงเวลาที่ช่างไม่ว่างจากงานหนึ่งงาน — งานสำรวจที่คร่อมพักเที่ยง ต่อเวลาพัก 1 ชม. หลังงาน
function busyInterval({ type, scheduled_start, scheduled_end }) {
  const start = new Date(scheduled_start);
  let end = new Date(scheduled_end);
  if (type === "site_survey") {
    const day = bangkokDate(start);
    if (overlaps({ start, end }, { start: at(day, "12:00"), end: at(day, "13:00") })) end = new Date(end.getTime() + HOUR);
  }
  return { start, end };
}

// ช่วงที่หยุดตามประเภทการลา
function offInterval({ off_date, period }) {
  const day = typeof off_date === "string" ? off_date.slice(0, 10) : bangkokDate(off_date);
  if (period === "morning") return { start: at(day, "00:00"), end: at(day, "12:00") };
  if (period === "afternoon") return { start: at(day, "13:00"), end: new Date(at(day, "00:00").getTime() + 24 * HOUR) };
  return { start: at(day, "00:00"), end: new Date(at(day, "00:00").getTime() + 24 * HOUR) };
}

const PERIOD_LABELS = { full: "หยุดทั้งวัน", morning: "หยุดครึ่งเช้า", afternoon: "หยุดครึ่งบ่าย" };

// ตรวจว่าช่างคนนี้รับงานช่วง [start, end) ได้ไหม — คืนเหตุผลถ้าไม่ว่าง หรือ null ถ้าว่าง
// work = ช่วงทำงานจริง (ใช้เทียบวันหยุด), busy = ช่วงที่กันคิว (รวมพักเที่ยงหลังงาน)
function conflictReason({ work, busy }, appointments, offs) {
  for (const o of offs) {
    if (overlaps(work, offInterval(o))) return PERIOD_LABELS[o.period];
  }
  for (const a of appointments) {
    const b = busyInterval(a);
    if (overlaps(busy, b)) return `ติดงาน ${hhmm(a.scheduled_start)}–${hhmm(a.scheduled_end)} · ${a.customer_name}`;
  }
  return null;
}

// ช่วงงานสำรวจถ้าเริ่มเวลานี้
function surveyWindow(start, end) {
  const work = { start: new Date(start), end: new Date(end) };
  return { work, busy: busyInterval({ type: "site_survey", scheduled_start: work.start, scheduled_end: work.end }) };
}

function slotWindow(date, time) {
  const start = at(date, time);
  return surveyWindow(start, new Date(start.getTime() + SURVEY_HOURS * HOUR));
}

// เวลาเริ่ม/จบ เป็นช่องคิวมาตรฐานไหม (เริ่มตามช่องที่กำหนด และยาว 2 ชม.)
function isStandardSlot(start, end) {
  const s = new Date(start);
  return SLOT_TIMES.includes(hhmm(s)) && new Date(end).getTime() - s.getTime() === SURVEY_HOURS * HOUR;
}

module.exports = {
  SLOT_TIMES,
  SURVEY_HOURS,
  at,
  bangkokDate,
  slotWindow,
  surveyWindow,
  conflictReason,
  isStandardSlot,
  PERIOD_LABELS,
};
