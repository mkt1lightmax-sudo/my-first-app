-- รหัสลูกค้า: LM-ปีพ.ศ.(2 หลัก)เดือน-ลำดับในเดือน เช่น LM-6911-001
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS customer_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_surveys_customer_code ON surveys(customer_code);

-- ให้รหัสลูกค้าเก่าย้อนหลังตามวันที่สร้าง (เวลาไทย)
WITH numbered AS (
  SELECT id,
         'LM-' || to_char((created_at AT TIME ZONE 'Asia/Bangkok') + interval '543 years', 'YYMM') AS prefix,
         row_number() OVER (
           PARTITION BY to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYYMM')
           ORDER BY created_at, id
         ) AS n
  FROM surveys
  WHERE customer_code IS NULL
)
UPDATE surveys s SET customer_code = numbered.prefix || '-' || lpad(numbered.n::text, 3, '0')
FROM numbered WHERE numbered.id = s.id;

-- พิกัดที่ปักหมุดไว้ (ช่างปักหน้างาน / ลูกค้าปักเอง)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
