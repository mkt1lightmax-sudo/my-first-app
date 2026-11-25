import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeftIcon } from "../components/icons";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/permissions";

// คำนวณระบบ + ภาพนำเสนอลูกค้า (ไฟล์ HTML เดิม) — เซิร์ฟเวอร์ส่งให้เฉพาะคนที่ล็อกอินแล้ว
// เปิดจากข้อมูลลูกค้า (?surveyId=) → เติมชื่อ/ค่าไฟให้อัตโนมัติ และมีปุ่มบันทึกผลกลับเข้าข้อมูลลูกค้า
const TOOL_URL = "/api/tools/presentation";

type SurveyPrefill = {
  id: number;
  customer_name: string;
  monthly_bill_thb: string | null;
  monthly_usage_kwh: string | null;
};

// ผลที่อ่านจากเครื่องมือ (ฟังก์ชัน calc(S) ในไฟล์ HTML)
type ToolResult = { hybrid: boolean; hasBat: boolean; batKwhTot: number; kwp: number };

type ToolWindow = Window & { eval: (code: string) => unknown };

export default function PresentationPage() {
  const [params] = useSearchParams();
  const surveyId = params.get("surveyId");
  const { staff } = useAuth();
  const [canEditSurvey, setCanEditSurvey] = useState(false);
  const canSave = Boolean(surveyId) && can(staff, "customers.edit") && canEditSurvey;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [survey, setSurvey] = useState<SurveyPrefill | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    api
      .get<{ ok: true; survey: SurveyPrefill; canEdit: boolean }>(`/surveys/${surveyId}`)
      .then((d) => {
        setSurvey(d.survey);
        setCanEditSurvey(d.canEdit);
      })
      .catch(() => setSurvey(null));
  }, [surveyId]);

  // เติมข้อมูลลูกค้าลงฟอร์มของเครื่องมือ — ตั้งค่าในช่องแล้วยิง event ให้เครื่องมือคำนวณเอง
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!loaded || !survey || !doc) return;
    const set = (id: string, value: string | null | undefined) => {
      const el = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!el || value == null || value === "") return;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set("custName", survey.customer_name);
    if (survey.monthly_usage_kwh) {
      set("useMode", "units");
      set("monthly", String(Number(survey.monthly_usage_kwh)));
    } else if (survey.monthly_bill_thb) {
      set("useMode", "bill");
      set("bill", String(Number(survey.monthly_bill_thb)));
    }
  }, [loaded, survey]);

  async function saveToCustomer() {
    const win = frameRef.current?.contentWindow as ToolWindow | null;
    if (!surveyId || !win) return;
    setMessage(null);
    let r: ToolResult;
    try {
      r = win.eval("calc(S)") as ToolResult;
    } catch {
      setMessage({ ok: false, text: "อ่านผลคำนวณไม่ได้ ลองกรอกข้อมูลให้ครบก่อน" });
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/surveys/${surveyId}`, {
        recommended_system_type: r.hybrid ? "hybrid" : "on_grid",
        recommended_battery_kwh: r.hasBat ? Math.round(r.batKwhTot * 10) / 10 : 0,
      });
      const kw = r.kwp ? ` ${Math.round(r.kwp * 100) / 100} kW` : "";
      setMessage({ ok: true, text: `บันทึกแล้ว: ${r.hybrid ? "Hybrid" : "On-grid"}${kw}${r.hasBat ? ` แบต ${r.batKwhTot} kWh` : ""}` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-7.5rem)] flex-col md:-mx-6 md:h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            to={surveyId ? `/surveys/${surveyId}` : "/"}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
            aria-label="กลับ"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-gray-900">คำนวณระบบ & ภาพนำเสนอ</h1>
            {survey && <p className="truncate text-xs text-gray-500">ลูกค้า: {survey.customer_name}</p>}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {canSave && (
            <button
              onClick={saveToCustomer}
              disabled={saving || !loaded}
              className="rounded-full bg-brand-navy px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกเข้าลูกค้า"}
            </button>
          )}
          <a href={TOOL_URL} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 text-sm text-brand-navy hover:bg-brand-navy/5 sm:block">
            เปิดเต็มจอ ↗
          </a>
        </div>
      </div>
      {message && (
        <p className={`px-4 py-2 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}
      <iframe
        ref={frameRef}
        src={TOOL_URL}
        title="คำนวณระบบ & ภาพนำเสนอ"
        onLoad={() => setLoaded(true)}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
