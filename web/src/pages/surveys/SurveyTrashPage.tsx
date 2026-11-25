import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { ChevronLeftIcon } from "../../components/icons";

type TrashRow = {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
  purge_at: string;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

// ถังขยะลูกค้า (แอดมิน/เจ้าของ) — กู้คืนได้ภายใน 30 วันหลังลบ
export default function SurveyTrashPage() {
  const [rows, setRows] = useState<TrashRow[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    api
      .get<{ ok: true; surveys: TrashRow[]; days: number }>("/surveys/trash")
      .then((d) => {
        setRows(d.surveys);
        setDays(d.days);
      })
      .catch(() => setError("โหลดถังขยะไม่สำเร็จ"));
  }

  useEffect(load, []);

  async function restore(r: TrashRow) {
    setBusyId(r.id);
    setError(null);
    try {
      await api.post(`/surveys/${r.id}/restore`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <Link to="/surveys" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100" aria-label="กลับ">
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">ถังขยะลูกค้า</h1>
      </div>
      <p className="mb-4 text-sm text-gray-500">ลูกค้าที่ถูกลบจะอยู่ที่นี่ {days} วัน กู้คืนได้ หลังจากนั้นจะลบถาวร</p>

      {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-gray-400">ถังขยะว่าง</p>}

      <div className="space-y-2">
        {rows?.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4">
            <div className="min-w-0">
              <div className="truncate font-medium text-gray-900">{r.customer_name}</div>
              <div className="text-xs text-gray-500">
                ลบโดย {r.deleted_by_name || "-"} · {fmt(r.deleted_at)} · ลบถาวร {fmt(r.purge_at)}
              </div>
            </div>
            <button
              onClick={() => restore(r)}
              disabled={busyId === r.id}
              className="flex-shrink-0 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busyId === r.id ? "กำลังกู้..." : "กู้คืน"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
