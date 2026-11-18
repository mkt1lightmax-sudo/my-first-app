import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";
import { formatBaht } from "../../lib/chat";
import { ChevronLeftIcon } from "../../components/icons";

type StaffRow = { staff_id: number | null; staff_name: string; won_amount: number; won_count: number; lost_count: number; pending_count: number };
type Deal = {
  id: number;
  conversation_id: number;
  ticket_seq: number;
  amount: number | null;
  outcome: "won" | "lost" | null;
  note: string | null;
  updated_at: string;
  customer_name: string | null;
  staff_name: string;
};
type Report = {
  from: string;
  to: string;
  scope: "all" | "mine";
  summary: { won_amount: number; won_count: number; lost_count: number; pending_count: number; pending_amount: number; win_rate: number | null };
  by_staff: StaffRow[];
  recent: Deal[];
};

type Preset = "month" | "lastMonth" | "7d" | "30d" | "custom";

// วันที่ตามเวลาเครื่อง (ไทย) เป็น YYYY-MM-DD
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  if (p === "lastMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return [ymd(first), ymd(last)];
  }
  if (p === "7d" || p === "30d") {
    const from = new Date(now);
    from.setDate(now.getDate() - (p === "7d" ? 6 : 29));
    return [ymd(from), ymd(now)];
  }
  return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
}

const PRESETS: [Preset, string][] = [
  ["month", "เดือนนี้"],
  ["lastMonth", "เดือนก่อน"],
  ["7d", "7 วัน"],
  ["30d", "30 วัน"],
  ["custom", "กำหนดเอง"],
];

export default function ChatReportPage() {
  const { staff } = useAuth();
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<[string, string]>(presetRange("month"));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .get<{ ok: true } & Report>(`/chat/reports/sales?from=${range[0]}&to=${range[1]}`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "โหลดรายงานไม่สำเร็จ"));
  }, [range]);

  if (staff && !can(staff, "reports.view")) return <Navigate to="/" replace />;

  const maxWon = Math.max(1, ...(report?.by_staff.map((r) => r.won_amount) ?? [0]));
  const s = report?.summary;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/chat" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label="กลับ">
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">รายงานยอดขาย</h1>
          <p className="text-xs text-gray-500">{report?.scope === "mine" ? "เฉพาะยอดของคุณ" : "ยอดจากแชททุกช่องทาง"}</p>
        </div>
      </div>

      {/* ช่วงเวลา */}
      <div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {PRESETS.map(([p, label]) => (
            <button
              key={p}
              onClick={() => {
                setPreset(p);
                if (p !== "custom") setRange(presetRange(p));
              }}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
                preset === p ? "bg-brand-navy text-white" : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input type="date" value={range[0]} max={range[1]} onChange={(e) => e.target.value && setRange([e.target.value, range[1]])} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200" />
            <span className="text-gray-400">ถึง</span>
            <input type="date" value={range[1]} min={range[0]} onChange={(e) => e.target.value && setRange([range[0], e.target.value])} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200" />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {/* ตัวเลขสรุป */}
      <div className="rounded-3xl bg-brand-navy p-5 text-white shadow-sm">
        <p className="text-sm text-white/70">ยอดขายที่ปิดได้</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{s ? formatBaht(s.won_amount) : "…"}</p>
        <p className="mt-1 text-xs text-white/60">
          {report ? `${formatThaiDate(report.from)} – ${formatThaiDate(report.to)}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="ปิดได้" value={s?.won_count} suffix="ราย" />
        <Stat label="ปิดไม่ได้" value={s?.lost_count} suffix="ราย" />
        <Stat label="อัตราปิดการขาย" value={s?.win_rate ?? undefined} suffix="%" empty={s && s.win_rate === null ? "–" : undefined} />
      </div>
      {s && s.pending_count > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ยังไม่สรุปอีก {s.pending_count} ราย{s.pending_amount > 0 ? ` (ยอดรวม ${formatBaht(s.pending_amount)})` : ""}
        </p>
      )}

      {/* ยอดต่อเซลล์ */}
      {report?.scope === "all" && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-4 text-base font-semibold text-gray-900">ยอดขายต่อคน</h2>
          {report.by_staff.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีการบันทึกยอดขายในช่วงนี้</p>
          ) : (
            <ul className="space-y-4">
              {report.by_staff.map((r) => (
                <li
                  key={r.staff_id ?? "none"}
                  title={`${r.staff_name}: ${formatBaht(r.won_amount)} · ปิดได้ ${r.won_count} · ไม่ได้ ${r.lost_count} · ยังไม่สรุป ${r.pending_count}`}
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-800">{r.staff_name}</span>
                    <span className="flex-shrink-0 text-sm font-semibold text-gray-900">{formatBaht(r.won_amount)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-brand-navy transition-all"
                      style={{ width: `${r.won_amount > 0 ? Math.max(2, (r.won_amount / maxWon) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    ปิดได้ {r.won_count} · ไม่ได้ {r.lost_count}
                    {r.pending_count > 0 ? ` · ยังไม่สรุป ${r.pending_count}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* รายการล่าสุด */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
        <h2 className="px-5 pb-2 pt-5 text-base font-semibold text-gray-900">บันทึกล่าสุด</h2>
        {report && report.recent.length === 0 && <p className="px-5 pb-5 text-sm text-gray-500">ยังไม่มีรายการ</p>}
        <ul className="divide-y divide-gray-100">
          {report?.recent.map((d) => (
            <li key={d.id}>
              <Link to={`/chat/${d.conversation_id}`} className="flex items-center gap-3 px-5 py-3 active:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{d.customer_name || "ลูกค้า"}</p>
                  <p className="truncate text-xs text-gray-500">
                    {d.staff_name} · {new Date(d.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-gray-900">{formatBaht(d.amount)}</span>
                  <OutcomeBadge outcome={d.outcome} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, suffix, empty }: { label: string; value: number | undefined; suffix: string; empty?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-gray-100">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">
        {empty ?? (value === undefined ? "…" : value)}
        {!empty && value !== undefined && <span className="ml-0.5 text-xs font-normal text-gray-500">{suffix}</span>}
      </p>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: "won" | "lost" | null }) {
  if (outcome === "won") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">✓ ปิดได้</span>;
  if (outcome === "lost") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-brand-red ring-1 ring-red-200">✕ ไม่ได้</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">ยังไม่สรุป</span>;
}

function formatThaiDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
