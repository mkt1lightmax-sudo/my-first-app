-- LINE ID ส่วนตัวของลูกค้า (ถ้าลูกค้าให้มา) — ใช้ปุ่ม "เปิดใน LINE" ไปหน้าโปรไฟล์ลูกค้า
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_line_id TEXT;
