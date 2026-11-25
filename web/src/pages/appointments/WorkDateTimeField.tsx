// ช่องเลือกวัน + เวลา ที่เลือกได้เฉพาะเวลาทำงาน 08:00–18:00 (ทีละ 30 นาที) — กันกรอกเวลาผิด
// value / onChange ใช้รูปแบบเดียวกับ datetime-local: "YYYY-MM-DDTHH:MM"

export const WORK_START = "08:00";
export const WORK_END = "18:00";

// 08:00, 08:30, ..., 18:00
export const WORK_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 18 * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
})();

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  kind: "start" | "end"; // เวลาเริ่มเลือกได้ถึง 17:30, เวลาจบเลือกได้ตั้งแต่ 08:30
};

export default function WorkDateTimeField({ label, value, onChange, kind }: Props) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  const times = kind === "start" ? WORK_TIMES.slice(0, -1) : WORK_TIMES.slice(1);
  // เวลาเดิมที่อยู่นอกช่วง (งานเก่า) — แสดงให้เห็นแต่ต้องเลือกใหม่
  const outOfRange = Boolean(time) && !times.includes(time);
  const defaultTime = kind === "start" ? WORK_START : WORK_END;

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          type="date"
          required
          value={date}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}T${time && !outOfRange ? time : defaultTime}` : "")}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          required
          value={outOfRange ? "" : time}
          onChange={(e) => onChange(`${date || new Date().toISOString().slice(0, 10)}T${e.target.value}`)}
          className={`w-24 rounded-lg border px-2 py-2 text-sm ${outOfRange ? "border-red-400 bg-red-50/40" : ""}`}
        >
          <option value="" disabled>
            {outOfRange ? `${time} ✕` : "เวลา"}
          </option>
          {times.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {outOfRange && <p className="mt-1 text-xs text-red-600">เวลาเดิม {time} อยู่นอกเวลาทำงาน — เลือกเวลาใหม่</p>}
    </div>
  );
}
