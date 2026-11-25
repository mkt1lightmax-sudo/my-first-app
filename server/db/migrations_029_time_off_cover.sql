-- ฝากงานระหว่างหยุด: คนที่รับฝากจะเห็น/ตอบแชท และแก้ลูกค้าของคนที่หยุดได้เฉพาะวันนั้น (หมดเองอัตโนมัติ)
ALTER TABLE staff_time_off ADD COLUMN IF NOT EXISTS cover_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_staff_time_off_cover ON staff_time_off(cover_staff_id, off_date);
