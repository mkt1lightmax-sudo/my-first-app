const C = require("./solarConstants");

/**
 * ขั้นตอนแกนกลางร่วมกัน: คำนวณขนาดระบบ (kWp), จำนวนแผง, พลังงานที่ผลิตได้ต่อเดือน
 * roof_area_sqm/roof_direction เป็น optional — ถ้าไม่ให้มา (เช่น หน้าคำนวณเร็วก่อนสำรวจจริง)
 * จะถือว่าไม่มีข้อจำกัดพื้นที่หลังคาและวางระบบในทิศที่ดีที่สุด (ตัวคูณ = 1)
 */
function sizeSystem({ usageKwh, roof_area_sqm, roof_direction, shading_level = "none" }) {
  const directionFactor = roof_direction ? C.DIRECTION_FACTOR[roof_direction] : 1;
  if (roof_direction && directionFactor === undefined) {
    throw new Error("roof_direction ไม่ถูกต้อง");
  }
  const shadingFactor = C.SHADING_FACTOR[shading_level] ?? 1;

  // หน่วยไฟที่ใช้ต่อวัน
  const dailyKwh = usageKwh / 30;

  // ขนาดระบบที่ต้องการก่อนปรับตามทิศ/ร่มเงา
  const requiredKwpRaw = (dailyKwh * C.SOLAR_OFFSET_TARGET) / (C.PEAK_SUN_HOURS_PER_DAY * C.SYSTEM_LOSS_FACTOR);

  // ปรับตามทิศทางและร่มเงา (ยิ่งแย่ยิ่งต้องขยายขนาดชดเชย)
  const adjustedKwp = requiredKwpRaw / (directionFactor * shadingFactor);

  // เพดานตามพื้นที่หลังคาที่มี (ถ้าทราบ)
  const maxKwpByRoof = roof_area_sqm ? roof_area_sqm / C.ROOF_SQM_PER_KWP : Infinity;
  const recommendedKwpRaw = Math.min(adjustedKwp, maxKwpByRoof);
  const roofAreaLimited = adjustedKwp > maxKwpByRoof;

  // จำนวนแผง (ปัดขึ้นเป็นจำนวนเต็ม) และขนาดจริงจากจำนวนแผงเต็ม
  const panelCount = Math.max(1, Math.ceil((recommendedKwpRaw * 1000) / C.PANEL_WATT_PEAK));
  const actualKwp = (panelCount * C.PANEL_WATT_PEAK) / 1000;

  // พลังงานที่ผลิตได้โดยประมาณต่อเดือน
  const monthlyGenerationKwh = actualKwp * C.PEAK_SUN_HOURS_PER_DAY * 30 * C.SYSTEM_LOSS_FACTOR * directionFactor * shadingFactor;

  return { actualKwp, panelCount, monthlyGenerationKwh, roofAreaLimited, directionFactor, shadingFactor };
}

function resolveUsageKwh({ monthly_bill_thb, monthly_usage_kwh }) {
  if (!(monthly_bill_thb > 0) && !(monthly_usage_kwh > 0)) {
    throw new Error("ต้องกรอก monthly_bill_thb หรือ monthly_usage_kwh อย่างน้อยหนึ่งค่า");
  }
  return monthly_usage_kwh > 0 ? monthly_usage_kwh : monthly_bill_thb / C.ELECTRICITY_RATE_THB_PER_KWH;
}

/**
 * คำนวณขนาดระบบโซลาร์ที่แนะนำ เป็น pure function (ไม่แตะฐานข้อมูล) — ใช้โดยฟีเจอร์แบบสำรวจ
 * @param {object} input
 * @param {number} [input.monthly_bill_thb]
 * @param {number} [input.monthly_usage_kwh]
 * @param {number} input.roof_area_sqm
 * @param {string} input.roof_direction - N|NE|E|SE|S|SW|W|NW
 * @param {string} [input.shading_level] - none|light|moderate|heavy (default none)
 */
function calculateSolarRecommendation(input) {
  const { monthly_bill_thb, monthly_usage_kwh, roof_area_sqm, roof_direction, shading_level = "none" } = input;

  if (!roof_area_sqm || roof_area_sqm <= 0) {
    throw new Error("roof_area_sqm ต้องมากกว่า 0");
  }
  if (!roof_direction || !(roof_direction in C.DIRECTION_FACTOR)) {
    throw new Error("roof_direction ไม่ถูกต้อง");
  }

  const usageKwh = resolveUsageKwh({ monthly_bill_thb, monthly_usage_kwh });
  const sized = sizeSystem({ usageKwh, roof_area_sqm, roof_direction, shading_level });

  const estimatedMonthlySavingsThb = Math.min(sized.monthlyGenerationKwh, usageKwh) * C.ELECTRICITY_RATE_THB_PER_KWH;
  const estimatedInstallCostThb = sized.actualKwp * C.INSTALL_COST_THB_PER_KWP;
  const estimatedPaybackYears = estimatedMonthlySavingsThb > 0 ? estimatedInstallCostThb / (estimatedMonthlySavingsThb * 12) : null;

  return {
    recommended_kwp: round2(sized.actualKwp),
    recommended_panel_count: sized.panelCount,
    estimated_monthly_savings_thb: round2(estimatedMonthlySavingsThb),
    estimated_payback_years: estimatedPaybackYears === null ? null : round2(estimatedPaybackYears),
    roof_area_limited: sized.roofAreaLimited,
    estimated_install_cost_thb: round2(estimatedInstallCostThb),
    estimated_monthly_generation_kwh: round2(sized.monthlyGenerationKwh),
    inputs_used: { usage_kwh: round2(usageKwh), direction_factor: sized.directionFactor, shading_factor: sized.shadingFactor },
  };
}

/**
 * เทียบระบบ On-Grid กับ Hybrid+Battery แบบคำนวณจริงทั้งคู่ — ใช้โดยหน้าคำนวณระบบ (calculator page)
 * @param {object} input
 * @param {number} [input.monthly_bill_thb]
 * @param {number} [input.monthly_usage_kwh]
 * @param {number} [input.roof_area_sqm] - optional, ถ้าไม่ทราบจะไม่จำกัดขนาดตามหลังคา
 * @param {string} [input.roof_direction] - optional, ถ้าไม่ทราบจะถือว่าเป็นทิศที่ดีที่สุด
 * @param {string} [input.shading_level]
 * @param {number} [input.day_usage_percent] - 0-100, default 60
 * @param {'normal'|'tou'} [input.rate_type] - default 'normal'
 * @param {number} [input.usage_days_per_week] - 1-7, default 7
 * @param {'reduce_day'|'reduce_day_night'|'unsure'} [input.goal] - default 'unsure'
 */
function compareSystemOptions(input) {
  const {
    monthly_bill_thb,
    monthly_usage_kwh,
    roof_area_sqm,
    roof_direction,
    shading_level = "none",
    day_usage_percent = 60,
    rate_type = "normal",
    usage_days_per_week = 7,
    goal = "unsure",
  } = input;

  if (day_usage_percent < 0 || day_usage_percent > 100) {
    throw new Error("day_usage_percent ต้องอยู่ระหว่าง 0-100");
  }
  if (usage_days_per_week < 1 || usage_days_per_week > 7) {
    throw new Error("usage_days_per_week ต้องอยู่ระหว่าง 1-7");
  }

  const usageKwh = resolveUsageKwh({ monthly_bill_thb, monthly_usage_kwh });
  const sized = sizeSystem({ usageKwh, roof_area_sqm, roof_direction, shading_level });

  const dayUsageKwh = usageKwh * (day_usage_percent / 100);
  const nightUsageKwh = usageKwh - dayUsageKwh;
  const daysFactor = usage_days_per_week / 7; // วันที่ปิด/ไม่มีคนใช้ไฟ = solar ผลิตทิ้งเปล่า ไม่ได้ออฟเซ็ต

  const dayRate = rate_type === "tou" ? C.TOU_ON_PEAK_RATE_THB_PER_KWH : C.ELECTRICITY_RATE_THB_PER_KWH;
  const nightRate = rate_type === "tou" ? C.TOU_OFF_PEAK_RATE_THB_PER_KWH : C.ELECTRICITY_RATE_THB_PER_KWH;

  // --- On-Grid: ออฟเซ็ตได้เฉพาะช่วงกลางวัน (ไม่มีแบตเก็บไว้ใช้กลางคืน) ---
  const onGridDayOffsetKwh = Math.min(sized.monthlyGenerationKwh, dayUsageKwh) * daysFactor;
  const onGridSavingsThb = onGridDayOffsetKwh * dayRate;
  const onGridInstallCostThb = sized.actualKwp * C.INSTALL_COST_THB_PER_KWP;
  const onGridPaybackYears = onGridSavingsThb > 0 ? onGridInstallCostThb / (onGridSavingsThb * 12) : null;

  // --- Hybrid+Battery: ออฟเซ็ตกลางวันเหมือนกัน + แบตเก็บไฟส่วนเกินไว้ใช้กลางคืน ---
  const nightUsagePerDayKwh = nightUsageKwh / 30;
  const batteryKwh = pickBatterySize(nightUsagePerDayKwh);
  const nightOffsetKwh = Math.min(nightUsagePerDayKwh, batteryKwh) * 30 * daysFactor;
  const hybridSavingsThb = onGridDayOffsetKwh * dayRate + nightOffsetKwh * nightRate;
  const hybridInstallCostThb = sized.actualKwp * C.INSTALL_COST_THB_PER_KWP + batteryKwh * C.BATTERY_COST_THB_PER_KWH;
  const hybridPaybackYears = hybridSavingsThb > 0 ? hybridInstallCostThb / (hybridSavingsThb * 12) : null;

  // --- เลือกระบบที่แนะนำตามเป้าหมายลูกค้า ---
  let recommended;
  if (goal === "reduce_day") {
    recommended = "on_grid";
  } else if (goal === "reduce_day_night") {
    recommended = "hybrid";
  } else {
    recommended = day_usage_percent < 70 ? "hybrid" : "on_grid";
  }

  return {
    recommended,
    shared: {
      recommended_kwp: round2(sized.actualKwp),
      recommended_panel_count: sized.panelCount,
      estimated_monthly_generation_kwh: round2(sized.monthlyGenerationKwh),
      roof_area_limited: sized.roofAreaLimited,
    },
    on_grid: {
      estimated_monthly_savings_thb: round2(onGridSavingsThb),
      estimated_install_cost_thb: round2(onGridInstallCostThb),
      estimated_payback_years: onGridPaybackYears === null ? null : round2(onGridPaybackYears),
    },
    hybrid: {
      battery_kwh: batteryKwh,
      estimated_monthly_savings_thb: round2(hybridSavingsThb),
      estimated_install_cost_thb: round2(hybridInstallCostThb),
      estimated_payback_years: hybridPaybackYears === null ? null : round2(hybridPaybackYears),
    },
    inputs_used: { usage_kwh: round2(usageKwh), day_usage_kwh: round2(dayUsageKwh), night_usage_kwh: round2(nightUsageKwh) },
  };
}

// ปัดขนาดแบตเตอรี่ขึ้นไปยังขนาดมาตรฐานที่ใกล้ที่สุดที่ยังครอบคลุมความต้องการ (หรือขนาดใหญ่สุดถ้าเกิน)
function pickBatterySize(targetKwh) {
  const steps = C.BATTERY_SIZE_STEPS_KWH;
  const fit = steps.find((step) => step >= targetKwh);
  return fit ?? steps[steps.length - 1];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateSolarRecommendation, compareSystemOptions };
