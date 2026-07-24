import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
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

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = dateKey(new Date(a.scheduled_start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
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
            const hasAppointments = appointmentsByDate.has(key);
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
                {hasAppointments && (
                  <span
                    className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      isSelected ? "bg-white" : "bg-brand-red"
                    }`}
                  />
                )}
              </button>
            );
          })}
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
                className="flex items-center justify-between rounded-xl border bg-white p-3 hover:bg-gray-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatTime(a.scheduled_start)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${APPOINTMENT_STATUS_COLORS[a.status]}`}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {a.customer_name} · {APPOINTMENT_TYPE_LABELS[a.type]}
                  </div>
                </div>
                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300" />
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
