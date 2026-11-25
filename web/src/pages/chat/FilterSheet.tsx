import { useState } from "react";
import AssigneeList from "./AssigneeList";
import { CHANNEL_LABELS, EMPTY_FILTERS, type AssigneeCount, type ChatAccount, type ChatFilters } from "../../lib/chat";

// แผงตัวกรองที่เลื่อนขึ้นจากด้านล่าง (แบบแอปมือถือ)
export default function FilterSheet({
  value,
  tags,
  accounts,
  canSeeUnassigned,
  assignees = [],
  unassignedCount = null,
  onApply,
  onClose,
}: {
  value: ChatFilters;
  tags: string[];
  accounts: ChatAccount[];
  canSeeUnassigned: boolean;
  assignees?: AssigneeCount[]; // แสดงหัวข้อ "ผู้ดูแล" เมื่อมีข้อมูล (เจ้าของ/แอดมิน/ผู้ช่วยแอดมิน)
  unassignedCount?: { count: number; pending: number } | null;
  onApply: (f: ChatFilters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<ChatFilters>(value);
  const set = <K extends keyof ChatFilters>(key: K, v: ChatFilters[K]) => setF((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <button onClick={onClose} className="text-sm text-gray-500">
            ปิด
          </button>
          <div className="flex flex-col items-center">
            <span className="mb-2 h-1 w-10 rounded-full bg-gray-200" />
            <span className="text-base font-semibold text-gray-900">ตัวกรอง</span>
          </div>
          <button onClick={() => setF(EMPTY_FILTERS)} className="text-sm font-medium text-brand-red">
            รีเซ็ต
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-4 pt-2">
          <Section title="สถานะการอ่าน">
            <Segmented
              value={f.read}
              onChange={(v) => set("read", v)}
              options={[
                ["", "ทั้งหมด"],
                ["unread", "ยังไม่อ่าน"],
                ["read", "อ่านแล้ว"],
              ]}
            />
          </Section>

          <Section title="สถานะการตอบ">
            <Segmented
              value={f.replied}
              onChange={(v) => set("replied", v)}
              options={[
                ["", "ทั้งหมด"],
                ["no", "ยังไม่ได้ตอบ"],
                ["yes", "ตอบแล้ว"],
              ]}
            />
          </Section>

          <Section title="ลำดับการเรียง">
            <Segmented
              value={f.sort}
              onChange={(v) => set("sort", v)}
              options={[
                ["new", "ใหม่ → เก่า"],
                ["old", "เก่า → ใหม่"],
              ]}
            />
          </Section>

          {tags.length > 0 && (
            <Section title="แท็กลูกค้า">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Chip key={t} active={f.tag === t} onClick={() => set("tag", f.tag === t ? "" : t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {accounts.length > 0 && (
            <Section title="ช่องทาง / บัญชี">
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <Chip key={a.id} active={f.account === String(a.id)} onClick={() => set("account", f.account === String(a.id) ? "" : String(a.id))}>
                    {CHANNEL_LABELS[a.channel]} · {a.name}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {assignees.length > 0 && (
            <Section title="ผู้ดูแล (เซล)">
              {/* เลือกได้หลายคน */}
              <AssigneeList
                items={assignees}
                unassigned={unassignedCount}
                isSelected={(c) =>
                  c === "all" ? f.assignees.length === 0 && !f.unassigned : c === "unassigned" ? f.unassigned : f.assignees.includes(c)
                }
                onPick={(c) => {
                  if (c === "all") setF((p) => ({ ...p, assignees: [], unassigned: false }));
                  else if (c === "unassigned") setF((p) => ({ ...p, unassigned: !p.unassigned, assignees: [] }));
                  else
                    setF((p) => ({
                      ...p,
                      unassigned: false,
                      assignees: p.assignees.includes(c) ? p.assignees.filter((x) => x !== c) : [...p.assignees, c],
                    }));
                }}
              />
            </Section>
          )}

          <Section title="อื่นๆ">
            <div className="divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-100">
              <Toggle label="เฉพาะที่ฉันติดตาม" checked={f.followed} onChange={(v) => set("followed", v)} />
              {canSeeUnassigned && <Toggle label="ยังไม่มีคนดูแล" checked={f.unassigned} onChange={(v) => set("unassigned", v)} />}
              <Toggle label="ดูแชทที่เป็นสแปม" checked={f.spam} onChange={(v) => set("spam", v)} />
            </div>
          </Section>
        </div>

        <div className="border-t border-gray-100 px-5 pb-6 pt-3">
          <button onClick={() => onApply(f)} className="w-full rounded-2xl bg-brand-navy py-3.5 text-sm font-semibold text-white active:opacity-90">
            แสดงผล
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
      {options.map(([v, label]) => (
        <button
          key={v || "all"}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-xl py-2 text-sm transition ${value === v ? "bg-white font-medium text-brand-navy shadow-sm" : "text-gray-500"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm transition ${
        active ? "bg-brand-navy text-white" : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-brand-navy" : "bg-gray-200"}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
