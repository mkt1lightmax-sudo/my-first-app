import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/solar";
import { ChevronRightIcon } from "../../components/icons";

type SurveyRow = {
  id: number;
  customer_name: string;
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
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ ok: true; surveys: SurveyRow[] }>("/surveys")
      .then((data) => setSurveys(data.surveys))
      .catch(() => setError("โหลดรายการแบบสำรวจไม่สำเร็จ"));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ลูกค้า / แบบสำรวจ</h1>
        <Link
          to="/surveys/new"
          className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
        >
          + สร้างใหม่
        </Link>
      </div>

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
              <div className="font-medium text-gray-900">{s.customer_name}</div>
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
