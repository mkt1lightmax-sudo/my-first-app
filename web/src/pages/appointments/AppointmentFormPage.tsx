import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
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

import { useAuth } from "../../context/AuthContext";
import SurveySlotPicker from "./SurveySlotPicker";
import { can, canEditAppointment } from "../../lib/permissions";

type StaffOption = { id: number; name: string; role: string };
type SurveyOption = { id: number; customer_name: string };

const SLOT_TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];

// งานสำรวจที่ตรงช่องคิวมาตรฐาน (เริ่มตามช่อง และยาว 2 ชม.)
function isStandardSurvey(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const hhmm = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
  return SLOT_TIMES.includes(hhmm) && new Date(endIso).getTime() - s.getTime() === 2 * 60 * 60 * 1000;
}

// เวลาทำงาน: เริ่ม 08:00 เลิก 18:00
const WORK_START = "08:00";
const WORK_END = "18:00";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentFormPage() {
  const { staff } = useAuth();
  const [loadedAssignedId, setLoadedAssignedId] = useState<number | null>(null);
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
  // งานสำรวจ: เลือกจากช่องคิว / แอดมินเลือก "เวลาอื่น" เพื่อกรอกเวลาเองได้
  const canOverride = can(staff, "appointments.override");
  const [overrideMode, setOverrideMode] = useState(false);
  const [slotDate, setSlotDate] = useState(todayKey());
  const useSlots = type === "site_survey" && !overrideMode;
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // ช่องหมายเหตุขยายตามความยาวข้อความ (ไม่ตัดข้อความ)
  useLayoutEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [notes]);

  // เลือกวันเวลาเริ่มแล้ว ถ้ายังไม่มีเวลาจบ (หรือจบก่อนเริ่ม) → ตั้งเป็น 18:00 ของวันเดียวกัน
  function handleStartChange(value: string) {
    setStart(value);
    if (value && (!end || end <= value)) setEnd(`${value.slice(0, 10)}T${WORK_END}`);
  }

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
      setLoadedAssignedId(a.assigned_staff_id ?? null);
      setStatus(a.status);
      setNotes(a.notes ?? "");
      setSlotDate(toLocalInputValue(a.scheduled_start).slice(0, 10));
      // งานสำรวจเก่าที่ไม่ตรงช่องคิว: แอดมินแก้ต่อแบบ "เวลาอื่น"
      if (a.type === "site_survey" && !isStandardSurvey(a.scheduled_start, a.scheduled_end) && canOverride) setOverrideMode(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  function handleSurveySelect(value: string) {
    setSurveyId(value);
    const survey = surveys.find((s) => String(s.id) === value);
    if (survey && !customerName) setCustomerName(survey.customer_name);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (useSlots && (!start || !assignedStaffId)) {
      setError("กรุณาเลือกช่องเวลาและช่างสำรวจ");
      return;
    }
    if (!useSlots) {
      if (start.slice(11, 16) < WORK_START || end.slice(11, 16) > WORK_END) {
        setError(`เวลาทำงาน ${WORK_START}–${WORK_END} น. — เวลาเริ่มต้องไม่ก่อน ${WORK_START} และเวลาจบต้องไม่เกิน ${WORK_END}`);
        return;
      }
      if (end <= start) {
        setError("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
        return;
      }
    }
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
        override: type === "site_survey" && overrideMode ? true : undefined,
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

  // สร้างใหม่: ต้องมีสิทธิ์สร้าง / แก้ไข: ต้องมีสิทธิ์แก้ทุกงาน หรือเป็นงานของตัวเอง
  const readOnly = isEditing ? !canEditAppointment(staff, loadedAssignedId) : !can(staff, "appointments.create");

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
  const labelClass = "mb-1 block text-sm text-gray-700";

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{isEditing ? "แก้ไขนัดหมาย" : "สร้างนัดหมาย"}</h1>

      {readOnly && (
        <p className="mb-3 rounded-lg bg-gray-100 p-3 text-sm text-gray-600">คุณดูงานนี้ได้อย่างเดียว แก้ไขไม่ได้</p>
      )}
      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-4">
        <fieldset disabled={readOnly} className="space-y-4">
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

        {type === "site_survey" && canOverride && (
          <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setOverrideMode(false)}
              className={`flex-1 rounded-md py-1.5 ${!overrideMode ? "bg-white font-medium text-brand-navy shadow-sm" : "text-gray-500"}`}
            >
              เลือกจากคิว
            </button>
            <button
              type="button"
              onClick={() => setOverrideMode(true)}
              className={`flex-1 rounded-md py-1.5 ${overrideMode ? "bg-white font-medium text-brand-navy shadow-sm" : "text-gray-500"}`}
            >
              เวลาอื่น (แอดมิน)
            </button>
          </div>
        )}

        {useSlots && (
          <SurveySlotPicker
            date={slotDate}
            onDateChange={(d) => {
              setSlotDate(d);
              setStart("");
              setEnd("");
            }}
            selectedStart={start ? new Date(start).toISOString() : ""}
            selectedStaffId={assignedStaffId}
            excludeId={id}
            onPick={(slot, staffId) => {
              setStart(toLocalInputValue(slot.start));
              setEnd(toLocalInputValue(slot.end));
              setAssignedStaffId(String(staffId));
            }}
          />
        )}

        {!useSlots && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>วันเวลาเริ่ม *</label>
            <input type="datetime-local" required value={start} onChange={(e) => handleStartChange(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>วันเวลาสิ้นสุด *</label>
            <input type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </div>
          <p className="col-span-2 -mt-2 text-xs text-gray-400">เวลาทำงาน {WORK_START}–{WORK_END} น. (เลือกวันเริ่มแล้ว เวลาจบจะตั้งเป็น {WORK_END} ให้อัตโนมัติ)</p>
        </div>
        )}

        {!useSlots && (
        <div>
          <label className={labelClass}>มอบหมายให้</label>
          <select
            value={assignedStaffId}
            onChange={(e) => setAssignedStaffId(e.target.value)}
            disabled={!can(staff, "appointments.editAny")}
            className={inputClass}
          >
            <option value="">ไม่ระบุ</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        )}

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
          <textarea ref={notesRef} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none overflow-hidden`} />
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        {!readOnly && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-navy py-3 text-sm font-semibold text-white hover:bg-brand-navy-light disabled:opacity-50"
          >
            {submitting ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "สร้างนัดหมาย"}
          </button>
        )}
        </fieldset>
      </form>
    </div>
  );
}
