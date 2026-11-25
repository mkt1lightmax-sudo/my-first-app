import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import {
  ROOF_DIRECTIONS,
  ROOF_DIRECTION_LABELS,
  type RoofDirection,
  type SolarCalcResult,
  type SystemComparisonResult,
} from "../../lib/solar";
import {
  SITE_TYPES,
  SITE_TYPE_LABELS,
  type SiteType,
  BILL_RANGES,
  BILL_RANGE_LABELS,
  type BillRange,
  CAN_SEND_BILL_OPTIONS,
  CAN_SEND_BILL_LABELS,
  type CanSendBill,
  PEAK_USAGE_TIMES,
  PEAK_USAGE_TIME_LABELS,
  type PeakUsageTime,
  WEEKEND_USAGE_OPTIONS,
  WEEKEND_USAGE_LABELS,
  type WeekendUsage,
  MAIN_EQUIPMENT_OPTIONS,
  MAIN_EQUIPMENT_LABELS,
  type MainEquipment,
  AC_USAGE_PERIODS,
  AC_USAGE_PERIOD_LABELS,
  type AcUsagePeriod,
  METER_TYPES,
  METER_TYPE_LABELS,
  type MeterType,
  CUSTOMER_NEEDS_OPTIONS,
  CUSTOMER_NEED_LABELS,
  type CustomerNeed,
  INTERESTED_SYSTEMS,
  INTERESTED_SYSTEM_LABELS,
  type InterestedSystem,
  ROOF_TYPES,
  ROOF_TYPE_LABELS,
  type RoofType,
  SHADING_PRESENCE_OPTIONS,
  SHADING_PRESENCE_LABELS,
  type ShadingPresence,
  REQUESTED_PHOTO_OPTIONS,
  REQUESTED_PHOTO_LABELS,
  type RequestedPhoto,
} from "../../lib/survey";
import FormSection from "../../components/FormSection";
import RadioGroup from "../../components/RadioGroup";
import CheckboxGroup from "../../components/CheckboxGroup";
import SolarResultCard from "../../components/SolarResultCard";

// แปลงผลเปรียบเทียบ (on-grid vs hybrid) ให้เหลือแค่ scenario ที่แนะนำ สำหรับโชว์ preview แบบง่ายๆ ระหว่างกรอกฟอร์ม
function toSimplePreview(result: SystemComparisonResult): SolarCalcResult {
  const isHybrid = result.recommended === "hybrid";
  const option = isHybrid ? result.hybrid : result.on_grid;
  return {
    recommended_kwp: result.shared.recommended_kwp,
    recommended_panel_count: result.shared.recommended_panel_count,
    estimated_monthly_generation_kwh: result.shared.estimated_monthly_generation_kwh,
    roof_area_limited: result.shared.roof_area_limited,
    estimated_monthly_savings_thb: option.estimated_monthly_savings_thb,
    estimated_payback_years: option.estimated_payback_years,
    estimated_install_cost_thb: option.estimated_install_cost_thb,
  };
}

const SHADING_LEVEL_DETAIL_OPTIONS = ["light", "moderate", "heavy"] as const;
const SHADING_LEVEL_DETAIL_LABELS: Record<(typeof SHADING_LEVEL_DETAIL_OPTIONS)[number], string> = {
  light: "เล็กน้อย",
  moderate: "ปานกลาง",
  heavy: "เยอะ",
};

// ช่องบังคับ (ต้องตรงกับฝั่งเซิร์ฟเวอร์ server/routes/surveys.js)
const PHONE_RE = /^0\d{8,9}$/;

export default function SurveyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [mapUrl, setMapUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; place?: string }>({});

  // ข้อมูลลูกค้า
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // หมวด 1: ประเภทสถานที่
  const [siteType, setSiteType] = useState<SiteType | "">("");
  const [siteTypeOther, setSiteTypeOther] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [businessHours, setBusinessHours] = useState("");

  // หมวด 2: ข้อมูลค่าไฟ
  const [billRange, setBillRange] = useState<BillRange | "">("");
  const [monthlyBill, setMonthlyBill] = useState("");
  const [monthlyUsage, setMonthlyUsage] = useState("");
  const [canSendBill, setCanSendBill] = useState<CanSendBill | "">("");
  const [peakUsageTime, setPeakUsageTime] = useState<PeakUsageTime | "">("");
  const [weekendUsage, setWeekendUsage] = useState<WeekendUsage | "">("");

  // หมวด 3: อุปกรณ์ไฟฟ้าหลัก
  const [mainEquipment, setMainEquipment] = useState<MainEquipment[]>([]);
  const [mainEquipmentOther, setMainEquipmentOther] = useState("");
  const [acCount, setAcCount] = useState("");
  const [acSize, setAcSize] = useState("");
  const [acSimultaneousCount, setAcSimultaneousCount] = useState("");
  const [acUsageStart, setAcUsageStart] = useState("");
  const [acUsageEnd, setAcUsageEnd] = useState("");
  const [acDailyHours, setAcDailyHours] = useState("");
  const [acUsagePeriod, setAcUsagePeriod] = useState<AcUsagePeriod | "">("");
  const [otherEquipmentType, setOtherEquipmentType] = useState("");
  const [otherEquipmentCount, setOtherEquipmentCount] = useState("");
  const [otherEquipmentUsageTime, setOtherEquipmentUsageTime] = useState("");

  // หมวด 4: ข้อมูลระบบไฟ
  const [meterType, setMeterType] = useState<MeterType | "">("");

  // หมวด 5: ความต้องการของลูกค้า
  const [customerNeeds, setCustomerNeeds] = useState<CustomerNeed[]>([]);
  const [interestedSystem, setInterestedSystem] = useState<InterestedSystem | "">("");
  const [budget, setBudget] = useState("");
  const [installTimeline, setInstallTimeline] = useState("");

  // หมวด 6: ข้อมูลหน้างาน
  const [roofType, setRoofType] = useState<RoofType | "">("");
  const [roofTypeOther, setRoofTypeOther] = useState("");
  const [shadingPresence, setShadingPresence] = useState<ShadingPresence | "">("");
  const [shadingLevel, setShadingLevel] = useState<(typeof SHADING_LEVEL_DETAIL_OPTIONS)[number]>("moderate");
  const [requestedPhotos, setRequestedPhotos] = useState<RequestedPhoto[]>([]);
  const [roofArea, setRoofArea] = useState("");
  const [roofDirection, setRoofDirection] = useState<RoofDirection | "">("");

  const [notes, setNotes] = useState("");

  const [preview, setPreview] = useState<SolarCalcResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // แก้ไข: โหลดข้อมูลเดิมมาใส่ฟอร์ม
  useEffect(() => {
    if (!id) return;
    api
      .get<{ ok: true; survey: Record<string, any>; canEdit: boolean }>(`/surveys/${id}`)
      .then(({ survey: v, canEdit }) => {
        if (!canEdit) setError("แก้ได้เฉพาะลูกค้าที่คุณสร้างหรือได้รับมอบหมาย — ถ้าต้องแก้ ติดต่อแอดมิน");
        const str = (x: unknown) => (x == null ? "" : String(x));
        setCustomerName(str(v.customer_name));
        setCustomerPhone(str(v.customer_phone));
        setCustomerAddress(str(v.customer_address));
        setMapUrl(str(v.map_url));
        setSiteType(v.site_type ?? "");
        setSiteTypeOther(str(v.site_type_other));
        setBusinessType(str(v.business_type));
        setBusinessHours(str(v.business_hours));
        setBillRange(v.bill_range ?? "");
        setMonthlyBill(v.monthly_bill_thb != null ? String(Number(v.monthly_bill_thb)) : "");
        setMonthlyUsage(v.monthly_usage_kwh != null ? String(Number(v.monthly_usage_kwh)) : "");
        setCanSendBill(v.can_send_bill ?? "");
        setPeakUsageTime(v.peak_usage_time ?? "");
        setWeekendUsage(v.weekend_usage ?? "");
        setMainEquipment(v.main_equipment ?? []);
        setMainEquipmentOther(str(v.main_equipment_other));
        setAcCount(str(v.ac_count));
        setAcSize(str(v.ac_size));
        setAcSimultaneousCount(str(v.ac_simultaneous_count));
        setAcUsageStart(str(v.ac_usage_start).slice(0, 5));
        setAcUsageEnd(str(v.ac_usage_end).slice(0, 5));
        setAcDailyHours(v.ac_daily_hours != null ? String(Number(v.ac_daily_hours)) : "");
        setAcUsagePeriod(v.ac_usage_period ?? "");
        setOtherEquipmentType(str(v.other_equipment_type));
        setOtherEquipmentCount(str(v.other_equipment_count));
        setOtherEquipmentUsageTime(str(v.other_equipment_usage_time));
        setMeterType(v.meter_type ?? "");
        setCustomerNeeds(v.customer_needs ?? []);
        setInterestedSystem(v.interested_system ?? "");
        setBudget(str(v.budget));
        setInstallTimeline(str(v.install_timeline));
        setRoofType(v.roof_type ?? "");
        setRoofTypeOther(str(v.roof_type_other));
        setShadingPresence(v.shading_presence ?? "");
        if (v.shading_level && v.shading_level !== "none") setShadingLevel(v.shading_level);
        setRequestedPhotos(v.requested_photos ?? []);
        setRoofArea(v.roof_area_sqm != null ? String(Number(v.roof_area_sqm)) : "");
        setRoofDirection(v.roof_direction ?? "");
        setNotes(str(v.notes));
      })
      .catch(() => setError("โหลดข้อมูลลูกค้าไม่สำเร็จ"));
  }, [id]);

  // preview ผลคำนวณสดๆ (ต้องมีพื้นที่หลังคา + ทิศ + ค่าไฟ/หน่วยไฟ อย่างน้อย)
  useEffect(() => {
    const hasEnoughInput = roofArea && roofDirection && (monthlyBill || monthlyUsage);
    if (!hasEnoughInput) {
      setPreview(null);
      return;
    }
    const effectiveShadingLevel = shadingPresence === "none" ? "none" : shadingPresence === "yes" ? shadingLevel : "moderate";
    const timer = setTimeout(() => {
      api
        .post<{ ok: true; result: SystemComparisonResult }>("/calculate", {
          monthly_bill_thb: monthlyBill ? Number(monthlyBill) : undefined,
          monthly_usage_kwh: monthlyUsage ? Number(monthlyUsage) : undefined,
          roof_area_sqm: Number(roofArea),
          roof_direction: roofDirection,
          shading_level: effectiveShadingLevel,
        })
        .then((data) => setPreview(toSimplePreview(data.result)))
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [monthlyBill, monthlyUsage, roofArea, roofDirection, shadingPresence, shadingLevel]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // ตรวจช่องบังคับก่อนส่ง
    const errs: typeof fieldErrors = {};
    if (!customerName.trim()) errs.name = "กรุณากรอกชื่อลูกค้า";
    if (!PHONE_RE.test(customerPhone.replace(/[\s-]/g, ""))) errs.phone = "เบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0";
    if (!customerAddress.trim() && !mapUrl.trim()) errs.place = "กรอกที่อยู่ หรือ ลิงก์แผนที่ อย่างน้อย 1 อย่าง";
    else if (mapUrl.trim() && !/^https?:\/\//i.test(mapUrl.trim())) errs.place = "ลิงก์แผนที่ต้องขึ้นต้นด้วย https://";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setError("กรอกข้อมูลไม่ครบ — ดูช่องที่มีกรอบแดง");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.replace(/[\s-]/g, ""),
        customer_address: customerAddress || undefined,
        map_url: mapUrl.trim() || undefined,

        site_type: siteType || undefined,
        site_type_other: siteTypeOther || undefined,
        business_type: businessType || undefined,
        business_hours: businessHours || undefined,

        bill_range: billRange || undefined,
        monthly_bill_thb: monthlyBill ? Number(monthlyBill) : undefined,
        monthly_usage_kwh: monthlyUsage ? Number(monthlyUsage) : undefined,
        can_send_bill: canSendBill || undefined,
        peak_usage_time: peakUsageTime || undefined,
        weekend_usage: weekendUsage || undefined,

        main_equipment: mainEquipment.length ? mainEquipment : undefined,
        main_equipment_other: mainEquipmentOther || undefined,
        ac_count: acCount ? Number(acCount) : undefined,
        ac_size: acSize || undefined,
        ac_simultaneous_count: acSimultaneousCount ? Number(acSimultaneousCount) : undefined,
        ac_usage_start: acUsageStart || undefined,
        ac_usage_end: acUsageEnd || undefined,
        ac_daily_hours: acDailyHours ? Number(acDailyHours) : undefined,
        ac_usage_period: acUsagePeriod || undefined,
        other_equipment_type: otherEquipmentType || undefined,
        other_equipment_count: otherEquipmentCount ? Number(otherEquipmentCount) : undefined,
        other_equipment_usage_time: otherEquipmentUsageTime || undefined,

        meter_type: meterType || undefined,

        customer_needs: customerNeeds.length ? customerNeeds : undefined,
        interested_system: interestedSystem || undefined,
        budget: budget || undefined,
        install_timeline: installTimeline || undefined,

        roof_type: roofType || undefined,
        roof_type_other: roofTypeOther || undefined,
        shading_presence: shadingPresence || undefined,
        shading_level: shadingPresence === "yes" ? shadingLevel : undefined,
        requested_photos: requestedPhotos.length ? requestedPhotos : undefined,
        roof_area_sqm: roofArea ? Number(roofArea) : undefined,
        roof_direction: roofDirection || undefined,

        notes: notes || undefined,
      };
      if (isEditing) {
        // แก้ไข: ช่องที่ลบออกให้เป็นค่าว่างจริง (ไม่ใช่ข้ามไป)
        for (const k of Object.keys(body)) if (body[k] === undefined) body[k] = null;
        await api.patch(`/surveys/${id}`, body);
        navigate(`/surveys/${id}`);
        return;
      }
      const data = await api.post<{ ok: true; survey: { id: number } }>("/surveys", body);
      navigate(`/surveys/${data.survey.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded border px-3 py-2 text-sm";
  const labelClass = "mb-1 block text-sm text-gray-700";
  const errClass = "border-red-400 bg-red-50/40";

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{isEditing ? "แก้ไขข้อมูลลูกค้า" : "กรอกแบบสำรวจ"}</h1>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} noValidate className="mb-6 space-y-5 rounded-lg border bg-white p-4">
        <FormSection title="ข้อมูลลูกค้า">
          <div>
            <label className={labelClass}>ชื่อลูกค้า *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`${inputClass} ${fieldErrors.name ? errClass : ""}`} />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className={labelClass}>เบอร์โทร *</label>
            <input
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0812345678"
              className={`${inputClass} ${fieldErrors.phone ? errClass : ""}`}
            />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className={labelClass}>ที่อยู่ * (หรือใส่ลิงก์แผนที่ด้านล่าง)</label>
            <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className={`${inputClass} ${fieldErrors.place ? errClass : ""}`} />
          </div>
          <div>
            <label className={labelClass}>ลิงก์ Google Maps</label>
            <input
              type="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              placeholder="วางลิงก์จาก Google Maps หรือที่ลูกค้าแชร์มา"
              className={`${inputClass} ${fieldErrors.place ? errClass : ""}`}
            />
            {fieldErrors.place && <p className="mt-1 text-xs text-red-600">{fieldErrors.place}</p>}
          </div>
        </FormSection>

        <FormSection title="1. ประเภทสถานที่">
          <RadioGroup name="site_type" value={siteType} onChange={setSiteType} options={SITE_TYPES} labels={SITE_TYPE_LABELS} allowEmpty />
          {siteType === "other" && (
            <input
              value={siteTypeOther}
              onChange={(e) => setSiteTypeOther(e.target.value)}
              placeholder="ระบุประเภทสถานที่"
              className={inputClass}
            />
          )}
          <div>
            <label className={labelClass}>หากเป็นสถานประกอบการ ประกอบธุรกิจประเภทใด</label>
            <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>วันและเวลาเปิดทำการ</label>
            <input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} className={inputClass} />
          </div>
        </FormSection>

        <FormSection title="2. ข้อมูลค่าไฟ">
          <div>
            <label className={labelClass}>ค่าไฟเฉลี่ยต่อเดือนประมาณ</label>
            <RadioGroup name="bill_range" value={billRange} onChange={setBillRange} options={BILL_RANGES} labels={BILL_RANGE_LABELS} allowEmpty />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ค่าไฟที่แน่นอน (บาท/เดือน)</label>
              <input type="number" min="0" value={monthlyBill} onChange={(e) => setMonthlyBill(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>หรือหน่วยไฟที่ใช้ (kWh/เดือน)</label>
              <input type="number" min="0" value={monthlyUsage} onChange={(e) => setMonthlyUsage(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>ลูกค้าสามารถส่งบิลค่าไฟล่าสุดได้หรือไม่</label>
            <RadioGroup name="can_send_bill" value={canSendBill} onChange={setCanSendBill} options={CAN_SEND_BILL_OPTIONS} labels={CAN_SEND_BILL_LABELS} allowEmpty />
          </div>
          <div>
            <label className={labelClass}>ช่วงเวลาที่ใช้ไฟมากที่สุด</label>
            <RadioGroup name="peak_usage_time" value={peakUsageTime} onChange={setPeakUsageTime} options={PEAK_USAGE_TIMES} labels={PEAK_USAGE_TIME_LABELS} allowEmpty />
          </div>
          <div>
            <label className={labelClass}>วันเสาร์–อาทิตย์มีการใช้ไฟหรือไม่</label>
            <RadioGroup name="weekend_usage" value={weekendUsage} onChange={setWeekendUsage} options={WEEKEND_USAGE_OPTIONS} labels={WEEKEND_USAGE_LABELS} allowEmpty />
          </div>
        </FormSection>

        <FormSection title="3. อุปกรณ์ไฟฟ้าหลัก">
          <div>
            <label className={labelClass}>อุปกรณ์ที่ใช้ไฟหลัก</label>
            <CheckboxGroup value={mainEquipment} onChange={setMainEquipment} options={MAIN_EQUIPMENT_OPTIONS} labels={MAIN_EQUIPMENT_LABELS} />
          </div>
          {mainEquipment.includes("other") && (
            <input
              value={mainEquipmentOther}
              onChange={(e) => setMainEquipmentOther(e.target.value)}
              placeholder="ระบุอุปกรณ์อื่น ๆ"
              className={inputClass}
            />
          )}

          {mainEquipment.includes("air_conditioner") && (
            <div className="rounded border bg-gray-50 p-3">
              <p className="mb-2 text-sm font-medium text-gray-700">ข้อมูลเครื่องปรับอากาศ</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>มีแอร์ทั้งหมด (เครื่อง)</label>
                  <input type="number" min="0" value={acCount} onChange={(e) => setAcCount(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ขนาดแอร์</label>
                  <input value={acSize} onChange={(e) => setAcSize(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ปกติเปิดพร้อมกัน (เครื่อง)</label>
                  <input type="number" min="0" value={acSimultaneousCount} onChange={(e) => setAcSimultaneousCount(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เฉลี่ยเปิดวันละ (ชั่วโมง)</label>
                  <input type="number" min="0" value={acDailyHours} onChange={(e) => setAcDailyHours(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เวลาเริ่มเปิด</label>
                  <input type="time" value={acUsageStart} onChange={(e) => setAcUsageStart(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ถึงเวลา</label>
                  <input type="time" value={acUsageEnd} onChange={(e) => setAcUsageEnd(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-2">
                <label className={labelClass}>ใช้แอร์ช่วง</label>
                <RadioGroup name="ac_usage_period" value={acUsagePeriod} onChange={setAcUsagePeriod} options={AC_USAGE_PERIODS} labels={AC_USAGE_PERIOD_LABELS} allowEmpty />
              </div>
            </div>
          )}

          {(mainEquipment.includes("machinery") || mainEquipment.includes("fridge_freezer")) && (
            <div className="rounded border bg-gray-50 p-3">
              <p className="mb-2 text-sm font-medium text-gray-700">เครื่องจักร / ตู้แช่ / อุปกรณ์อื่น</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>ประเภทอุปกรณ์</label>
                  <input value={otherEquipmentType} onChange={(e) => setOtherEquipmentType(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>จำนวน (เครื่อง)</label>
                  <input type="number" min="0" value={otherEquipmentCount} onChange={(e) => setOtherEquipmentCount(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-2">
                <label className={labelClass}>ช่วงเวลาใช้งาน</label>
                <input value={otherEquipmentUsageTime} onChange={(e) => setOtherEquipmentUsageTime(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="4. ข้อมูลระบบไฟ">
          <div>
            <label className={labelClass}>มิเตอร์ไฟ</label>
            <RadioGroup name="meter_type" value={meterType} onChange={setMeterType} options={METER_TYPES} labels={METER_TYPE_LABELS} allowEmpty />
          </div>
        </FormSection>

        <FormSection title="5. ความต้องการของลูกค้า">
          <div>
            <label className={labelClass}>ลูกค้าต้องการ</label>
            <CheckboxGroup value={customerNeeds} onChange={setCustomerNeeds} options={CUSTOMER_NEEDS_OPTIONS} labels={CUSTOMER_NEED_LABELS} />
          </div>
          <div>
            <label className={labelClass}>สนใจระบบ</label>
            <RadioGroup name="interested_system" value={interestedSystem} onChange={setInterestedSystem} options={INTERESTED_SYSTEMS} labels={INTERESTED_SYSTEM_LABELS} allowEmpty />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>งบประมาณเบื้องต้น</label>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ต้องการติดตั้งช่วงประมาณ</label>
              <input value={installTimeline} onChange={(e) => setInstallTimeline(e.target.value)} className={inputClass} />
            </div>
          </div>
        </FormSection>

        <FormSection title="6. ข้อมูลหน้างาน">
          <div>
            <label className={labelClass}>ประเภทหลังคา</label>
            <RadioGroup name="roof_type" value={roofType} onChange={setRoofType} options={ROOF_TYPES} labels={ROOF_TYPE_LABELS} allowEmpty />
          </div>
          {roofType === "other" && (
            <input value={roofTypeOther} onChange={(e) => setRoofTypeOther(e.target.value)} placeholder="ระบุประเภทหลังคา" className={inputClass} />
          )}

          <div>
            <label className={labelClass}>หลังคามีเงาบังจากต้นไม้หรืออาคารหรือไม่</label>
            <RadioGroup name="shading_presence" value={shadingPresence} onChange={setShadingPresence} options={SHADING_PRESENCE_OPTIONS} labels={SHADING_PRESENCE_LABELS} allowEmpty />
          </div>
          {shadingPresence === "yes" && (
            <div>
              <label className={labelClass}>ระดับร่มเงา (ใช้คำนวณระบบ)</label>
              <RadioGroup
                name="shading_level"
                value={shadingLevel}
                onChange={setShadingLevel}
                options={SHADING_LEVEL_DETAIL_OPTIONS}
                labels={SHADING_LEVEL_DETAIL_LABELS}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>ลูกค้าสามารถส่งรูปหน้างานได้หรือไม่ (รูปที่ต้องการ)</label>
            <CheckboxGroup value={requestedPhotos} onChange={setRequestedPhotos} options={REQUESTED_PHOTO_OPTIONS} labels={REQUESTED_PHOTO_LABELS} />
          </div>

          <div className="rounded border bg-blue-50 p-3">
            <p className="mb-2 text-sm text-gray-600">
              ช่องด้านล่างไม่มีในแบบฟอร์มกระดาษ (ทีมประเมินจะไปวัดหน้างานเอง) — กรอกถ้าประเมินได้ เพื่อให้แอปคำนวณขนาดระบบเบื้องต้นให้
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>พื้นที่หลังคา (ตร.ม.)</label>
                <input type="number" min="0" value={roofArea} onChange={(e) => setRoofArea(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>ทิศหลังคา</label>
                <select value={roofDirection} onChange={(e) => setRoofDirection(e.target.value as RoofDirection)} className={inputClass}>
                  <option value="">ไม่ระบุ</option>
                  {ROOF_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {ROOF_DIRECTION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="หมายเหตุ">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </FormSection>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
        >
          {submitting ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "บันทึกแบบสำรวจ"}
        </button>
      </form>

      {preview && (
        <div>
          <p className="mb-2 text-sm text-gray-500">ตัวอย่างผลคำนวณ (จะบันทึกตอนกดบันทึกด้านบน)</p>
          <SolarResultCard result={preview} />
        </div>
      )}
    </div>
  );
}
