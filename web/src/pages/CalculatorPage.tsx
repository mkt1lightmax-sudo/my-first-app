import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  RATE_TYPES,
  RATE_TYPE_LABELS,
  GOALS,
  GOAL_LABELS,
  formatNumber,
  formatPaybackRange,
  type RateType,
  type Goal,
  type SystemComparisonResult,
} from "../lib/solar";
import { StarIcon, PanelIcon, LightningIcon, CoinIcon, ClockIcon, BatteryIcon } from "../components/icons";

type SurveyPrefill = {
  id: number;
  customer_name: string;
  monthly_bill_thb: string | null;
  monthly_usage_kwh: string | null;
  roof_area_sqm: string | null;
  roof_direction: string | null;
  shading_level: string | null;
};

export default function CalculatorPage() {
  const [searchParams] = useSearchParams();
  const surveyId = searchParams.get("surveyId");

  const [survey, setSurvey] = useState<SurveyPrefill | null>(null);
  const [monthlyBill, setMonthlyBill] = useState("");
  const [monthlyUsage, setMonthlyUsage] = useState("");
  const [dayUsagePercent, setDayUsagePercent] = useState(60);
  const [rateType, setRateType] = useState<RateType>("normal");
  const [usageDaysPerWeek, setUsageDaysPerWeek] = useState(7);
  const [goal, setGoal] = useState<Goal>("unsure");

  const [result, setResult] = useState<SystemComparisonResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    api
      .get<{ ok: true; survey: SurveyPrefill }>(`/surveys/${surveyId}`)
      .then((data) => {
        setSurvey(data.survey);
        if (data.survey.monthly_bill_thb) setMonthlyBill(data.survey.monthly_bill_thb);
        if (data.survey.monthly_usage_kwh) setMonthlyUsage(data.survey.monthly_usage_kwh);
      })
      .catch(() => {});
  }, [surveyId]);

  async function handleCalculate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<{ ok: true; result: SystemComparisonResult }>("/calculate", {
        monthly_bill_thb: monthlyBill ? Number(monthlyBill) : undefined,
        monthly_usage_kwh: monthlyUsage ? Number(monthlyUsage) : undefined,
        roof_area_sqm: survey?.roof_area_sqm ? Number(survey.roof_area_sqm) : undefined,
        roof_direction: survey?.roof_direction || undefined,
        shading_level: survey?.shading_level || undefined,
        day_usage_percent: dayUsagePercent,
        rate_type: rateType,
        usage_days_per_week: usageDaysPerWeek,
        goal,
      });
      setResult(data.result);
      setSaved(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "คำนวณไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!surveyId || !result) return;
    setSaving(true);
    try {
      await api.patch(`/surveys/${surveyId}`, {
        recommended_system_type: result.recommended,
        recommended_battery_kwh: result.recommended === "hybrid" ? result.hybrid.battery_kwh : 0,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <ResultView
        result={result}
        onAdjust={() => setResult(null)}
        onSave={surveyId ? handleSave : undefined}
        saving={saving}
        saved={saved}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">คำนวณระบบ Solar</h1>
      <p className="mt-1 text-sm text-gray-500">ข้อมูลที่ใช้คำนวณ</p>

      <form onSubmit={handleCalculate} className="mt-4 space-y-4 rounded-2xl border bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-gray-700">ค่าไฟเฉลี่ยต่อเดือน (บาท)</label>
          <input
            type="number"
            min="0"
            value={monthlyBill}
            onChange={(e) => setMonthlyBill(e.target.value)}
            placeholder="เช่น 8500"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">หน่วยไฟเฉลี่ย (หน่วย/เดือน)</label>
          <input
            type="number"
            min="0"
            value={monthlyUsage}
            onChange={(e) => setMonthlyUsage(e.target.value)}
            placeholder="เช่น 1900"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">
            การใช้ไฟ — กลางวัน {dayUsagePercent}% / กลางคืน {100 - dayUsagePercent}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={dayUsagePercent}
            onChange={(e) => setDayUsagePercent(Number(e.target.value))}
            className="w-full accent-brand-red"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">ประเภทค่าไฟ</label>
          <div className="flex gap-2">
            {RATE_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setRateType(rt)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                  rateType === rt ? "border-brand-red text-brand-red" : "border-gray-200 text-gray-500"
                }`}
              >
                {RATE_TYPE_LABELS[rt]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">วันใช้งาน</label>
          <select
            value={usageDaysPerWeek}
            onChange={(e) => setUsageDaysPerWeek(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            {[7, 6, 5, 4, 3, 2, 1].map((d) => (
              <option key={d} value={d}>
                {d} วัน/สัปดาห์
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">เป้าหมาย</label>
          <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="w-full rounded-lg border px-3 py-2 text-sm">
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {GOAL_LABELS[g]}
              </option>
            ))}
          </select>
        </div>

        {surveyId && survey && (
          <Link to={`/surveys/${surveyId}`} className="block text-sm text-brand-navy hover:underline">
            ✎ แก้ไขข้อมูลจากแบบสอบถาม ({survey.customer_name})
          </Link>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-red py-3 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50"
        >
          {submitting ? "กำลังคำนวณ..." : "คำนวณระบบ"}
        </button>
      </form>
    </div>
  );
}

function ResultView({
  result,
  onAdjust,
  onSave,
  saving,
  saved,
}: {
  result: SystemComparisonResult;
  onAdjust: () => void;
  onSave?: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const isHybrid = result.recommended === "hybrid";
  const recommendedOption = isHybrid ? result.hybrid : result.on_grid;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">ผลการคำนวณ</h1>
      <div className="mt-1 mb-4 h-1 w-10 rounded bg-brand-red" />

      <div className="rounded-2xl bg-brand-navy p-5 text-white">
        <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
          <StarIcon className="h-4 w-4 text-amber-300" />
          ระบบที่แนะนำ
        </div>
        <div className="text-2xl font-bold">
          {isHybrid ? "Hybrid" : "On-Grid"} {result.shared.recommended_kwp} kW
        </div>
        {isHybrid && <div className="mt-1 text-white/80">Battery {result.hybrid.battery_kwh} kWh</div>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatTile icon={PanelIcon} label="แผง Solar" value={`${result.shared.recommended_panel_count} แผง`} />
        <StatTile
          icon={LightningIcon}
          label="ผลิตไฟประมาณ"
          value={`${formatNumber(result.shared.estimated_monthly_generation_kwh, 0)} หน่วย/เดือน`}
        />
        <StatTile
          icon={CoinIcon}
          label="ประหยัดประมาณ"
          value={`${formatNumber(recommendedOption.estimated_monthly_savings_thb, 0)} บาท/เดือน`}
        />
        <StatTile icon={ClockIcon} label="คืนทุนประมาณ" value={formatPaybackRange(recommendedOption.estimated_payback_years)} />
      </div>

      <h2 className="mt-5 mb-2 font-medium text-gray-900">เปรียบเทียบตัวเลือก</h2>
      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          title={`On-Grid ${result.shared.recommended_kwp} kW`}
          subtitle="ลดค่าไฟช่วงกลางวัน"
          recommended={result.recommended === "on_grid"}
        />
        <OptionCard
          title={`Hybrid ${result.shared.recommended_kwp} kW + Battery ${result.hybrid.battery_kwh} kWh`}
          subtitle="ลดค่าไฟกลางวัน-กลางคืน"
          recommended={result.recommended === "hybrid"}
          icon={BatteryIcon}
        />
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onAdjust}
          className="flex-1 rounded-lg border border-brand-red py-3 text-sm font-medium text-brand-red hover:bg-brand-red/5"
        >
          ปรับข้อมูล
        </button>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving || saved}
            className="flex-1 rounded-lg bg-brand-red py-3 text-sm font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50"
          >
            {saved ? "บันทึกแล้ว ✓" : saving ? "กำลังบันทึก..." : "บันทึกผลคำนวณ"}
          </button>
        )}
      </div>
    </div>
  );
}

type IconComponent = (props: { className?: string }) => React.ReactElement;

function StatTile({ icon: Icon, label, value }: { icon: IconComponent; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <Icon className="h-5 w-5 text-brand-red" />
      <div className="mt-1 text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function OptionCard({
  title,
  subtitle,
  recommended,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  recommended: boolean;
  icon?: IconComponent;
}) {
  return (
    <div className={`relative rounded-xl border p-3 ${recommended ? "border-brand-navy" : "border-gray-200"}`}>
      {recommended && (
        <span className="absolute -top-2 right-2 rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-semibold text-white">
          แนะนำ
        </span>
      )}
      {Icon ? <Icon className="h-6 w-6 text-brand-navy" /> : <PanelIcon className="h-6 w-6 text-brand-navy" />}
      <div className="mt-2 text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
