// option lists + label ภาษาไทย สำหรับฟิลด์แบบสำรวจทั้งหมด (อ้างอิงจากแบบฟอร์มสอบถามลูกค้าจริง 7 หมวด)

export const SITE_TYPES = ["residential", "shop", "company_office", "factory", "commercial_building", "other"] as const;
export type SiteType = (typeof SITE_TYPES)[number];
export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  residential: "บ้านพักอาศัย",
  shop: "ร้านค้า",
  company_office: "บริษัท / สำนักงาน",
  factory: "โรงงาน",
  commercial_building: "อาคารพาณิชย์",
  other: "อื่น ๆ",
};

export const BILL_RANGES = ["under_5000", "5000_10000", "10000_30000", "30000_50000", "over_50000"] as const;
export type BillRange = (typeof BILL_RANGES)[number];
export const BILL_RANGE_LABELS: Record<BillRange, string> = {
  under_5000: "ต่ำกว่า 5,000 บาท",
  "5000_10000": "5,000–10,000 บาท",
  "10000_30000": "10,000–30,000 บาท",
  "30000_50000": "30,000–50,000 บาท",
  over_50000: "มากกว่า 50,000 บาท",
};

export const CAN_SEND_BILL_OPTIONS = ["yes", "later", "not_convenient"] as const;
export type CanSendBill = (typeof CAN_SEND_BILL_OPTIONS)[number];
export const CAN_SEND_BILL_LABELS: Record<CanSendBill, string> = {
  yes: "ส่งได้",
  later: "ขอส่งภายหลัง",
  not_convenient: "ยังไม่สะดวกส่ง",
};

export const PEAK_USAGE_TIMES = ["day", "night", "even", "unsure"] as const;
export type PeakUsageTime = (typeof PEAK_USAGE_TIMES)[number];
export const PEAK_USAGE_TIME_LABELS: Record<PeakUsageTime, string> = {
  day: "กลางวัน",
  night: "กลางคืน",
  even: "ใช้ใกล้เคียงกันทั้งวัน",
  unsure: "ไม่แน่ใจ",
};

export const WEEKEND_USAGE_OPTIONS = ["normal", "reduced", "closed"] as const;
export type WeekendUsage = (typeof WEEKEND_USAGE_OPTIONS)[number];
export const WEEKEND_USAGE_LABELS: Record<WeekendUsage, string> = {
  normal: "ใช้งานตามปกติ",
  reduced: "ใช้งานลดลง",
  closed: "ปิดกิจการ / ไม่มีคนอยู่",
};

export const MAIN_EQUIPMENT_OPTIONS = ["air_conditioner", "machinery", "fridge_freezer", "water_pump", "water_heater", "ev", "other"] as const;
export type MainEquipment = (typeof MAIN_EQUIPMENT_OPTIONS)[number];
export const MAIN_EQUIPMENT_LABELS: Record<MainEquipment, string> = {
  air_conditioner: "เครื่องปรับอากาศ",
  machinery: "เครื่องจักร",
  fridge_freezer: "ตู้เย็น / ตู้แช่",
  water_pump: "ปั๊มน้ำ",
  water_heater: "เครื่องทำน้ำอุ่น",
  ev: "รถยนต์ไฟฟ้า",
  other: "อื่น ๆ",
};

export const AC_USAGE_PERIODS = ["day", "night", "both"] as const;
export type AcUsagePeriod = (typeof AC_USAGE_PERIODS)[number];
export const AC_USAGE_PERIOD_LABELS: Record<AcUsagePeriod, string> = {
  day: "กลางวัน",
  night: "กลางคืน",
  both: "ทั้งกลางวันและกลางคืน",
};

export const METER_TYPES = ["1_phase", "3_phase", "tou", "unsure"] as const;
export type MeterType = (typeof METER_TYPES)[number];
export const METER_TYPE_LABELS: Record<MeterType, string> = {
  "1_phase": "1 เฟส",
  "3_phase": "3 เฟส",
  tou: "TOU",
  unsure: "ไม่แน่ใจ",
};

export const CUSTOMER_NEEDS_OPTIONS = ["reduce_day_bill", "reduce_day_night_bill", "backup_power", "want_battery", "unsure"] as const;
export type CustomerNeed = (typeof CUSTOMER_NEEDS_OPTIONS)[number];
export const CUSTOMER_NEED_LABELS: Record<CustomerNeed, string> = {
  reduce_day_bill: "ลดค่าไฟช่วงกลางวัน",
  reduce_day_night_bill: "ลดค่าไฟทั้งกลางวันและกลางคืน",
  backup_power: "ต้องการสำรองไฟเวลาไฟดับ",
  want_battery: "ต้องการติดตั้ง Battery",
  unsure: "ยังไม่แน่ใจ ต้องการให้ทีมงานแนะนำ",
};

export const INTERESTED_SYSTEMS = ["on_grid", "hybrid_battery", "unsure"] as const;
export type InterestedSystem = (typeof INTERESTED_SYSTEMS)[number];
export const INTERESTED_SYSTEM_LABELS: Record<InterestedSystem, string> = {
  on_grid: "On-Grid",
  hybrid_battery: "Hybrid + Battery",
  unsure: "ยังไม่ทราบระบบ",
};

export const ROOF_TYPES = ["metal_sheet", "double_lap_tile", "cpac_tile", "concrete_rooftop", "unknown", "other"] as const;
export type RoofType = (typeof ROOF_TYPES)[number];
export const ROOF_TYPE_LABELS: Record<RoofType, string> = {
  metal_sheet: "เมทัลชีท",
  double_lap_tile: "กระเบื้องลอนคู่",
  cpac_tile: "กระเบื้องซีแพค",
  concrete_rooftop: "ดาดฟ้าคอนกรีต",
  unknown: "ไม่ทราบ",
  other: "อื่น ๆ",
};

export const SHADING_PRESENCE_OPTIONS = ["none", "yes", "unsure"] as const;
export type ShadingPresence = (typeof SHADING_PRESENCE_OPTIONS)[number];
export const SHADING_PRESENCE_LABELS: Record<ShadingPresence, string> = {
  none: "ไม่มี",
  yes: "มี",
  unsure: "ไม่แน่ใจ",
};

export const REQUESTED_PHOTO_OPTIONS = ["roof", "front_building", "electric_panel", "meter", "inverter_battery_area"] as const;
export type RequestedPhoto = (typeof REQUESTED_PHOTO_OPTIONS)[number];
export const REQUESTED_PHOTO_LABELS: Record<RequestedPhoto, string> = {
  roof: "รูปหลังคา",
  front_building: "รูปหน้าบ้าน / อาคาร",
  electric_panel: "รูปตู้ไฟ",
  meter: "รูปมิเตอร์ไฟ",
  inverter_battery_area: "รูปพื้นที่ติดตั้ง Inverter / Battery",
};

export const BATTERY_INTEREST_OPTIONS = ["interested", "not_interested", "considering"] as const;
export type BatteryInterest = (typeof BATTERY_INTEREST_OPTIONS)[number];
export const BATTERY_INTEREST_LABELS: Record<BatteryInterest, string> = {
  interested: "สนใจ",
  not_interested: "ไม่สนใจ",
  considering: "ขอพิจารณา",
};

export const DOCUMENTS_RECEIVED_OPTIONS = ["electricity_bill", "roof_photo", "meter_photo", "panel_photo", "info_complete", "pending_more_info"] as const;
export type DocumentReceived = (typeof DOCUMENTS_RECEIVED_OPTIONS)[number];
export const DOCUMENTS_RECEIVED_LABELS: Record<DocumentReceived, string> = {
  electricity_bill: "บิลค่าไฟ",
  roof_photo: "รูปหลังคา",
  meter_photo: "รูปมิเตอร์",
  panel_photo: "รูปตู้ไฟ",
  info_complete: "ข้อมูลครบ",
  pending_more_info: "รอข้อมูลเพิ่มเติม",
};
