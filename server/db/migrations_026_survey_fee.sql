-- ค่าสำรวจ (บางลูกค้าต้องจ่ายก่อนเราไปสำรวจ เช่น 5,000 บาท) — ใช้กับนัดสำรวจหน้างาน
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS survey_fee NUMERIC(12, 2);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS survey_fee_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS survey_fee_note TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS survey_fee_paid_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS survey_fee_paid_by INTEGER REFERENCES staff(id) ON DELETE SET NULL;
