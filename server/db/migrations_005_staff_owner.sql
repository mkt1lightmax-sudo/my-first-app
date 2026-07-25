-- เพิ่มสถานะ "เจ้าของระบบ" — บัญชีนี้ลบไม่ได้ไม่ว่าใครจะพยายามลบ (รวมถึงแอดมินคนอื่น)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;
