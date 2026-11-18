-- ระบบรวมแชท (LINE OA ก่อน — ในอนาคตเพิ่ม Messenger / IG ได้ด้วย channel)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id                   SERIAL PRIMARY KEY,
  channel              TEXT NOT NULL,              -- 'line' | 'messenger' | 'instagram' ...
  external_user_id     TEXT NOT NULL,              -- ไอดีลูกค้าในแพลตฟอร์มนั้น
  display_name         TEXT,
  picture_url          TEXT,
  last_message_preview TEXT,
  last_message_at      TIMESTAMPTZ,
  unread_count         INTEGER NOT NULL DEFAULT 0,
  reply_token          TEXT,                       -- LINE: ตอบฟรีได้ถ้าใช้ภายใน ~1 นาที
  reply_token_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last ON chat_conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                  SERIAL PRIMARY KEY,
  conversation_id     INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL,               -- 'in' = ลูกค้าส่งมา, 'out' = เราตอบ
  message_type        TEXT NOT NULL DEFAULT 'text',
  text                TEXT,
  external_message_id TEXT,
  sent_by_staff_id    INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_external ON chat_messages(external_message_id) WHERE external_message_id IS NOT NULL;
