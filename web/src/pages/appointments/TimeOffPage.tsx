import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";
import { TIME_OFF_LABELS, type TimeOff, type TimeOffPeriod } from "../../lib/appointments";
import { ChevronLeftIcon } from "../../components/icons";

type StaffOption = { id: number; name: string; role: string };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatThaiDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// แจ้งหยุด — ช่างแจ้งของตัวเอง, แอดมิน/ผู้ช่วยแอดมินแจ้งแทนได้ วันที่หยุดจะจองคิวสำรวจช่างคนนั้นไม่ได้
export default function TimeOffPage() {
  const { staff } = useAuth();
  const manageAll = can(staff, "timeoff.manageAll");
  const [list, setList] = useState<TimeOff[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffId, setStaffId] = useState(String(staff?.id ?? ""));
  const [date, setDate] = useState(keyOf(new Date()));
  const [period, setPeriod] = useState<TimeOffPeriod>("full");
  const [note, setNote] = useState("");
  const [coverId, setCoverId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const from = keyOf(new Date());
    const to = keyOf(new Date(Date.now() + 120 * 86400000));
    api
      .get<{ ok: true; timeOff: TimeOff[] }>(`/time-off?from=${from}&to=${to}`)
      .then((d) => setList(d.timeOff))
      .catch(() => setList([]));
  }

  useEffect(() => {
    load();
    api.get<{ ok: true; staff: StaffOption[] }>("/staff").then((d) => setStaffList(d.staff)).catch(() => {});
  }, [manageAll]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/time-off", {
        off_date: date,
        period,
        note: note || undefined,
        staff_id: Number(staffId) || undefined,
        cover_staff_id: coverId ? Number(coverId) : undefined,
      });
      setNote("");
      setCoverId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: TimeOff) {
    if (!window.confirm(`ยกเลิกวันหยุด ${t.staff_name} วันที่ ${formatThaiDate(t.off_date)}?`)) return;
    try {
      await api.delete(`/time-off/${t.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm";
  // แสดงเฉพาะของตัวเอง ถ้าไม่ใช่แอดมิน
  const visible = manageAll ? list : list.filter((t) => t.staff_id === staff?.id);

  return (
    <div>
      <div className="mb-4 flex items-center gap-1">
        <Link to="/calendar" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label="กลับ">
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">แจ้งหยุด</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-4">
        {manageAll && (
          <div>
            <label className="mb-1 block text-sm text-gray-700">พนักงาน</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.role === "surveyor" ? " (ผู้สำรวจ)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-gray-700">วันที่หยุด</label>
          <input type="date" required value={date} min={keyOf(new Date())} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700">ช่วงที่หยุด</label>
          <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
            {(Object.keys(TIME_OFF_LABELS) as TimeOffPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-md py-1.5 ${period === p ? "bg-white font-medium text-brand-navy shadow-sm" : "text-gray-500"}`}
              >
                {TIME_OFF_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">ครึ่งเช้า = ก่อน 12:00 · ครึ่งบ่าย = ตั้งแต่ 13:00</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700">ฝากงานให้ (ถ้ามี)</label>
          <select value={coverId} onChange={(e) => setCoverId(e.target.value)} className={inputClass}>
            <option value="">ไม่ฝาก</option>
            {staffList
              .filter((s) => String(s.id) !== String(staffId))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            วันที่หยุด คนที่รับฝากจะเห็น/ตอบแชท แก้ลูกค้า และได้แจ้งเตือนแทน — หมดเองอัตโนมัติเมื่อพ้นวันหยุด
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700">หมายเหตุ (ถ้ามี)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-brand-navy py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "บันทึกวันหยุด"}
        </button>
      </form>

      <h2 className="mt-5 mb-2 font-medium text-gray-900">วันหยุดที่แจ้งไว้</h2>
      {visible.length === 0 && <p className="text-sm text-gray-400">ยังไม่มี</p>}
      <div className="space-y-2">
        {visible.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
            <div>
              <div className="font-medium text-gray-900">
                {formatThaiDate(t.off_date)} · {TIME_OFF_LABELS[t.period]}
              </div>
              <div className="text-xs text-gray-500">
                {t.staff_name}
                {t.cover_name ? ` · ฝากงานให้ ${t.cover_name}` : ""}
                {t.note ? ` · ${t.note}` : ""}
              </div>
            </div>
            {(manageAll || t.staff_id === staff?.id) && (
              <button onClick={() => remove(t)} className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
                ยกเลิก
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
