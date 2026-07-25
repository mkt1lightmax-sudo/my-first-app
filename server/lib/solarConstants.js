// ค่าคงที่ที่ใช้ในการคำนวณขนาดระบบโซลาร์ที่แนะนำ — ปรับได้ตามข้อมูลจริงของบริษัท
module.exports = {
  PEAK_SUN_HOURS_PER_DAY: 4.5, // ชั่วโมงแดดจัดเฉลี่ยต่อวันในไทย
  ELECTRICITY_RATE_THB_PER_KWH: 3.95, // อัตราไฟฟ้าปกติเฉลี่ย (อ้างอิงประกาศการไฟฟ้า รวม Ft ปี 2569)
  ROOF_SQM_PER_KWP: 6, // พื้นที่หลังคาที่ต้องใช้ต่อระบบ 1 kWp
  PANEL_WATT_PEAK: 550, // กำลังไฟต่อแผง (วัตต์)
  SYSTEM_LOSS_FACTOR: 0.8, // การสูญเสียจากอินเวอร์เตอร์/สายไฟ/อุณหภูมิ/ฝุ่น
  SOLAR_OFFSET_TARGET: 0.9, // เป้าหมายชดเชยการใช้ไฟ ~90% (ไม่ผลิตเกินจนต้องขายคืนเยอะ)
  INSTALL_COST_THB_PER_KWP: 35000, // ต้นทุนติดตั้งโดยประมาณต่อ kWp
  DIRECTION_FACTOR: { S: 1.0, SE: 0.95, SW: 0.95, E: 0.85, W: 0.85, NE: 0.75, NW: 0.75, N: 0.65 },
  SHADING_FACTOR: { none: 1.0, light: 0.9, moderate: 0.75, heavy: 0.5 },

  // อัตรา TOU (Time of Use) — อ้างอิงประกาศ กกพ./MEA/PEA ปี 2569, on-peak 09:00-22:00 จ-ศ, off-peak นอกเวลานั้น+เสาร์-อาทิตย์+วันหยุด
  TOU_ON_PEAK_RATE_THB_PER_KWH: 4.1025,
  TOU_OFF_PEAK_RATE_THB_PER_KWH: 2.5849,

  BATTERY_COST_THB_PER_KWH: 20000, // ต้นทุนแบตเตอรี่โดยประมาณต่อ kWh (ปรับได้เมื่อมีเรตจริงของบริษัท)
  BATTERY_SIZE_STEPS_KWH: [5, 10, 16, 20], // ขนาดแบตเตอรี่มาตรฐานที่มีขาย — ปัดขึ้นไปขนาดที่ใกล้ที่สุด
};
