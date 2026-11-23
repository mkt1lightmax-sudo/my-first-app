-- ไฟล์ (เช่น PDF) ที่พนักงานส่งให้ลูกค้า — เก็บชื่อไฟล์ไว้ให้ตอนเปิดลิงก์แสดงชื่อเดิม
ALTER TABLE chat_media ADD COLUMN IF NOT EXISTS file_name TEXT;
