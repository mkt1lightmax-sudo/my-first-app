import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/solar";
import { ChevronRightIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_STYLES, type CustomerStatus } from "../../lib/survey";

type SurveyRow = {
  id: number;
  customer_name: string;
  customer_code: string | null;
  customer_phone: string | null;
  status: CustomerStatus;
  recommended_kwp: string | null;
  created_at: string;
  created_by_name: string | null;
};

type Creator = { id: number; name: string; count: number };

export default function SurveyListPage() {
  const { staff } = useAuth();
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [creatorId, setCreatorId] = useState("");

  // ค้นหา / กรอง (รอพิมพ์เสร็จ 0.3 วิ ค่อยค้น)
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (search.trim()) p.set("q", search.trim());
      if (status) p.set("status", status);
      if (creatorId) p.set("created_by", creatorId);
      api
        .get<{ ok: true; surveys: SurveyRow[]; creators?: Creator[] }>(`/surveys${p.size ? `?${p}` : ""}`)
        .then((data) => {
          setSurveys(data.surveys);
          if (data.creators) setCreators(data.creators);
        })
        .catch(() => setError("โหลดรายการลูกค้าไม่สำเร็จ"));
    }, 300);
    return () => clearTimeout(t);
  }, [search, status, creatorId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ลูกค้า / แบบสำรวจ</h1>
        <div className="flex items-center gap-2">
          {can(staff, "customers.editAll") && (
            <Link to="/surveys/trash" className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
              ถังขยะ
            </Link>
          )}
          {can(staff, "customers.create") && (
            <Link to="/surveys/new" className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light">
              + สร้างใหม่
            </Link>
          )}
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหารหัสลูกค้า ชื่อ หรือเบอร์โทร"
        className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
      />

      {/* กรองตามสถานะ */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 text-sm">
        {(["", ...CUSTOMER_STATUSES] as const).map((st) => (
          <button
            key={st || "all"}
            onClick={() => setStatus(st)}
            className={`flex-shrink-0 rounded-full px-3 py-1 ${
              status === st ? "bg-brand-navy text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"
            }`}
          >
            {st ? CUSTOMER_STATUS_LABELS[st] : "ทุกสถานะ"}
          </button>
        ))}
      </div>

      {/* กรองตามผู้สร้าง (เจ้าของ / แอดมิน / ผู้ช่วยแอดมิน) */}
      {creators.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-xs text-gray-400">ผู้สร้าง / เซล:</span>
          <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className="rounded-full border bg-white px-3 py-1 text-sm">
            <option value="">ทุกคน</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {surveys && surveys.length === 0 && <p className="text-gray-500">ไม่พบลูกค้า</p>}

      <div className="space-y-2">
        {surveys?.map((s) => (
          <Link key={s.id} to={`/surveys/${s.id}`} className="flex items-center justify-between rounded-xl border bg-white p-4 hover:bg-gray-50">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-gray-900">{s.customer_name}</span>
                {s.customer_code && <span className="text-xs text-gray-400">{s.customer_code}</span>}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CUSTOMER_STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {CUSTOMER_STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {s.customer_phone ?? "ไม่มีเบอร์โทร"} · {new Date(s.created_at).toLocaleDateString("th-TH")}
                {s.created_by_name && <span className="text-brand-navy"> · สร้างโดย {s.created_by_name}</span>}
              </div>
              {s.recommended_kwp && <div className="mt-1 text-sm font-medium text-brand-navy">{formatNumber(s.recommended_kwp)} kWp</div>}
            </div>
            <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
