import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import MapPinPicker, { googleMapsUrl } from "../../components/MapPinPicker";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_STYLES, type CustomerStatus } from "../../lib/survey";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";
import { ROOF_DIRECTION_LABELS, type RoofDirection, type SolarCalcResult } from "../../lib/solar";
import {
  SITE_TYPE_LABELS,
  BILL_RANGE_LABELS,
  CAN_SEND_BILL_LABELS,
  PEAK_USAGE_TIME_LABELS,
  WEEKEND_USAGE_LABELS,
  MAIN_EQUIPMENT_LABELS,
  AC_USAGE_PERIOD_LABELS,
  METER_TYPE_LABELS,
  CUSTOMER_NEED_LABELS,
  INTERESTED_SYSTEM_LABELS,
  ROOF_TYPE_LABELS,
  SHADING_PRESENCE_LABELS,
  REQUESTED_PHOTO_LABELS,
  BATTERY_INTEREST_OPTIONS,
  BATTERY_INTEREST_LABELS,
  type BatteryInterest,
  DOCUMENTS_RECEIVED_OPTIONS,
  DOCUMENTS_RECEIVED_LABELS,
  type DocumentReceived,
} from "../../lib/survey";
import SolarResultCard from "../../components/SolarResultCard";
import FormSection from "../../components/FormSection";
import RadioGroup from "../../components/RadioGroup";
import CheckboxGroup from "../../components/CheckboxGroup";

type Survey = Record<string, unknown> & {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  roof_area_sqm: string | null;
  roof_direction: RoofDirection | null;
  ac_count: number | null;
  meter_type: string | null;
  monthly_bill_thb: string | null;
  site_type: string | null;
  peak_usage_time: string | null;
  interested_system: string | null;
  notes: string | null;
  battery_interest: BatteryInterest | null;
  documents_received: DocumentReceived[] | null;
};

function field(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function labelOrDash<T extends string>(v: T | null | undefined, labels: Record<T, string>): string {
  if (!v) return "-";
  return labels[v] ?? v;
}

function listOrDash<T extends string>(v: T[] | null | undefined, labels: Record<T, string>): string {
  if (!v || v.length === 0) return "-";
  return v.map((x) => labels[x] ?? x).join(", ");
}

export default function SurveyDetailPage() {
  const { staff } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  // แก้ได้ไหม (เซิร์ฟเวอร์บอก: แอดมินแก้ได้ทุกคน, คนอื่นเฉพาะที่ตัวเองสร้าง/ได้รับมอบหมาย)
  const [canEdit, setCanEdit] = useState(false);
  const canDelete = can(staff, "customers.editAll");
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [calculation, setCalculation] = useState<SolarCalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  const [batteryInterest, setBatteryInterest] = useState<BatteryInterest | "">("");
  const [documentsReceived, setDocumentsReceived] = useState<DocumentReceived[]>([]);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    api
      .get<{ ok: true; survey: Survey; calculation: SolarCalcResult | null; canEdit: boolean }>(`/surveys/${id}`)
      .then((data) => {
        setSurvey(data.survey);
        setCanEdit(data.canEdit);
        setCalculation(data.calculation);
        setBatteryInterest(data.survey.battery_interest ?? "");
        setDocumentsReceived(data.survey.documents_received ?? []);
      })
      .catch(() => setError("โหลดแบบสำรวจไม่สำเร็จ"));
  }

  async function loadHistory() {
    const d = await api.get<{ ok: true; history: HistoryRow[] }>(`/surveys/${id}/history`);
    setHistory(d.history);
  }

  async function handleDelete() {
    if (!window.confirm(`ย้าย "${survey?.customer_name}" ไปถังขยะ?\n(กู้คืนได้ภายใน 30 วัน ที่เมนู ลูกค้า → ถังขยะ)`)) return;
    setDeleting(true);
    try {
      await api.delete(`/surveys/${id}`);
      navigate("/surveys");
    } finally {
      setDeleting(false);
    }
  }

  // ช่างปักหมุดหน้างาน → บันทึกพิกัด + ลิงก์ Google Maps ทันที
  async function savePin(lat: number, lng: number) {
    setPinMsg("กำลังบันทึก...");
    try {
      await api.patch(`/surveys/${id}`, { latitude: lat, longitude: lng, map_url: googleMapsUrl(lat, lng) });
      setPinMsg("บันทึกตำแหน่งแล้ว ✓");
      load();
    } catch {
      setPinMsg("บันทึกตำแหน่งไม่สำเร็จ");
    }
  }

  // เปลี่ยนสถานะลูกค้า (บันทึกในประวัติด้วย)
  async function changeStatus(st: CustomerStatus) {
    if (!survey || survey.status === st) return;
    setSavingStatus(true);
    try {
      await api.patch(`/surveys/${id}`, { status: st });
      load();
      setHistory(null);
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await api.post(`/surveys/${id}/calculate`);
      load();
    } finally {
      setRecalculating(false);
    }
  }

  async function handleSaveSummary() {
    setSavingSummary(true);
    try {
      await api.patch(`/surveys/${id}`, {
        battery_interest: batteryInterest || null,
        documents_received: documentsReceived,
      });
      load();
    } finally {
      setSavingSummary(false);
    }
  }

  if (error) return <p className="text-sm text-brand-red">{error}</p>;
  if (!survey) return <p className="text-gray-500">กำลังโหลด...</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{survey.customer_name}</h1>
          {typeof survey.customer_code === "string" && <p className="text-sm text-gray-400">รหัสลูกค้า {survey.customer_code}</p>}
        </div>
        <Link to="/surveys" className="text-sm text-brand-navy hover:underline">
          ← กลับไปรายการแบบสำรวจ
        </Link>
      </div>

      {/* สถานะตามขั้นตอนการขาย */}
      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 text-xs text-gray-500">สถานะลูกค้า{canEdit ? " (แตะเพื่อเปลี่ยน)" : ""}</div>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOMER_STATUSES.map((st) => {
            const on = survey.status === st;
            return (
              <button
                key={st}
                type="button"
                disabled={!canEdit || savingStatus}
                onClick={() => changeStatus(st)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  on ? `${CUSTOMER_STATUS_STYLES[st]} font-medium ring-2 ring-brand-navy/40` : "bg-white text-gray-400 ring-1 ring-gray-200"
                } ${!canEdit && !on ? "hidden" : ""}`}
              >
                {on ? "● " : ""}
                {CUSTOMER_STATUS_LABELS[st]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeof survey.map_url === "string" && survey.map_url && (
          <a
            href={survey.map_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#EDF4EF] px-4 py-2 text-sm font-medium text-[#4C6B57] hover:bg-[#E1EDE5]"
          >
            📍 นำทาง (Google Maps)
          </a>
        )}
        {canEdit && (
          <button
            onClick={() => setPinOpen((v) => !v)}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {survey.latitude != null ? "ปรับหมุดตำแหน่ง" : "📍 ปักตำแหน่งหน้างาน"}
          </button>
        )}
        {canEdit && (
          <Link to={`/surveys/${id}/edit`} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            แก้ไขข้อมูล
          </Link>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "กำลังลบ..." : "ลบ (ย้ายไปถังขยะ)"}
          </button>
        )}
      </div>

      {pinOpen && canEdit && (
        <div className="rounded-lg border bg-white p-4">
          <MapPinPicker
            lat={survey.latitude != null ? Number(survey.latitude) : null}
            lng={survey.longitude != null ? Number(survey.longitude) : null}
            onChange={savePin}
          />
          {pinMsg && <p className="mt-2 text-sm text-gray-600">{pinMsg}</p>}
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <FormSection title="ข้อมูลลูกค้า">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">เบอร์โทร</dt>
              <dd>{field(survey.customer_phone)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ที่อยู่</dt>
              <dd>{field(survey.customer_address)}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="1. ประเภทสถานที่">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ประเภทสถานที่</dt>
              <dd>{labelOrDash(survey.site_type as never, SITE_TYPE_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ประเภทธุรกิจ</dt>
              <dd>{field(survey.business_type)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">วันเวลาเปิดทำการ</dt>
              <dd>{field(survey.business_hours)}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="2. ข้อมูลค่าไฟ">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ช่วงค่าไฟ</dt>
              <dd>{labelOrDash(survey.bill_range as never, BILL_RANGE_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ค่าไฟที่แน่นอน</dt>
              <dd>{survey.monthly_bill_thb ? `${survey.monthly_bill_thb} บาท/เดือน` : "-"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">หน่วยไฟ</dt>
              <dd>{survey.monthly_usage_kwh ? `${survey.monthly_usage_kwh} kWh/เดือน` : "-"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ส่งบิลได้ไหม</dt>
              <dd>{labelOrDash(survey.can_send_bill as never, CAN_SEND_BILL_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ช่วงเวลาใช้ไฟมากสุด</dt>
              <dd>{labelOrDash(survey.peak_usage_time as never, PEAK_USAGE_TIME_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ใช้ไฟวันเสาร์-อาทิตย์</dt>
              <dd>{labelOrDash(survey.weekend_usage as never, WEEKEND_USAGE_LABELS)}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="3. อุปกรณ์ไฟฟ้าหลัก">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="col-span-2">
              <dt className="text-gray-500">อุปกรณ์หลัก</dt>
              <dd>{listOrDash(survey.main_equipment as never, MAIN_EQUIPMENT_LABELS)}</dd>
            </div>
            {(survey.ac_count as number | null) != null && (
              <>
                <div>
                  <dt className="text-gray-500">จำนวนแอร์</dt>
                  <dd>{field(survey.ac_count)} เครื่อง</dd>
                </div>
                <div>
                  <dt className="text-gray-500">ขนาดแอร์</dt>
                  <dd>{field(survey.ac_size)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">เปิดพร้อมกัน</dt>
                  <dd>{field(survey.ac_simultaneous_count)} เครื่อง</dd>
                </div>
                <div>
                  <dt className="text-gray-500">เฉลี่ยเปิดวันละ</dt>
                  <dd>{field(survey.ac_daily_hours)} ชั่วโมง</dd>
                </div>
                <div>
                  <dt className="text-gray-500">ช่วงเวลาเปิด</dt>
                  <dd>
                    {field(survey.ac_usage_start)} - {field(survey.ac_usage_end)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">ใช้แอร์ช่วง</dt>
                  <dd>{labelOrDash(survey.ac_usage_period as never, AC_USAGE_PERIOD_LABELS)}</dd>
                </div>
              </>
            )}
            {survey.other_equipment_type ? (
              <>
                <div>
                  <dt className="text-gray-500">เครื่องจักร/ตู้แช่อื่น</dt>
                  <dd>{field(survey.other_equipment_type)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">จำนวน</dt>
                  <dd>{field(survey.other_equipment_count)} เครื่อง</dd>
                </div>
              </>
            ) : null}
          </dl>
        </FormSection>

        <FormSection title="4. ข้อมูลระบบไฟ">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">มิเตอร์ไฟ</dt>
              <dd>{labelOrDash(survey.meter_type as never, METER_TYPE_LABELS)}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="5. ความต้องการของลูกค้า">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="col-span-2">
              <dt className="text-gray-500">ความต้องการ</dt>
              <dd>{listOrDash(survey.customer_needs as never, CUSTOMER_NEED_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">สนใจระบบ</dt>
              <dd>{labelOrDash(survey.interested_system as never, INTERESTED_SYSTEM_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">งบประมาณ</dt>
              <dd>{field(survey.budget)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ช่วงเวลาติดตั้ง</dt>
              <dd>{field(survey.install_timeline)}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title="6. ข้อมูลหน้างาน">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ประเภทหลังคา</dt>
              <dd>{labelOrDash(survey.roof_type as never, ROOF_TYPE_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ร่มเงา</dt>
              <dd>{labelOrDash(survey.shading_presence as never, SHADING_PRESENCE_LABELS)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">รูปที่ขอจากลูกค้า</dt>
              <dd>{listOrDash(survey.requested_photos as never, REQUESTED_PHOTO_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">พื้นที่หลังคา</dt>
              <dd>{survey.roof_area_sqm ? `${survey.roof_area_sqm} ตร.ม.` : "-"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ทิศหลังคา</dt>
              <dd>{survey.roof_direction ? ROOF_DIRECTION_LABELS[survey.roof_direction] : "-"}</dd>
            </div>
          </dl>
        </FormSection>

        {survey.notes ? (
          <FormSection title="หมายเหตุ">
            <p className="text-sm">{field(survey.notes)}</p>
          </FormSection>
        ) : null}
      </div>

      {calculation ? (
        <SolarResultCard result={calculation} />
      ) : (
        <p className="text-gray-500">ยังไม่มีผลคำนวณ (ข้อมูลพื้นที่หลังคา/ทิศ/ค่าไฟยังไม่ครบ)</p>
      )}

      {survey.recommended_system_type ? (
        <p className="text-sm text-gray-600">
          ระบบที่บันทึกไว้จากเครื่องคำนวณ:{" "}
          <span className="font-medium text-brand-navy">
            {survey.recommended_system_type === "hybrid"
              ? `Hybrid + Battery ${survey.recommended_battery_kwh} kWh`
              : "On-Grid"}
          </span>
        </p>
      ) : null}

      <div className="flex gap-2">
        {canEdit && (
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {recalculating ? "กำลังคำนวณใหม่..." : "คำนวณใหม่"}
        </button>
        )}
        <Link
          to={`/calculator?surveyId=${survey.id}`}
          className="rounded bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red/90"
        >
          คำนวณระบบ & ภาพนำเสนอ
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <FormSection title="7. สรุปสำหรับทีมประเมิน">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ค่าไฟเฉลี่ย</dt>
              <dd>{survey.monthly_bill_thb ? `${survey.monthly_bill_thb} บาท/เดือน` : "-"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ประเภทสถานที่/ธุรกิจ</dt>
              <dd>
                {labelOrDash(survey.site_type as never, SITE_TYPE_LABELS)}
                {survey.business_type ? ` (${survey.business_type})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">ช่วงเวลาที่ใช้ไฟมาก</dt>
              <dd>{labelOrDash(survey.peak_usage_time as never, PEAK_USAGE_TIME_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">โหลดหลัก</dt>
              <dd>{listOrDash(survey.main_equipment as never, MAIN_EQUIPMENT_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">จำนวนแอร์</dt>
              <dd>{survey.ac_count != null ? `${survey.ac_count} เครื่อง` : "-"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">เฟส</dt>
              <dd>{labelOrDash(survey.meter_type as never, METER_TYPE_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ระบบที่ลูกค้าสนใจ</dt>
              <dd>{labelOrDash(survey.interested_system as never, INTERESTED_SYSTEM_LABELS)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ขนาดระบบที่คาดการณ์เบื้องต้น</dt>
              <dd>{calculation ? `${calculation.recommended_kwp} kW` : "-"}</dd>
            </div>
          </dl>

          <div className="mt-3 border-t pt-3">
            <label className="mb-1 block text-sm text-gray-700">สนใจ Battery</label>
            <RadioGroup
              name="battery_interest"
              value={batteryInterest}
              onChange={setBatteryInterest}
              options={BATTERY_INTEREST_OPTIONS}
              labels={BATTERY_INTEREST_LABELS}
              allowEmpty
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-700">เอกสารและรูปที่ได้รับ</label>
            <CheckboxGroup value={documentsReceived} onChange={setDocumentsReceived} options={DOCUMENTS_RECEIVED_OPTIONS} labels={DOCUMENTS_RECEIVED_LABELS} />
          </div>

          {canEdit && (
            <button
              onClick={handleSaveSummary}
              disabled={savingSummary}
              className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
            >
              {savingSummary ? "กำลังบันทึก..." : "บันทึกสรุปสำหรับทีมประเมิน"}
            </button>
          )}
        </FormSection>
      </div>
      {/* ประวัติการแก้ไข */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-900">ประวัติการแก้ไข</h2>
          {!history && (
            <button onClick={loadHistory} className="text-sm text-brand-navy hover:underline">
              ดูประวัติ
            </button>
          )}
        </div>
        {history && history.length === 0 && <p className="mt-2 text-sm text-gray-400">ยังไม่มีประวัติ</p>}
        {history && (
          <ul className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                <div className="text-gray-900">
                  <span className="font-medium">{h.staff_name || "ไม่ทราบ"}</span> {HISTORY_ACTION_LABELS[h.action]}
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(h.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                {h.changes &&
                  Object.entries(h.changes).map(([f, c]) => (
                    <div key={f} className="mt-0.5 text-xs text-gray-500">
                      {FIELD_LABELS[f] || f}: <span className="text-gray-400 line-through">{showValue(c.from)}</span> →{" "}
                      <span className="text-gray-700">{showValue(c.to)}</span>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type HistoryRow = {
  id: number;
  action: "create" | "update" | "delete" | "restore";
  changes: Record<string, { from: unknown; to: unknown }> | null;
  created_at: string;
  staff_name: string | null;
};

const HISTORY_ACTION_LABELS: Record<HistoryRow["action"], string> = {
  create: "สร้างข้อมูลลูกค้า",
  update: "แก้ไข",
  delete: "ย้ายไปถังขยะ",
  restore: "กู้คืนจากถังขยะ",
};

// ชื่อช่องที่อ่านง่าย (ช่องที่ไม่มีในนี้แสดงชื่อเดิม)
const FIELD_LABELS: Record<string, string> = {
  customer_name: "ชื่อลูกค้า",
  customer_phone: "เบอร์โทร",
  customer_address: "ที่อยู่",
  map_url: "ลิงก์แผนที่",
  monthly_bill_thb: "ค่าไฟ/เดือน",
  monthly_usage_kwh: "หน่วยไฟ/เดือน",
  roof_area_sqm: "พื้นที่หลังคา",
  roof_direction: "ทิศหลังคา",
  roof_type: "ประเภทหลังคา",
  meter_type: "มิเตอร์",
  budget: "งบประมาณ",
  install_timeline: "ช่วงติดตั้ง",
  interested_system: "ระบบที่สนใจ",
  recommended_system_type: "ระบบที่แนะนำ",
  recommended_battery_kwh: "แบตที่แนะนำ (kWh)",
  battery_interest: "สนใจแบต",
  documents_received: "เอกสารที่ได้รับ",
  notes: "หมายเหตุ",
  status: "สถานะ",
};

function showValue(v: unknown) {
  if (v == null || v === "") return "(ว่าง)";
  if (typeof v === "string" && v in CUSTOMER_STATUS_LABELS) return CUSTOMER_STATUS_LABELS[v as CustomerStatus];
  if (Array.isArray(v)) return v.join(", ") || "(ว่าง)";
  const t = String(v);
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}
