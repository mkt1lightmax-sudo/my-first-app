import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  formatDateTime,
  type Appointment,
} from "../../lib/appointments";
import { ChevronRightIcon } from "../../components/icons";

export default function AppointmentsListPage() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ ok: true; appointments: Appointment[] }>("/appointments")
      .then((data) => setAppointments(data.appointments))
      .catch(() => setError("โหลดรายการนัดหมายไม่สำเร็จ"));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">งาน / นัดหมาย</h1>
        <Link to="/appointments/new" className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light">
          + สร้างใหม่
        </Link>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      {appointments && appointments.length === 0 && <p className="text-gray-500">ยังไม่มีนัดหมาย</p>}

      <div className="space-y-2">
        {appointments?.map((a) => (
          <Link
            key={a.id}
            to={`/appointments/${a.id}/edit`}
            className="flex items-center justify-between rounded-xl border bg-white p-4 hover:bg-gray-50"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{a.customer_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${APPOINTMENT_STATUS_COLORS[a.status]}`}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {APPOINTMENT_TYPE_LABELS[a.type]} · {formatDateTime(a.scheduled_start)}
              </div>
              {a.assigned_staff_name && <div className="mt-0.5 text-xs text-brand-navy">มอบหมาย: {a.assigned_staff_name}</div>}
            </div>
            <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
