-- เพิ่มตำแหน่ง "ดูเท่านั้น" (viewer) — เจ้าของระบบยังเป็น role admin + is_owner = true
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'sales', 'surveyor', 'installer', 'viewer'));
