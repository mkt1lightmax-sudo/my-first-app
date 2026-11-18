-- ระบบแจ้งเตือนในแอป — ใช้ตอนมอบหมายนัดหมายให้พนักงาน
CREATE TABLE IF NOT EXISTS notifications (
  id             SERIAL PRIMARY KEY,
  staff_id       INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'appointment_assigned',
  message        TEXT NOT NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_staff_unread ON notifications(staff_id, is_read);
