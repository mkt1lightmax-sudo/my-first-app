-- ไฟล์เครื่องมือภายในทีม (เช่น หน้าทำภาพนำเสนอลูกค้า) — เก็บในฐานข้อมูลแทน GitHub เพราะมีราคาแพ็กเกจ และ repo เป็นสาธารณะ
CREATE TABLE IF NOT EXISTS app_files (
  name        TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
