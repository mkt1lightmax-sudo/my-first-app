-- ข้อมูลลูกค้าในแชท: เบอร์โทร ที่อยู่ และโน้ตของทีม (ลูกค้าไม่เห็น)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_info_updated_at TIMESTAMPTZ;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_info_updated_by INTEGER REFERENCES staff(id) ON DELETE SET NULL;
