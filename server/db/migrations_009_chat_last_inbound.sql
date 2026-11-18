-- เวลาที่ลูกค้าทักมาล่าสุด — ใช้เช็กกฎ 24 ชม. ของ Messenger / Instagram
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
UPDATE chat_conversations c SET last_inbound_at = (
  SELECT MAX(created_at) FROM chat_messages m WHERE m.conversation_id = c.id AND m.direction = 'in'
) WHERE last_inbound_at IS NULL;
