-- เพิ่มคอลัมน์เก็บผลลัพธ์จากเครื่องคำนวณเปรียบเทียบ On-Grid vs Hybrid+Battery (หน้าคำนวณระบบ)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS recommended_system_type TEXT
  CHECK (recommended_system_type IN ('on_grid', 'hybrid'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS recommended_battery_kwh NUMERIC(6,2);
