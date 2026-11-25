-- สถานะลูกค้าตามขั้นตอนการขาย (แทน ร่าง / ส่งแล้ว / ตรวจแล้ว ที่ไม่ได้ใช้จริง)
-- new = ลูกค้าใหม่, survey_booked = นัดสำรวจแล้ว, quoted = เสนอราคาแล้ว, won = ปิดการขาย, lost = ไม่สนใจ
ALTER TABLE surveys DROP CONSTRAINT IF EXISTS surveys_status_check;
UPDATE surveys s SET status = CASE
  WHEN EXISTS (SELECT 1 FROM appointments a WHERE a.survey_id = s.id AND a.type = 'installation' AND a.status <> 'cancelled') THEN 'won'
  WHEN EXISTS (SELECT 1 FROM appointments a WHERE a.survey_id = s.id AND a.type = 'presentation' AND a.status <> 'cancelled') THEN 'quoted'
  WHEN EXISTS (SELECT 1 FROM appointments a WHERE a.survey_id = s.id AND a.type = 'site_survey' AND a.status <> 'cancelled') THEN 'survey_booked'
  ELSE 'new'
END
WHERE status IN ('draft', 'submitted', 'reviewed');
ALTER TABLE surveys ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE surveys ADD CONSTRAINT surveys_status_check CHECK (status IN ('new', 'survey_booked', 'quoted', 'won', 'lost'));
