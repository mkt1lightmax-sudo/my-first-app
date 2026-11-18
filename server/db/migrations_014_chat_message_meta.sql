-- ข้อมูลเสริมของข้อความ เช่น รหัสสติกเกอร์, ชื่อไฟล์, ลิงก์รูปของ Meta, พิกัดแผนที่
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS meta JSONB;
