-- แชท: มอบหมายผู้ดูแลลูกค้า + ป้ายแบ่งกลุ่มลูกค้า
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_chat_conversations_assigned ON chat_conversations(assigned_staff_id);

-- แจ้งเตือนเมื่อถูกมอบหมายแชท
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS chat_conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE;
