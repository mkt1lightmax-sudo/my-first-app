-- วันหยุดของพนักงาน (ใช้กับคิวสำรวจ) — หยุดทั้งวัน / ครึ่งวันเช้า / ครึ่งวันบ่าย, วันละ 1 รายการต่อคน
CREATE TABLE IF NOT EXISTS staff_time_off (
  id          SERIAL PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  off_date    DATE NOT NULL,
  period      TEXT NOT NULL CHECK (period IN ('full', 'morning', 'afternoon')),
  note        TEXT,
  created_by  INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, off_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_date ON staff_time_off(off_date);
