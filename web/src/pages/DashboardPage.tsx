import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ClipboardIcon, CalculatorIcon, CalendarClockIcon, CalendarIcon, ChevronRightIcon } from "../components/icons";
import { APPOINTMENT_TYPE_LABELS, formatDateTime, type Appointment } from "../lib/appointments";

const actionCards = [
  {
    to: "/surveys/new",
    label: "แบบสำรวจ",
    subtitle: "กรอกข้อมูลลูกค้าและหน้างาน",
    icon: ClipboardIcon,
    tone: "navy" as const,
  },
  {
    to: "/calculator",
    label: "คำนวณระบบ",
    subtitle: "แนะนำขนาดโซลาร์ที่เหมาะสม",
    icon: CalculatorIcon,
    tone: "red" as const,
  },
  {
    to: "/appointments/new",
    label: "นัดหมาย",
    subtitle: "สำรวจและติดตั้ง",
    icon: CalendarClockIcon,
    tone: "navy" as const,
  },
  {
    to: "/calendar",
    label: "ปฏิทิน",
    subtitle: "ดูตารางงานทั้งหมด",
    icon: CalendarIcon,
    tone: "red" as const,
  },
];

const toneClasses = {
  navy: { bg: "bg-brand-navy/5", text: "text-brand-navy" },
  red: { bg: "bg-brand-red/5", text: "text-brand-red" },
};

export default function DashboardPage() {
  const { staff } = useAuth();
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    api
      .get<{ ok: true; appointments: Appointment[] }>(`/appointments?from=${from}&status=scheduled`)
      .then((d) => setUpcoming(d.appointments.slice(0, 3)))
      .catch(() => setUpcoming([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">สวัสดีค่ะ{staff ? ` ${staff.name}` : ""}</h1>
      <p className="mt-1 text-gray-500">วันนี้ต้องการทำรายการอะไร?</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {actionCards.map((card) => {
          const tone = toneClasses[card.tone];
          return (
            <Link
              key={card.to}
              to={card.to}
              className={`flex flex-col items-start gap-3 rounded-2xl ${tone.bg} p-4 transition hover:brightness-95`}
            >
              <card.icon className={`h-9 w-9 ${tone.text}`} />
              <div>
                <div className={`font-semibold ${tone.text}`}>{card.label}</div>
                <div className="mt-0.5 text-xs text-gray-500">{card.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-medium text-gray-900">งานที่กำลังจะมาถึง</h2>
        {upcoming && upcoming.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีนัดหมายที่กำลังจะมาถึง</p>}
        <div className="space-y-2">
          {upcoming?.map((a) => (
            <Link key={a.id} to={`/appointments/${a.id}/edit`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
              <div>
                <div className="font-medium text-gray-900">{a.customer_name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {APPOINTMENT_TYPE_LABELS[a.type]} · {formatDateTime(a.scheduled_start)}
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
