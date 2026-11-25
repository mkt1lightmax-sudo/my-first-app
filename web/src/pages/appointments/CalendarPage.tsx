import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_STYLES,
  formatTime,
  dateKey,
  type Appointment,
} from "../../lib/appointments";
import { ChevronRightIcon } from "../../components/icons";

const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_LABELS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export default function CalendarPage() {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const monthStart = visibleMonth;
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);

  useEffect(() => {
    const from = monthStart.toISOString();
    const to = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString();
    api
      .get<{ ok: true; appointments: Appointment[] }>(`/appointments?from=${from}&to=${to}`)
      .then((d) => setAppointments(d.appointments))
      .catch(() => setAppointments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth]);

  // งานหลายวัน (เช่น ติดตั้ง 2 วัน) ใส่ไว้ทุกวันตั้งแต่วันเริ่มถึงวันจบ
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const start = new Date(a.scheduled_start);
      const end = new Date(a.scheduled_end);
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      for (let i = 0; i < 31 && day <= end; i++) {
        const key = dateKey(day);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
        day.setDate(day.getDate() + 1);
      }
    }
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), d));
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth]);

  function goToMonth(offset: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1));
  }

  const todayKey = dateKey(today);
  const selectedAppointments = appointmentsByDate.get(selectedDate) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">ปฏิทิน</h1>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => goToMonth(-1)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">
            ‹
          </button>
          <div className="font-medium text-gray-900">
            {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear() + 543}
          </div>
          <button onClick={() => goToMonth(1)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const key = dateKey(date);
            const dayTypes = APPOINTMENT_TYPES.filter((t) => appointmentsByDate.get(key)?.some((a) => a.type === t));
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={`relative aspect-square rounded-lg text-sm ${
                  isSelected ? "bg-brand-navy text-white" : isToday ? "bg-brand-navy/10 text-brand-navy" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {date.getDate()}
                {dayTypes.length > 0 && (
                  <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                    {dayTypes.map((t) => (
                      <span key={t} className={`h-1.5 w-1.5 rounded-full ${APPOINTMENT_TYPE_STYLES[t].dot} ${isSelected ? "ring-1 ring-white" : ""}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* คำอธิบายสี */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
          {APPOINTMENT_TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${APPOINTMENT_TYPE_STYLES[t].dot}`} />
              {APPOINTMENT_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h2 className="mb-2 font-medium text-gray-900">
          {new Date(selectedDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
        </h2>

        {selectedAppointments.length === 0 && <p className="text-sm text-gray-400">ไม่มีนัดหมายวันนี้</p>}

        <div className="space-y-2">
          {selectedAppointments
            .slice()
            .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))
            .map((a) => (
              <Link
                key={a.id}
                to={`/appointments/${a.id}/edit`}
                className={`flex items-center justify-between rounded-xl border border-l-4 bg-white p-3 hover:bg-gray-50 ${APPOINTMENT_TYPE_STYLES[a.type].bar}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{dayTimeLabel(a, selectedDate)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${APPOINTMENT_TYPE_STYLES[a.type].badge}`}>
                      {APPOINTMENT_TYPE_LABELS[a.type]}
                      {dayIndexLabel(a, selectedDate)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${APPOINTMENT_STATUS_COLORS[a.status]}`}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">{a.customer_name}</div>
                </div>
                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300" />
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

// งานหลายวัน: บอกว่าเป็นวันที่เท่าไหร่ เช่น " · วันที่ 1/2" (งานวันเดียวไม่แสดง)
function dayParts(a: Appointment, key: string) {
  const s = new Date(a.scheduled_start);
  const e = new Date(a.scheduled_end);
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  const [y, m, d] = key.split("-").map(Number);
  const thisDay = new Date(y, m - 1, d).getTime();
  const total = Math.round((endDay - startDay) / 86400000) + 1;
  const index = Math.round((thisDay - startDay) / 86400000) + 1;
  return { total, index };
}

function dayIndexLabel(a: Appointment, key: string) {
  const { total, index } = dayParts(a, key);
  return total > 1 ? ` · วันที่ ${index}/${total}` : "";
}

// เวลาที่แสดงในแต่ละวัน: วันแรก = เวลาเริ่ม, วันสุดท้าย = "ถึง HH:MM", วันกลาง = "ทั้งวัน"
function dayTimeLabel(a: Appointment, key: string) {
  const { total, index } = dayParts(a, key);
  if (total <= 1 || index === 1) return formatTime(a.scheduled_start);
  if (index === total) return `ถึง ${formatTime(a.scheduled_end)}`;
  return "ทั้งวัน";
}
