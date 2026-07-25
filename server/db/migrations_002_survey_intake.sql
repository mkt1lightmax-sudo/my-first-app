-- ขยายตาราง surveys ให้ครบตามแบบฟอร์มสอบถามลูกค้าจริงของบริษัท (7 หมวด)
-- รันครั้งเดียวหลังจาก schema.sql เดิม — ไม่ DROP อะไร ข้อมูลเดิมไม่หาย

-- ฟอร์มกระดาษจริงไม่มีช่อง "พื้นที่หลังคา/ทิศ" ตอนคุยลูกค้าครั้งแรก (ทีมประเมินไปวัดหน้างานเอง)
-- เลยต้องเปลี่ยนจากบังคับกรอกเป็นช่องเสริม (ใช้ตอนมีข้อมูลพอจะคำนวณ)
ALTER TABLE surveys ALTER COLUMN roof_area_sqm DROP NOT NULL;
ALTER TABLE surveys ALTER COLUMN roof_direction DROP NOT NULL;

-- หมวด 1: ประเภทสถานที่
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS site_type TEXT
  CHECK (site_type IN ('residential','shop','company_office','factory','commercial_building','other'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS site_type_other TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS business_hours TEXT;

-- หมวด 2: ข้อมูลค่าไฟ
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS bill_range TEXT
  CHECK (bill_range IN ('under_5000','5000_10000','10000_30000','30000_50000','over_50000'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS can_send_bill TEXT
  CHECK (can_send_bill IN ('yes','later','not_convenient'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS peak_usage_time TEXT
  CHECK (peak_usage_time IN ('day','night','even','unsure'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS weekend_usage TEXT
  CHECK (weekend_usage IN ('normal','reduced','closed'));

-- หมวด 3: อุปกรณ์ไฟฟ้าหลัก
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS main_equipment TEXT[];
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS main_equipment_other TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_count INTEGER;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_size TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_simultaneous_count INTEGER;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_usage_start TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_usage_end TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_daily_hours NUMERIC(4,1);
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ac_usage_period TEXT
  CHECK (ac_usage_period IN ('day','night','both'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS other_equipment_type TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS other_equipment_count INTEGER;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS other_equipment_usage_time TEXT;

-- หมวด 4: ข้อมูลระบบไฟ
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS meter_type TEXT
  CHECK (meter_type IN ('1_phase','3_phase','tou','unsure'));

-- หมวด 5: ความต้องการของลูกค้า
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS customer_needs TEXT[];
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS interested_system TEXT
  CHECK (interested_system IN ('on_grid','hybrid_battery','unsure'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS install_timeline TEXT;

-- หมวด 6: ข้อมูลหน้างาน (roof_type เดิมเป็น free text — เปลี่ยนเป็น enum ที่ตรงกับฟอร์มจริง)
ALTER TABLE surveys ADD CONSTRAINT surveys_roof_type_check
  CHECK (roof_type IN ('metal_sheet','double_lap_tile','cpac_tile','concrete_rooftop','unknown','other'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS roof_type_other TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS shading_presence TEXT
  CHECK (shading_presence IN ('none','yes','unsure'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS requested_photos TEXT[];

-- หมวด 7: สรุปสำหรับทีมประเมิน (เฉพาะส่วนที่ไม่ได้มาจากหมวดอื่น)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS battery_interest TEXT
  CHECK (battery_interest IN ('interested','not_interested','considering'));
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS documents_received TEXT[];
