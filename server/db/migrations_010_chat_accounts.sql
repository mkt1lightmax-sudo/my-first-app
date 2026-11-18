-- หลายบัญชีต่อช่องทาง: LINE OA หลายบัญชี, เพจ Facebook หลายเพจ, IG หลายบัญชี (ไม่จำกัดจำนวน)
CREATE TABLE IF NOT EXISTS chat_accounts (
  id                  SERIAL PRIMARY KEY,
  channel             TEXT NOT NULL CHECK (channel IN ('line', 'messenger', 'instagram')),
  name                TEXT NOT NULL,             -- ชื่อที่ทีมเห็น เช่น "LINE หลัก", "เพจ LIGHTMAX"
  line_channel_secret TEXT,                      -- LINE เท่านั้น
  line_access_token   TEXT,                      -- LINE เท่านั้น
  meta_page_id        TEXT,                      -- Messenger: ไอดีเพจ
  meta_ig_id          TEXT,                      -- Instagram: ไอดีบัญชี IG ธุรกิจ
  meta_page_token     TEXT,                      -- Messenger/IG: Page access token ของเพจ (IG ใช้ของเพจที่ผูกอยู่)
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_accounts_page ON chat_accounts(meta_page_id) WHERE channel = 'messenger';
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_accounts_ig   ON chat_accounts(meta_ig_id)   WHERE channel = 'instagram';

-- แชทแต่ละห้องผูกกับบัญชีที่ลูกค้าทักเข้ามา (ลูกค้าคนเดียวทัก 2 OA = 2 ห้องแชท)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES chat_accounts(id) ON DELETE SET NULL;
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_channel_external_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_account_user ON chat_conversations(account_id, external_user_id);
