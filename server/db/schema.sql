-- รันไฟล์นี้กับฐานข้อมูล Neon ครั้งเดียวตอน setup (ผ่าน Neon SQL editor หรือ psql)
-- โครงสร้าง surveys อ้างอิงจากแบบฟอร์มสอบถามลูกค้าจริง 7 หมวด (แบบฟอร์มสอบถามลูกค้า_SolarCell.docx)

CREATE TABLE IF NOT EXISTS staff (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'sales'
                CHECK (role IN ('admin', 'sales', 'surveyor', 'installer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveys (
  id                             SERIAL PRIMARY KEY,
  customer_name                  TEXT NOT NULL,
  customer_phone                 TEXT,
  customer_address               TEXT,

  -- หมวด 1: ประเภทสถานที่
  site_type                      TEXT
                                  CHECK (site_type IN ('residential','shop','company_office','factory','commercial_building','other')),
  site_type_other                TEXT,
  business_type                  TEXT,
  business_hours                 TEXT,

  -- หมวด 2: ข้อมูลค่าไฟ
  bill_range                     TEXT
                                  CHECK (bill_range IN ('under_5000','5000_10000','10000_30000','30000_50000','over_50000')),
  monthly_bill_thb               NUMERIC(10,2),
  monthly_usage_kwh              NUMERIC(10,2),
  can_send_bill                  TEXT
                                  CHECK (can_send_bill IN ('yes','later','not_convenient')),
  peak_usage_time                TEXT
                                  CHECK (peak_usage_time IN ('day','night','even','unsure')),
  weekend_usage                  TEXT
                                  CHECK (weekend_usage IN ('normal','reduced','closed')),

  -- หมวด 3: อุปกรณ์ไฟฟ้าหลัก
  main_equipment                 TEXT[],
  main_equipment_other           TEXT,
  ac_count                       INTEGER,
  ac_size                        TEXT,
  ac_simultaneous_count          INTEGER,
  ac_usage_start                 TEXT,
  ac_usage_end                   TEXT,
  ac_daily_hours                 NUMERIC(4,1),
  ac_usage_period                TEXT
                                  CHECK (ac_usage_period IN ('day','night','both')),
  other_equipment_type           TEXT,
  other_equipment_count          INTEGER,
  other_equipment_usage_time     TEXT,

  -- หมวด 4: ข้อมูลระบบไฟ
  meter_type                     TEXT
                                  CHECK (meter_type IN ('1_phase','3_phase','tou','unsure')),

  -- หมวด 5: ความต้องการของลูกค้า
  customer_needs                 TEXT[],
  interested_system              TEXT
                                  CHECK (interested_system IN ('on_grid','hybrid_battery','unsure')),
  budget                         TEXT,
  install_timeline               TEXT,

  -- หมวด 6: ข้อมูลหน้างาน
  roof_type                      TEXT
                                  CHECK (roof_type IN ('metal_sheet','double_lap_tile','cpac_tile','concrete_rooftop','unknown','other')),
  roof_type_other                TEXT,
  shading_presence                TEXT
                                  CHECK (shading_presence IN ('none','yes','unsure')),
  requested_photos               TEXT[],
  -- ไม่มีในฟอร์มกระดาษ แต่จำเป็นสำหรับเครื่องคำนวณขนาดระบบ — เป็นช่องเสริม กรอกถ้าประเมินได้
  roof_area_sqm                  NUMERIC(8,2),
  roof_direction                 TEXT
                                  CHECK (roof_direction IN ('N','NE','E','SE','S','SW','W','NW')),
  shading_level                  TEXT NOT NULL DEFAULT 'none'
                                  CHECK (shading_level IN ('none','light','moderate','heavy')),

  -- หมวด 7: สรุปสำหรับทีมประเมิน (เฉพาะส่วนที่ไม่ได้มาจากหมวดอื่น/ผลคำนวณ)
  battery_interest                TEXT
                                  CHECK (battery_interest IN ('interested','not_interested','considering')),
  documents_received             TEXT[],

  notes                          TEXT,
  status                         TEXT NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft','submitted','reviewed')),

  -- ผลคำนวณระบบโซลาร์ (มาจาก api/lib/solarCalculator.js)
  recommended_kwp                NUMERIC(6,2),
  recommended_panel_count        INTEGER,
  estimated_monthly_savings_thb  NUMERIC(10,2),
  estimated_payback_years        NUMERIC(5,2),
  roof_area_limited              BOOLEAN,
  calculated_at                  TIMESTAMPTZ,
  -- ผลจากหน้าคำนวณเทียบ On-Grid vs Hybrid+Battery (api/lib/solarCalculator.js compareSystemOptions)
  recommended_system_type        TEXT
                                  CHECK (recommended_system_type IN ('on_grid', 'hybrid')),
  recommended_battery_kwh        NUMERIC(6,2),

  created_by                     INTEGER REFERENCES staff(id),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('site_survey','presentation','installation')),
  survey_id         INTEGER REFERENCES surveys(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT,
  customer_address  TEXT,
  scheduled_start   TIMESTAMPTZ NOT NULL,
  scheduled_end     TIMESTAMPTZ NOT NULL,
  assigned_staff_id INTEGER REFERENCES staff(id),
  status            TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  notes             TEXT,
  created_by        INTEGER REFERENCES staff(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_start ON appointments(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_staff  ON appointments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by           ON surveys(created_by);
