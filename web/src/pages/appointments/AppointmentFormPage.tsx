import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentType,
  type AppointmentStatus,
  type Appointment,
} from "../../lib/appointments";

type StaffOption = { id: number; name: string; role: string };
type SurveyOption = { id: number; customer_name: string };

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentFormPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [type, setType] = useState<AppointmentType>("site_survey");
  const [surveyId, setSurveyId] = useState(searchParams.get("surveyId") ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [notes, setNotes] = useState("");

  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [surveys, setSurveys] = useState<SurveyOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ ok: true; staff: StaffOption[] }>("/staff").then((d) => setStaffList(d.staff));
    api.get<{ ok: true; surveys: SurveyOption[] }>("/surveys").then((d) => setSurveys(d.surveys));
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    api.get<{ ok: true; appointment: Appointment }>(`/appointments/${id}`).then((d) => {
      const a = d.appointment;
      setType(a.type);
      setSurveyId(a.survey_id ? String(a.survey_id) : "");
      setCustomerName(a.customer_name);
      setCustomerPhone(a.customer_phone ?? "");
      setCustomerAddress(a.customer_address ?? "");
      setStart(toLocalInputValue(a.scheduled_start));
      setEnd(toLocalInputValue(a.scheduled_end));
      setAssignedStaffId(a.assigned_staff_id ? String(a.assigned_staff_id) : "");
      setStatus(a.status);
      setNotes(a.notes ?? "");
    });
  }, [id, isEditing]);

  function handleSurveySelect(value: string) {
    setSurveyId(value);
    const survey = surveys.find((s) => String(s.id) === value);
    if (survey && !customerName) setCustomerName(survey.customer_name);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        type,
        survey_id: surveyId ? Number(surveyId) : undefined,
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        customer_address: customerAddress || undefined,
        scheduled_start: new Date(start).toISOString(),
        scheduled_end: new Date(end).toISOString(),
        assigned_staff_id: assignedStaffId ? Number(assignedStaffId) : undefined,
        status: isEditing ? status : undefined,
        notes: notes || undefined,
      };
      if (isEditing) {
        await api.patch(`/appointments/${id}`, payload);
      } else {
        await api.post("/appointments", payload);
      }
      navigate("/appointments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{isEditing ? "แก้ไขนัดหมาย" : "สร้างนัดหมาย"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-4">
        <div>
          <label className={labelClass}>ประเภทนัดหมาย</label>
          <div className="flex gap-2">
            {APPOINTMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                  type === t ? "border-brand-navy text-brand-navy" : "border-gray-200 text-gray-500"
                }`}
              >
                {APPOINTMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>เชื่อมกับแบบสำรวจ (ถ้ามี)</label>
          <select value={surveyId} onChange={(e) => handleSurveySelect(e.target.value)} className={inputClass}>
            <option value="">ไม่เชื่อม</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.customer_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>ชื่อลูกค้า *</label>
          <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>เบอร์โทร</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ที่อยู่</label>
            <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>วันเวลาเริ่ม *</label>
            <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>วันเวลาสิ้นสุด *</label>
            <input type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>มอบหมายให้</label>
          <select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className={inputClass}>
            <option value="">ไม่ระบุ</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {isEditing && (
          <div>
            <label className={labelClass}>สถานะ</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)} className={inputClass}>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>หมายเหตุ</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-navy py-3 text-sm font-semibold text-white hover:bg-brand-navy-light disabled:opacity-50"
        >
          {submitting ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "สร้างนัดหมาย"}
        </button>
      </form>
    </div>
  );
}
