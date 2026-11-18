-- ระบบทิกเก็ตแชท: เปิด/ปิด, สแปม, ตอบแล้ว/ยังไม่ตอบ, ติดตาม
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';   -- 'open' | 'closed'
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS closed_by_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS is_spam BOOLEAN NOT NULL DEFAULT false;
-- ข้อความล่าสุดเป็นของใคร: 'in' = ลูกค้า (ยังไม่ได้ตอบ), 'out' = เรา (ตอบแล้ว)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_message_direction TEXT;
UPDATE chat_conversations c SET last_message_direction = (
  SELECT m.direction FROM chat_messages m WHERE m.conversation_id = c.id AND m.direction IN ('in', 'out')
  ORDER BY m.created_at DESC, m.id DESC LIMIT 1
) WHERE last_message_direction IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status, last_message_at DESC);

-- พนักงานกด "ติดตาม" แชทไว้ดูภายหลัง (แต่ละคนติดตามของตัวเอง)
CREATE TABLE IF NOT EXISTS chat_follows (
  staff_id        INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, conversation_id)
);
