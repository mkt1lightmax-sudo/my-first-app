const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const line = require("../lib/line");
const meta = require("../lib/meta");
const accountsRouter = require("./chatAccounts");

const router = express.Router();

// จัดการบัญชี LINE OA / เพจ / IG (หลายบัญชี)
router.use("/accounts", accountsRouter);

// reply token ของ LINE ใช้ได้ไม่นาน — เผื่อเวลาไว้ให้ปลอดภัย
const REPLY_TOKEN_MAX_AGE_MS = 50 * 1000;

function getAccount(id) {
  return query("SELECT * FROM chat_accounts WHERE id = $1", [id]).then((r) => r.rows[0]);
}

// ---------- LINE webhook: แต่ละ OA มี URL ของตัวเอง /line/webhook/<ไอดีบัญชี> ----------
router.post("/line/webhook/:accountId", async (req, res) => {
  const account = await getAccount(Number(req.params.accountId) || 0);
  if (!account || account.channel !== "line" || !account.is_active) {
    return res.status(404).json({ ok: false, error: "account not found" });
  }
  if (!line.verifySignature(account.line_channel_secret, req.rawBody, req.get("x-line-signature"))) {
    return res.status(401).json({ ok: false, error: "invalid signature" });
  }

  for (const event of req.body?.events || []) {
    try {
      await handleLineEvent(account, event);
    } catch (err) {
      console.error("LINE event error:", err);
    }
  }
  res.json({ ok: true });
});

async function handleLineEvent(account, event) {
  const userId = event.source?.userId;
  if (!userId || event.type !== "message") return;

  await recordMessage({
    account,
    userId,
    getProfile: () => line.getProfile(account.line_access_token, userId),
    direction: "in",
    type: event.message.type,
    text: line.messageToText(event.message),
    externalId: event.message.id,
    at: new Date(event.timestamp || Date.now()),
    replyToken: event.replyToken || null,
  });
}

// ---------- Meta webhook (Messenger + Instagram ทุกเพจใช้ URL เดียวกัน) ----------
// Meta เรียก GET ครั้งแรกตอนตั้งค่า เพื่อยืนยันว่า URL นี้เป็นของเรา
router.get("/meta/webhook", (req, res) => {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (verifyToken && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === verifyToken) {
    return res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  }
  res.status(403).send("forbidden");
});

router.post("/meta/webhook", async (req, res) => {
  if (!meta.verifySignature(req.rawBody, req.get("x-hub-signature-256"))) {
    return res.status(401).json({ ok: false, error: "invalid signature" });
  }

  const channel = req.body?.object === "instagram" ? "instagram" : req.body?.object === "page" ? "messenger" : null;
  if (channel) {
    for (const entry of req.body.entry || []) {
      // entry.id = ไอดีเพจ (Messenger) หรือไอดี IG (Instagram) — ใช้หาว่าเป็นบัญชีไหนของเรา
      const column = channel === "instagram" ? "meta_ig_id" : "meta_page_id";
      const account = (
        await query(`SELECT * FROM chat_accounts WHERE channel = $1 AND ${column} = $2 AND is_active`, [channel, String(entry.id)])
      ).rows[0];
      if (!account) continue;

      for (const event of entry.messaging || []) {
        try {
          await handleMetaEvent(account, event);
        } catch (err) {
          console.error("Meta event error:", err);
        }
      }
    }
  }
  res.json({ ok: true });
});

async function handleMetaEvent(account, event) {
  const message = event.message;
  if (!message || !message.mid) return;
  // is_echo = ข้อความที่เพจส่งออกไป (จากแอปเรา หรือจาก Meta Business Suite) — ลูกค้าคือฝั่งผู้รับ
  const isEcho = Boolean(message.is_echo);
  const userId = isEcho ? event.recipient?.id : event.sender?.id;
  if (!userId) return;

  await recordMessage({
    account,
    userId,
    getProfile: () => meta.getProfile(account.meta_page_token, account.channel, userId),
    direction: isEcho ? "out" : "in",
    type: message.text ? "text" : message.attachments?.[0]?.type || "unknown",
    text: meta.messageToText(message),
    externalId: message.mid,
    at: new Date(event.timestamp || Date.now()),
  });
}

// บันทึกข้อความเข้าฐานข้อมูล (ใช้ร่วมกันทุกช่องทาง) — ข้อความซ้ำจะถูกข้าม
async function recordMessage({ account, userId, getProfile, direction, type, text, externalId, at, replyToken = null }) {
  let convo = (
    await query("SELECT id, display_name FROM chat_conversations WHERE account_id = $1 AND external_user_id = $2", [account.id, userId])
  ).rows[0];

  if (!convo || !convo.display_name) {
    const profile = await getProfile();
    convo = (
      await query(
        `INSERT INTO chat_conversations (account_id, channel, external_user_id, display_name, picture_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, external_user_id)
         DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, chat_conversations.display_name),
                       picture_url  = COALESCE(EXCLUDED.picture_url, chat_conversations.picture_url)
         RETURNING id`,
        [account.id, account.channel, userId, profile?.displayName || null, profile?.pictureUrl || null]
      )
    ).rows[0];
  }

  const inserted = await query(
    `INSERT INTO chat_messages (conversation_id, direction, message_type, text, external_message_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING RETURNING id`,
    [convo.id, direction, type, text, externalId, at]
  );
  if (!inserted.rows[0]) return; // ส่งซ้ำ หรือเป็นข้อความที่แอปเราส่งเองและบันทึกไว้แล้ว

  if (direction === "in") {
    await query(
      `UPDATE chat_conversations
       SET last_message_preview = $2, last_message_at = $3, last_inbound_at = $3, unread_count = unread_count + 1,
           reply_token = $4, reply_token_at = CASE WHEN $4::text IS NULL THEN NULL ELSE now() END
       WHERE id = $1`,
      [convo.id, text, at, replyToken]
    );
  } else {
    await query("UPDATE chat_conversations SET last_message_preview = $2, last_message_at = $3 WHERE id = $1", [convo.id, text, at]);
  }
}

// ---------- API สำหรับหน้าแชทในแอป (ต้องล็อกอิน) ----------
const PRESET_TAGS = ["ลูกค้าใหม่", "สนใจ", "รอใบเสนอราคา", "นัดสำรวจแล้ว", "ปิดการขาย", "ไม่สนใจ"];

const CONVO_FROM = `chat_conversations c
  LEFT JOIN staff s ON s.id = c.assigned_staff_id
  LEFT JOIN chat_accounts a ON a.id = c.account_id`;

const CONVO_COLUMNS = `c.id, c.channel, c.account_id, a.name AS account_name, c.display_name, c.picture_url,
  c.last_message_preview, c.last_message_at, c.last_inbound_at, c.unread_count,
  c.assigned_staff_id, s.name AS assigned_staff_name, c.tags`;

function selectConvo(id) {
  return query(`SELECT ${CONVO_COLUMNS} FROM ${CONVO_FROM} WHERE c.id = $1`, [id]).then((r) => r.rows[0]);
}

// รายการแชท — กรองได้: ?filter=mine|unassigned  ?tag=ชื่อป้าย  ?staff=ไอดีพนักงาน  ?account=ไอดีบัญชี
router.get("/conversations", requireAuth, async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (req.query.filter === "mine") add("c.assigned_staff_id = ?", req.staff.id);
  else if (req.query.filter === "unassigned") where.push("c.assigned_staff_id IS NULL");
  if (req.query.staff) add("c.assigned_staff_id = ?", Number(req.query.staff));
  if (req.query.account) add("c.account_id = ?", Number(req.query.account));
  if (req.query.tag) add("? = ANY(c.tags)", String(req.query.tag));

  const result = await query(
    `SELECT ${CONVO_COLUMNS} FROM ${CONVO_FROM}
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY c.last_message_at DESC NULLS LAST LIMIT 200`,
    params
  );
  res.json({ ok: true, conversations: result.rows });
});

// ป้ายทั้งหมด (ป้ายตั้งต้น + ป้ายที่ทีมสร้างเอง)
router.get("/tags", requireAuth, async (req, res) => {
  const result = await query("SELECT DISTINCT unnest(tags) AS tag FROM chat_conversations");
  const used = result.rows.map((r) => r.tag);
  res.json({ ok: true, tags: [...new Set([...PRESET_TAGS, ...used])] });
});

// เปลี่ยนผู้ดูแล และ/หรือ ป้ายกลุ่ม — body: { assigned_staff_id?: number|null, tags?: string[] }
router.patch("/conversations/:id", requireAuth, async (req, res) => {
  const convo = (await query("SELECT * FROM chat_conversations WHERE id = $1", [req.params.id])).rows[0];
  if (!convo) return res.status(404).json({ ok: false, error: "conversation not found" });

  let assigned = convo.assigned_staff_id;
  if (req.body && "assigned_staff_id" in req.body) {
    assigned = req.body.assigned_staff_id === null ? null : Number(req.body.assigned_staff_id);
    if (assigned !== null) {
      const exists = await query("SELECT id FROM staff WHERE id = $1", [assigned]);
      if (!exists.rows[0]) return res.status(400).json({ ok: false, error: "ไม่พบพนักงานคนนี้" });
    }
  }

  let tags = convo.tags;
  if (req.body && Array.isArray(req.body.tags)) {
    tags = [...new Set(req.body.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 10);
  }

  await query("UPDATE chat_conversations SET assigned_staff_id = $2, tags = $3 WHERE id = $1", [convo.id, assigned, tags]);

  // แจ้งเตือนคนที่ถูกมอบหมาย (ไม่แจ้งถ้ารับเรื่องเอง)
  if (assigned && assigned !== convo.assigned_staff_id && assigned !== req.staff.id) {
    await query(
      "INSERT INTO notifications (staff_id, type, message, chat_conversation_id) VALUES ($1, 'chat_assigned', $2, $3)",
      [assigned, `คุณได้รับมอบหมายให้ดูแลแชทลูกค้า: ${convo.display_name || "ลูกค้า"}`, convo.id]
    );
  }

  res.json({ ok: true, conversation: await selectConvo(convo.id) });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const convo = await selectConvo(req.params.id);
  if (!convo) return res.status(404).json({ ok: false, error: "conversation not found" });

  const messages = await query(
    `SELECT m.id, m.direction, m.message_type, m.text, m.created_at, s.name AS staff_name
     FROM chat_messages m LEFT JOIN staff s ON s.id = m.sent_by_staff_id
     WHERE m.conversation_id = $1 ORDER BY m.created_at ASC, m.id ASC LIMIT 500`,
    [convo.id]
  );
  await query("UPDATE chat_conversations SET unread_count = 0 WHERE id = $1 AND unread_count > 0", [convo.id]);
  res.json({ ok: true, conversation: convo, messages: messages.rows });
});

// ส่งข้อความตอบลูกค้า — ส่งออกทางบัญชีเดียวกับที่ลูกค้าทักเข้ามา
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "text is required" });
  if (text.length > 2000) return res.status(400).json({ ok: false, error: "ข้อความยาวเกิน 2000 ตัวอักษร" });

  const convo = (await query("SELECT * FROM chat_conversations WHERE id = $1", [req.params.id])).rows[0];
  if (!convo) return res.status(404).json({ ok: false, error: "conversation not found" });
  const account = convo.account_id ? await getAccount(convo.account_id) : null;
  if (!account || !account.is_active) {
    return res.status(400).json({ ok: false, error: "บัญชีของแชทนี้ถูกลบหรือปิดใช้งานแล้ว ตอบกลับไม่ได้" });
  }

  let externalId = null;
  try {
    if (account.channel === "line") {
      await sendLine(account, convo, text);
    } else {
      const last = convo.last_inbound_at ? new Date(convo.last_inbound_at).getTime() : 0;
      if (Date.now() - last > meta.REPLY_WINDOW_MS) {
        return res.status(400).json({
          ok: false,
          error: "ลูกค้าทักมาเกิน 24 ชม.แล้ว Meta ไม่อนุญาตให้ตอบ ต้องรอให้ลูกค้าทักมาใหม่",
        });
      }
      externalId = await meta.send(account.meta_page_token, convo.external_user_id, text);
    }
  } catch (err) {
    console.error("send chat error:", err);
    return res.status(502).json({ ok: false, error: `ส่งข้อความไป ${account.name} ไม่สำเร็จ` });
  }

  // Meta จะส่ง echo ของข้อความนี้กลับมาที่ webhook ด้วย — ใช้ message id เดียวกันจึงไม่บันทึกซ้ำ
  const msg = (
    await query(
      `INSERT INTO chat_messages (conversation_id, direction, message_type, text, sent_by_staff_id, external_message_id)
       VALUES ($1, 'out', 'text', $2, $3, $4)
       ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL
       DO UPDATE SET sent_by_staff_id = EXCLUDED.sent_by_staff_id
       RETURNING id, direction, message_type, text, created_at`,
      [convo.id, text, req.staff.id, externalId]
    )
  ).rows[0];
  await query("UPDATE chat_conversations SET last_message_preview = $2, last_message_at = now() WHERE id = $1", [convo.id, text]);

  res.json({ ok: true, message: { ...msg, staff_name: req.staff.name } });
});

async function sendLine(account, convo, text) {
  const tokenFresh =
    convo.reply_token && convo.reply_token_at && Date.now() - new Date(convo.reply_token_at).getTime() < REPLY_TOKEN_MAX_AGE_MS;
  if (tokenFresh) {
    // ใช้ reply token ทันที (ฟรี) — ล้างทิ้งก่อนส่ง เพราะใช้ได้ครั้งเดียว
    await query("UPDATE chat_conversations SET reply_token = NULL WHERE id = $1", [convo.id]);
    try {
      await line.reply(account.line_access_token, convo.reply_token, text);
      return;
    } catch {
      // token หมดอายุ — ไปส่งแบบ push แทน
    }
  }
  await line.push(account.line_access_token, convo.external_user_id, text);
}

module.exports = router;
