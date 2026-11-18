-- รันไฟล์นี้กับฐานข้อมูล Neon ครั้งเดียวตอน setup (ผ่าน Neon SQL editor หรือ psql)
-- โครงสร้าง surveys อ้างอิงจากแบบฟอร์มสอบถามลูกค้าจริง 7 หมวด (แบบฟอร์มสอบถามลูกค้า_SolarCell.docx)

CREATE TABLE IF NOT EXISTS staff (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'sales'
                CHECK (role IN ('admin', 'sales', 'surveyor', 'installer')),
  is_owner      BOOLEAN NOT NULL DEFAULT false, -- เจ้าของระบบ ลบไม่ได้ไม่ว่าใครพยายามลบ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveys (
  id                             SERIAL PRIMARY KEY,
  customer_name                  TEXT NOT NULL,
  customer_phone                 TEXT,
  customer_address               TEXT,

  -- หมวด 1: ประเภทสถานที่
  site_type                      TEXT
                                  CHECK (site_type IN ('residential','shop','company_office','factory','commercial_building','other')),
  site_type_other                TEXT,
  business_type                  TEXT,
  business_hours                 TEXT,

  -- หมวด 2: ข้อมูลค่าไฟ
  bill_range                     TEXT
                                  CHECK (bill_range IN ('under_5000','5000_10000','10000_30000','30000_50000','over_50000')),
  monthly_bill_thb               NUMERIC(10,2),
  monthly_usage_kwh              NUMERIC(10,2),
  can_send_bill                  TEXT
                                  CHECK (can_send_bill IN ('yes','later','not_convenient')),
  peak_usage_time                TEXT
                                  CHECK (peak_usage_time IN ('day','night','even','unsure')),
  weekend_usage                  TEXT
                                  CHECK (weekend_usage IN ('normal','reduced','closed')),

  -- หมวด 3: อุปกรณ์ไฟฟ้าหลัก
  main_equipment                 TEXT[],
  main_equipment_other           TEXT,
  ac_count                       INTEGER,
  ac_size                        TEXT,
  ac_simultaneous_count          INTEGER,
  ac_usage_start                 TEXT,
  ac_usage_end                   TEXT,
  ac_daily_hours                 NUMERIC(4,1),
  ac_usage_period                TEXT
                                  CHECK (ac_usage_period IN ('day','night','both')),
  other_equipment_type           TEXT,
  other_equipment_count          INTEGER,
  other_equipment_usage_time     TEXT,

  -- หมวด 4: ข้อมูลระบบไฟ
  meter_type                     TEXT
                                  CHECK (meter_type IN ('1_phase','3_phase','tou','unsure')),

  -- หมวด 5: ความต้องการของลูกค้า
  customer_needs                 TEXT[],
  interested_system              TEXT
                                  CHECK (interested_system IN ('on_grid','hybrid_battery','unsure')),
  budget                         TEXT,
  install_timeline               TEXT,

  -- หมวด 6: ข้อมูลหน้างาน
  roof_type                      TEXT
                                  CHECK (roof_type IN ('metal_sheet','double_lap_tile','cpac_tile','concrete_rooftop','unknown','other')),
  roof_type_other                TEXT,
  shading_presence                TEXT
                                  CHECK (shading_presence IN ('none','yes','unsure')),
  requested_photos               TEXT[],
  -- ไม่มีในฟอร์มกระดาษ แต่จำเป็นสำหรับเครื่องคำนวณขนาดระบบ — เป็นช่องเสริม กรอกถ้าประเมินได้
  roof_area_sqm                  NUMERIC(8,2),
  roof_direction                 TEXT
                                  CHECK (roof_direction IN ('N','NE','E','SE','S','SW','W','NW')),
  shading_level                  TEXT NOT NULL DEFAULT 'none'
                                  CHECK (shading_level IN ('none','light','moderate','heavy')),

  -- หมวด 7: สรุปสำหรับทีมประเมิน (เฉพาะส่วนที่ไม่ได้มาจากหมวดอื่น/ผลคำนวณ)
  battery_interest                TEXT
                                  CHECK (battery_interest IN ('interested','not_interested','considering')),
  documents_received             TEXT[],

  notes                          TEXT,
  status                         TEXT NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft','submitted','reviewed')),

  -- ผลคำนวณระบบโซลาร์ (มาจาก api/lib/solarCalculator.js)
  recommended_kwp                NUMERIC(6,2),
  recommended_panel_count        INTEGER,
  estimated_monthly_savings_thb  NUMERIC(10,2),
  estimated_payback_years        NUMERIC(5,2),
  roof_area_limited              BOOLEAN,
  calculated_at                  TIMESTAMPTZ,
  -- ผลจากหน้าคำนวณเทียบ On-Grid vs Hybrid+Battery (api/lib/solarCalculator.js compareSystemOptions)
  recommended_system_type        TEXT
                                  CHECK (recommended_system_type IN ('on_grid', 'hybrid')),
  recommended_battery_kwh        NUMERIC(6,2),

  created_by                     INTEGER REFERENCES staff(id),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('site_survey','presentation','installation')),
  survey_id         INTEGER REFERENCES surveys(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT,
  customer_address  TEXT,
  scheduled_start   TIMESTAMPTZ NOT NULL,
  scheduled_end     TIMESTAMPTZ NOT NULL,
  assigned_staff_id INTEGER REFERENCES staff(id),
  status            TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  notes             TEXT,
  created_by        INTEGER REFERENCES staff(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_start ON appointments(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_staff  ON appointments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by           ON surveys(created_by);

-- ระบบแจ้งเตือนในแอป — ใช้ตอนมอบหมายนัดหมายให้พนักงาน
CREATE TABLE IF NOT EXISTS notifications (
  id             SERIAL PRIMARY KEY,
  staff_id       INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'appointment_assigned',
  message        TEXT NOT NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_staff_unread ON notifications(staff_id, is_read);

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

-- แชท: มอบหมายผู้ดูแลลูกค้า + ป้ายแบ่งกลุ่มลูกค้า
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_chat_conversations_assigned ON chat_conversations(assigned_staff_id);

-- แจ้งเตือนเมื่อถูกมอบหมายแชท
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS chat_conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE;

-- เวลาที่ลูกค้าทักมาล่าสุด — ใช้เช็กกฎ 24 ชม. ของ Messenger / Instagram
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
UPDATE chat_conversations c SET last_inbound_at = (
  SELECT MAX(created_at) FROM chat_messages m WHERE m.conversation_id = c.id AND m.direction = 'in'
) WHERE last_inbound_at IS NULL;

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

-- เพิ่มตำแหน่ง "ดูเท่านั้น" (viewer) — เจ้าของระบบยังเป็น role admin + is_owner = true
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'sales', 'surveyor', 'installer', 'viewer'));

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
