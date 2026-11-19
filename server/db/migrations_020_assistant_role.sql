-- เพิ่มตำแหน่ง "ผู้ช่วยแอดมิน" (assistant) — เห็น/ตอบแชททั้งหมดเหมือนแอดมิน แต่เพิ่ม/แก้/ลบพนักงานไม่ได้
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'assistant', 'sales', 'surveyor', 'installer', 'viewer'));
