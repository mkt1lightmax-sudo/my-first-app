-- ลิงก์ Google Maps ของลูกค้า / นัดหมาย (ช่างกด "นำทาง" ได้)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS map_url TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS map_url TEXT;

-- ถังขยะ: ลบแล้วยังกู้คืนได้ภายใน 30 วัน (หลังจากนั้นลบถาวร)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_deleted_at ON surveys(deleted_at);

-- ประวัติการแก้ไขข้อมูลลูกค้า: ใครทำ / ทำอะไร / ช่องไหนเปลี่ยนจากอะไรเป็นอะไร
CREATE TABLE IF NOT EXISTS survey_history (
  id          SERIAL PRIMARY KEY,
  survey_id   INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  staff_id    INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  changes     JSONB,                         -- { "customer_phone": { "from": "...", "to": "..." } }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_history_survey ON survey_history(survey_id, created_at DESC);
