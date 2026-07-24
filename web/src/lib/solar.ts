export const ROOF_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type RoofDirection = (typeof ROOF_DIRECTIONS)[number];

export const ROOF_DIRECTION_LABELS: Record<RoofDirection, string> = {
  N: "เหนือ",
  NE: "ตะวันออกเฉียงเหนือ",
  E: "ตะวันออก",
  SE: "ตะวันออกเฉียงใต้",
  S: "ใต้",
  SW: "ตะวันตกเฉียงใต้",
  W: "ตะวันตก",
  NW: "ตะวันตกเฉียงเหนือ",
};

export const SHADING_LEVELS = ["none", "light", "moderate", "heavy"] as const;
export type ShadingLevel = (typeof SHADING_LEVELS)[number];

export const SHADING_LEVEL_LABELS: Record<ShadingLevel, string> = {
  none: "ไม่มีร่มเงา",
  light: "ร่มเงาเล็กน้อย",
  moderate: "ร่มเงาปานกลาง",
  heavy: "ร่มเงาเยอะ",
};

export type SolarCalcInput = {
  monthly_bill_thb?: number;
  monthly_usage_kwh?: number;
  roof_area_sqm: number;
  roof_direction: RoofDirection;
  shading_level?: ShadingLevel;
};

export type SolarCalcResult = {
  recommended_kwp: number;
  recommended_panel_count: number;
  estimated_monthly_savings_thb: number;
  estimated_payback_years: number | null;
  roof_area_limited: boolean;
  estimated_install_cost_thb: number;
  estimated_monthly_generation_kwh: number;
};

export const RATE_TYPES = ["normal", "tou"] as const;
export type RateType = (typeof RATE_TYPES)[number];
export const RATE_TYPE_LABELS: Record<RateType, string> = {
  normal: "ปกติ",
  tou: "TOU",
};

export const GOALS = ["reduce_day", "reduce_day_night", "unsure"] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABELS: Record<Goal, string> = {
  reduce_day: "ลดค่าไฟช่วงกลางวัน",
  reduce_day_night: "ลดค่าไฟทั้งกลางวันและกลางคืน",
  unsure: "ยังไม่แน่ใจ ให้ระบบแนะนำ",
};

export type SystemComparisonInput = {
  monthly_bill_thb?: number;
  monthly_usage_kwh?: number;
  roof_area_sqm?: number;
  roof_direction?: RoofDirection;
  shading_level?: ShadingLevel;
  day_usage_percent?: number;
  rate_type?: RateType;
  usage_days_per_week?: number;
  goal?: Goal;
};

export type SystemOption = {
  estimated_monthly_savings_thb: number;
  estimated_install_cost_thb: number;
  estimated_payback_years: number | null;
};

export type SystemComparisonResult = {
  recommended: "on_grid" | "hybrid";
  shared: {
    recommended_kwp: number;
    recommended_panel_count: number;
    estimated_monthly_generation_kwh: number;
    roof_area_limited: boolean;
  };
  on_grid: SystemOption;
  hybrid: SystemOption & { battery_kwh: number };
};

export function formatPaybackRange(years: number | null): string {
  if (years === null) return "-";
  const lo = Math.floor(years);
  const hi = Math.ceil(years);
  if (lo === hi) return `${lo} ปี`;
  return `${lo}-${hi} ปี`;
}

export function formatNumber(n: number | string | null | undefined, digits = 2) {
  if (n === null || n === undefined) return "-";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("th-TH", { maximumFractionDigits: digits });
}
