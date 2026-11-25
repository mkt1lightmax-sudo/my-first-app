import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { SurveySlot } from "../../lib/appointments";

// เลือกคิวสำรวจ: เลือกวัน → แต่ละช่องเวลาบอกช่างที่ว่าง → แตะชื่อช่างเพื่อจอง
// ช่างที่ไม่ว่างแสดงเป็นสีเทาพร้อมเหตุผล (ติดงาน / หยุด)
type Props = {
  date: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  selectedStart: string; // ISO ของช่องที่เลือก
  selectedStaffId: string;
  excludeId?: string; // งานที่กำลังแก้ (ไม่นับว่าชนกับตัวเอง)
  onPick: (slot: SurveySlot, staffId: number) => void;
};

export default function SurveySlotPicker({ date, onDateChange, selectedStart, selectedStaffId, excludeId, onPick }: Props) {
  const [slots, setSlots] = useState<SurveySlot[] | null>(null);
  const [surveyorCount, setSurveyorCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setSlots(null);
    setError(null);
    const q = new URLSearchParams({ date });
    if (excludeId) q.set("exclude", excludeId);
    api
      .get<{ ok: true; slots: SurveySlot[]; surveyors: unknown[] }>(`/appointments/survey-slots?${q}`)
      .then((d) => {
        setSlots(d.slots);
        setSurveyorCount(d.surveyors.length);
      })
      .catch(() => setError("โหลดคิวไม่สำเร็จ"));
  }, [date, excludeId]);

  const selectedMs = selectedStart ? new Date(selectedStart).getTime() : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-gray-700">วันที่สำรวจ *</label>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      {date && !slots && !error && <p className="text-sm text-gray-400">กำลังโหลดคิว...</p>}
      {slots && surveyorCount === 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          ยังไม่มีพนักงานตำแหน่ง "ผู้สำรวจ" — เพิ่มที่เมนูจัดการพนักงานก่อน
        </p>
      )}

      {slots && surveyorCount > 0 && (
        <div className="divide-y divide-gray-100 rounded-xl border">
          {slots.map((slot) => {
            const full = slot.free.length === 0;
            const isSelectedSlot = selectedMs === new Date(slot.start).getTime();
            return (
              <div key={slot.time} className={`flex gap-3 px-3 py-2.5 ${full ? "bg-gray-50" : ""}`}>
                <div className="w-14 flex-shrink-0 pt-1">
                  <div className={`font-medium ${full ? "text-gray-400" : "text-gray-900"}`}>{slot.time}</div>
                  <div className="text-[11px] text-gray-400">2 ชม.</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {slot.free.map((s) => {
                    const picked = isSelectedSlot && selectedStaffId === String(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onPick(slot, s.id)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          picked
                            ? "border-brand-navy bg-brand-navy text-white"
                            : "border-[#86A893] bg-[#EDF4EF] text-[#4C6B57] hover:bg-[#E1EDE5]"
                        }`}
                      >
                        {picked ? "✓ " : ""}
                        {s.name}
                      </button>
                    );
                  })}
                  {slot.busy.map((s) => (
                    <span key={s.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400" title={s.reason}>
                      {s.name} · {s.reason}
                    </span>
                  ))}
                  {full && <span className="text-xs text-gray-400">เต็ม</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
