import { useState } from "react";
import type { AssigneeCount } from "../../lib/chat";

// รายชื่อผู้ดูแล (เซล) พร้อมจำนวนแชท / ค้างตอบ + ช่องค้นหา — ใช้ทั้งในแผงเลือกผู้ดูแล และหน้าตัวกรอง
export type AssigneeChoice = "all" | "unassigned" | number;

type Props = {
  items: AssigneeCount[];
  unassigned?: { count: number; pending: number } | null;
  isSelected: (choice: AssigneeChoice) => boolean;
  onPick: (choice: AssigneeChoice) => void;
  showAll?: boolean; // แสดงแถว "ทุกคน"
};

export default function AssigneeList({ items, unassigned, isSelected, onPick, showAll = true }: Props) {
  const [q, setQ] = useState("");
  const filtered = q.trim() ? items.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())) : items;
  const total = items.reduce((n, a) => n + a.count, 0) + (unassigned?.count ?? 0);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 ค้นหาชื่อ..."
        className="mb-2 w-full rounded-xl bg-gray-100 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
      />
      <div className="divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-100">
        {!q.trim() && showAll && <Row label="ทุกคน" count={total} selected={isSelected("all")} onClick={() => onPick("all")} />}
        {!q.trim() && unassigned && (
          <Row label="ยังไม่มีคนดูแล" count={unassigned.count} pending={unassigned.pending} selected={isSelected("unassigned")} onClick={() => onPick("unassigned")} />
        )}
        {filtered.map((a) => (
          <Row key={a.id} label={a.name} count={a.count} pending={a.pending} selected={isSelected(a.id)} onClick={() => onPick(a.id)} />
        ))}
        {filtered.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">ไม่พบชื่อนี้</p>}
      </div>
    </div>
  );
}

function Row({ label, count, pending, selected, onClick }: { label: string; count: number; pending?: number; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50">
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] ${
          selected ? "border-brand-navy bg-brand-navy text-white" : "border-gray-300"
        }`}
      >
        {selected ? "✓" : ""}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${count === 0 ? "text-gray-400" : "text-gray-900"}`}>{label}</span>
      <span className="flex-shrink-0 text-xs text-gray-500">
        {count} แชท
        {pending ? <span className="ml-1.5 rounded-full bg-[#FBEFE3] px-1.5 py-0.5 text-[#9A5B23]">ค้างตอบ {pending}</span> : null}
      </span>
    </button>
  );
}
