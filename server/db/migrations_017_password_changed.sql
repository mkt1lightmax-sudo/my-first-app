-- เวลาที่เปลี่ยนรหัสผ่านล่าสุด — ล็อกอินที่เกิดก่อนเวลานี้ถือว่าหมดอายุ (เตะออกทุกเครื่อง)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
