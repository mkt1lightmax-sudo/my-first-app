-- รูปที่พนักงานแนบส่งให้ลูกค้า — เก็บในฐานข้อมูล แล้วให้ LINE / Meta ดึงผ่านลิงก์สุ่มที่เดาไม่ได้
CREATE TABLE IF NOT EXISTS chat_media (
  token           TEXT PRIMARY KEY,                -- ส่วนหนึ่งของลิงก์ /api/chat/media/<token>
  conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
  content_type    TEXT NOT NULL,
  bytes           BYTEA NOT NULL,
  size            INTEGER NOT NULL,
  uploaded_by     INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_media_conversation ON chat_media(conversation_id);
