-- เซลผู้ดูแลลูกค้า (แยกจากคนที่สร้างข้อมูล) — ลูกค้าเดิมใช้ผู้สร้างไปก่อน
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS sales_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
UPDATE surveys SET sales_staff_id = created_by WHERE sales_staff_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_sales_staff ON surveys(sales_staff_id);
