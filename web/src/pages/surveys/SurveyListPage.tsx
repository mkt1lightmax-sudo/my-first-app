import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/solar";
import { ChevronRightIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";

type SurveyRow = {
  id: number;
  customer_name: string;
  customer_code: string | null;
  customer_phone: string | null;
  status: string;
  recommended_kwp: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  submitted: "ส่งแล้ว",
  reviewed: "ตรวจแล้ว",
};

export default function SurveyListPage() {
  const { staff } = useAuth();
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ค้นหาด้วยรหัสลูกค้า / ชื่อ / เบอร์โทร (รอพิมพ์เสร็จ 0.3 วิ ค่อยค้น)
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      api
        .get<{ ok: true; surveys: SurveyRow[] }>(`/surveys${q}`)
        .then((data) => setSurveys(data.surveys))
        .catch(() => setError("โหลดรายการแบบสำรวจไม่สำเร็จ"));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

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
          <Link
            to="/surveys/new"
            className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
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
        className="mb-3 w-full rounded-lg border bg-white px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-brand-red">{error}</p>}

      {surveys && surveys.length === 0 && <p className="text-gray-500">ยังไม่มีแบบสำรวจ</p>}

      <div className="space-y-2">
        {surveys?.map((s) => (
          <Link
            key={s.id}
            to={`/surveys/${s.id}`}
            className="flex items-center justify-between rounded-xl border bg-white p-4 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium text-gray-900">
                {s.customer_name}
                {s.customer_code && <span className="ml-2 text-xs font-normal text-gray-400">{s.customer_code}</span>}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {s.customer_phone ?? "ไม่มีเบอร์โทร"} · {STATUS_LABELS[s.status] ?? s.status} ·{" "}
                {new Date(s.created_at).toLocaleDateString("th-TH")}
              </div>
              {s.recommended_kwp && (
                <div className="mt-1 text-sm font-medium text-brand-navy">{formatNumber(s.recommended_kwp)} kWp</div>
              )}
            </div>
            <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
