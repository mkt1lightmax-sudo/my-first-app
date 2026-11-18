-- แจ้งเตือนเด้งบนมือถือ/คอม (Web Push)
-- ค่าตั้งค่าระบบทั่วไป (เช่น กุญแจ VAPID ที่ระบบสร้างให้อัตโนมัติ)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อุปกรณ์ที่เปิดรับแจ้งเตือน (พนักงาน 1 คนมีได้หลายเครื่อง)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           SERIAL PRIMARY KEY,
  staff_id     INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff ON push_subscriptions(staff_id);
