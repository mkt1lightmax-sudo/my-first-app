-- ยอดขายต่อทิกเก็ต
-- ticket_seq: รอบของทิกเก็ตในห้องแชทเดียวกัน — ลูกค้าทักมาใหม่หลังปิดทิกเก็ต = รอบใหม่ (นับยอดขายแยกกัน)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS ticket_seq INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS chat_deals (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  ticket_seq      INTEGER NOT NULL,
  amount          NUMERIC(12, 2),                 -- ยอดขาย (บาท)
  outcome         TEXT CHECK (outcome IN ('won', 'lost')),  -- ปิดการขายได้ / ไม่ได้ / NULL = ยังไม่สรุป
  note            TEXT,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,  -- เซลล์ที่ได้ยอดนี้
  updated_by      INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, ticket_seq)
);

CREATE INDEX IF NOT EXISTS idx_chat_deals_updated ON chat_deals(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_deals_staff ON chat_deals(staff_id);
