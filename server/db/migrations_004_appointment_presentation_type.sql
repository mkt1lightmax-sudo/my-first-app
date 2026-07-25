-- เพิ่มประเภทนัดหมาย "นำเสนองาน" (เสนอราคา/นำเสนอผลสำรวจให้ลูกค้า) ต่อจากสำรวจหน้างาน ก่อนติดตั้ง
ALTER TABLE appointments DROP CONSTRAINT appointments_type_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check
  CHECK (type IN ('site_survey', 'presentation', 'installation'));
