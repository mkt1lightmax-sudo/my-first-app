const crypto = require("crypto");
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { can, requirePermission } = require("../lib/permissions");

// เซลล์เห็นเฉพาะแชทที่ตัวเองดูแล + ที่ยังไม่มีคนดูแล
function canSeeConvo(staff, convo) {
  return can(staff, "chat.viewAll") || convo.assigned_staff_id === null || convo.assigned_staff_id === staff.id;
}
const NOT_YOURS = { ok: false, error: "แชทนี้มีพนักงานคนอื่นดูแลอยู่" };
const line = require("../lib/line");
const meta = require("../lib/meta");
const accountsRouter = require("./chatAccounts");
const reportsRouter = require("./chatReports");
const push = require("../lib/push");

const router = express.Router();

// จัดการบัญชี LINE OA / เพจ / IG (หลายบัญชี)
router.use("/accounts", accountsRouter);
// รายงานยอดขายจากแชท
router.use("/reports", reportsRouter);

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
    meta: line.messageMeta(event.message),
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
    meta: meta.messageMeta(message),
    externalId: message.mid,
    at: new Date(event.timestamp || Date.now()),
  });
}

// บันทึกข้อความเข้าฐานข้อมูล (ใช้ร่วมกันทุกช่องทาง) — ข้อความซ้ำจะถูกข้าม
async function recordMessage({ account, userId, getProfile, direction, type, text, meta: msgMeta = null, externalId, at, replyToken = null }) {
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
    `INSERT INTO chat_messages (conversation_id, direction, message_type, text, meta, external_message_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING RETURNING id`,
    [convo.id, direction, type, text, msgMeta ? JSON.stringify(msgMeta) : null, externalId, at]
  );
  if (!inserted.rows[0]) return; // ส่งซ้ำ หรือเป็นข้อความที่แอปเราส่งเองและบันทึกไว้แล้ว

  if (direction === "in") {
    // ลูกค้าทักมา = ยังไม่ได้ตอบ; ถ้าทิกเก็ตปิดอยู่จะเปิดขึ้นใหม่อัตโนมัติ
    const before = (await query("SELECT status FROM chat_conversations WHERE id = $1", [convo.id])).rows[0];
    await query(
      `UPDATE chat_conversations
       SET last_message_preview = $2, last_message_at = $3, last_inbound_at = $3, unread_count = unread_count + 1,
           last_message_direction = 'in', status = 'open', closed_at = NULL, closed_by_staff_id = NULL,
           ticket_seq = ticket_seq + CASE WHEN status = 'closed' THEN 1 ELSE 0 END,
           reply_token = $4, reply_token_at = CASE WHEN $4::text IS NULL THEN NULL ELSE now() END
       WHERE id = $1`,
      [convo.id, text, at, replyToken]
    );
    if (before?.status === "closed") await addSystemMessage(convo.id, "ลูกค้าทักมาใหม่ — เปิดทิกเก็ตใหม่อัตโนมัติ");
    await notifyNewMessage(convo.id, account, text);
  } else {
    await query(
      "UPDATE chat_conversations SET last_message_preview = $2, last_message_at = $3, last_message_direction = 'out' WHERE id = $1",
      [convo.id, text, at]
    );
  }
}

// แจ้งเตือนเด้งเมื่อลูกค้าทักมา:
//   มีผู้ดูแลแล้ว → แจ้งเฉพาะผู้ดูแล / ยังไม่มีผู้ดูแล → แจ้งเจ้าของ แอดมิน และเซลล์ทุกคน
// สแปมไม่แจ้งเตือน
async function notifyNewMessage(conversationId, account, text) {
  const c = (
    await query("SELECT id, display_name, assigned_staff_id, is_spam FROM chat_conversations WHERE id = $1", [conversationId])
  ).rows[0];
  if (!c || c.is_spam) return;
  const recipients = c.assigned_staff_id
    ? [c.assigned_staff_id]
    : (await query("SELECT id FROM staff WHERE is_owner OR role IN ('admin', 'sales')")).rows.map((r) => r.id);
  const preview = String(text || "").replace(/\s+/g, " ").slice(0, 120);
  await push.sendToStaff(recipients, {
    title: `💬 ${c.display_name || "ลูกค้า"} · ${account.name}`,
    body: preview || "ส่งข้อความใหม่",
    url: `/chat/${c.id}`,
    tag: `chat-${c.id}`, // ข้อความรัวๆ จากลูกค้าคนเดียวกัน แสดงเป็นแจ้งเตือนเดียว
  });
}

// ข้อความระบบในแชท เช่น "ปิดทิกเก็ตโดย ..." (แสดงตรงกลาง ลูกค้าไม่เห็น)
function addSystemMessage(conversationId, text) {
  return query("INSERT INTO chat_messages (conversation_id, direction, message_type, text) VALUES ($1, 'system', 'system', $2)", [
    conversationId,
    text,
  ]);
}

// ---------- API สำหรับหน้าแชทในแอป (ต้องล็อกอิน) ----------
const PRESET_TAGS = ["ลูกค้าใหม่", "สนใจ", "รอใบเสนอราคา", "นัดสำรวจแล้ว", "ปิดการขาย", "ไม่สนใจ"];

// staffId มาจากฐานข้อมูล (ตัวเลขเสมอ) — แปลงเป็น Number อีกชั้นกันพลาด
const convoFrom = (staffId) => `chat_conversations c
  LEFT JOIN staff s ON s.id = c.assigned_staff_id
  LEFT JOIN staff cs ON cs.id = c.closed_by_staff_id
  LEFT JOIN chat_accounts a ON a.id = c.account_id
  LEFT JOIN chat_follows f ON f.conversation_id = c.id AND f.staff_id = ${Number(staffId) || 0}
  LEFT JOIN chat_deals d ON d.conversation_id = c.id AND d.ticket_seq = c.ticket_seq`;

const CONVO_COLUMNS = `c.id, c.channel, c.account_id, a.name AS account_name, c.display_name, c.picture_url,
  c.last_message_preview, c.last_message_at, c.last_inbound_at, c.unread_count, c.last_message_direction,
  c.status, c.closed_at, cs.name AS closed_by_name, c.is_spam, (f.staff_id IS NOT NULL) AS followed,
  c.assigned_staff_id, s.name AS assigned_staff_name, c.tags,
  c.ticket_seq, d.amount::float AS deal_amount, d.outcome AS deal_outcome, d.note AS deal_note`;

function selectConvo(id, staffId) {
  return query(`SELECT ${CONVO_COLUMNS} FROM ${convoFrom(staffId)} WHERE c.id = $1`, [id]).then((r) => r.rows[0]);
}

// รายการแชท (ทิกเก็ต) — ตัวกรองทั้งหมดเป็น query string:
//   view=mine|all|closed  (ค่าเริ่มต้น all = ทิกเก็ตที่เปิดอยู่ทั้งหมด)
//   read=unread|read   replied=yes|no   sort=new|old   q=คำค้น   followed=1   spam=1
//   tag=ชื่อป้าย   account=ไอดีบัญชี   filter=unassigned
router.get("/conversations", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (!can(req.staff, "chat.viewAll")) add("(c.assigned_staff_id IS NULL OR c.assigned_staff_id = ?)", req.staff.id);

  where.push(q.spam === "1" ? "c.is_spam" : "NOT c.is_spam");
  if (q.view === "closed") where.push("c.status = 'closed'");
  else where.push("c.status = 'open'");
  if (q.view === "mine") add("c.assigned_staff_id = ?", req.staff.id);
  if (q.filter === "unassigned") where.push("c.assigned_staff_id IS NULL");
  if (q.read === "unread") where.push("c.unread_count > 0");
  if (q.read === "read") where.push("c.unread_count = 0");
  if (q.replied === "no") where.push("c.last_message_direction = 'in'");
  if (q.replied === "yes") where.push("c.last_message_direction = 'out'");
  if (q.followed === "1") where.push("f.staff_id IS NOT NULL");
  if (q.account) add("c.account_id = ?", Number(q.account));
  if (q.tag) add("? = ANY(c.tags)", String(q.tag));
  if (q.q && String(q.q).trim()) {
    // ค้นจากชื่อลูกค้า หรือข้อความในแชท
    add(
      `(c.display_name ILIKE ? OR EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id AND m.text ILIKE ?))`,
      `%${String(q.q).trim().replace(/[%_\\]/g, "\\$&")}%`
    );
  }

  const order = q.sort === "old" ? "ASC" : "DESC";
  const result = await query(
    `SELECT ${CONVO_COLUMNS} FROM ${convoFrom(req.staff.id)}
     WHERE ${where.join(" AND ")}
     ORDER BY c.last_message_at ${order} NULLS LAST LIMIT 200`,
    params
  );

  // ตัวเลขบนแท็บ: ทิกเก็ตเปิดของฉัน / ทิกเก็ตเปิดทั้งหมดที่ฉันเห็น / ยังไม่อ่าน
  const scope = can(req.staff, "chat.viewAll") ? "" : `AND (assigned_staff_id IS NULL OR assigned_staff_id = $1)`;
  const counts = (
    await query(
      `SELECT COUNT(*) FILTER (WHERE assigned_staff_id = $1)::int AS mine,
              COUNT(*)::int AS open,
              COUNT(*) FILTER (WHERE unread_count > 0)::int AS unread
       FROM chat_conversations WHERE status = 'open' AND NOT is_spam ${scope}`,
      [req.staff.id]
    )
  ).rows[0];

  res.json({ ok: true, conversations: result.rows, counts });
});

// ---------- การจัดการทิกเก็ต ----------
async function loadForAction(req, res, permission) {
  if (!can(req.staff, permission)) {
    res.status(403).json({ ok: false, error: "คุณไม่มีสิทธิ์ทำรายการนี้" });
    return null;
  }
  const convo = (await query("SELECT * FROM chat_conversations WHERE id = $1", [req.params.id])).rows[0];
  if (!convo) {
    res.status(404).json({ ok: false, error: "conversation not found" });
    return null;
  }
  if (!canSeeConvo(req.staff, convo)) {
    res.status(403).json(NOT_YOURS);
    return null;
  }
  return convo;
}

const thaiTime = () => new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

router.post("/conversations/:id/close", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.reply");
  if (!convo) return;
  if (convo.status !== "closed") {
    await query("UPDATE chat_conversations SET status = 'closed', closed_at = now(), closed_by_staff_id = $2, unread_count = 0 WHERE id = $1", [
      convo.id,
      req.staff.id,
    ]);
    await addSystemMessage(convo.id, `ปิดทิกเก็ตโดย ${req.staff.name} เมื่อ ${thaiTime()}`);
  }
  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

router.post("/conversations/:id/reopen", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.reply");
  if (!convo) return;
  if (convo.status === "closed") {
    await query("UPDATE chat_conversations SET status = 'open', closed_at = NULL, closed_by_staff_id = NULL WHERE id = $1", [convo.id]);
    await addSystemMessage(convo.id, `เปิดทิกเก็ตอีกครั้งโดย ${req.staff.name} เมื่อ ${thaiTime()}`);
  }
  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

router.post("/conversations/:id/unread", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.reply");
  if (!convo) return;
  await query("UPDATE chat_conversations SET unread_count = GREATEST(unread_count, 1) WHERE id = $1", [convo.id]);
  res.json({ ok: true });
});

// body: { spam: true|false } — สแปมจะถูกซ่อนจากรายการปกติ
router.post("/conversations/:id/spam", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.reply");
  if (!convo) return;
  const spam = req.body?.spam !== false;
  await query("UPDATE chat_conversations SET is_spam = $2, unread_count = CASE WHEN $2 THEN 0 ELSE unread_count END WHERE id = $1", [
    convo.id,
    spam,
  ]);
  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

// ยอดขายของทิกเก็ตรอบปัจจุบัน — body: { amount: number|null, outcome: "won"|"lost"|null, note?: string }
// ยอดจะนับให้ "ผู้ดูแลแชท" ตอนบันทึก (ถ้ายังไม่มีผู้ดูแล นับให้คนที่บันทึก)
router.put("/conversations/:id/deal", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.reply");
  if (!convo) return;
  const body = req.body || {};

  let amount = body.amount;
  if (amount === "" || amount === undefined) amount = null;
  if (amount !== null) {
    amount = Number(amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999) {
      return res.status(400).json({ ok: false, error: "ยอดขายต้องเป็นตัวเลข 0 ขึ้นไป" });
    }
    amount = Math.round(amount * 100) / 100;
  }
  const outcome = body.outcome === "won" || body.outcome === "lost" ? body.outcome : null;
  if (body.outcome && !outcome) return res.status(400).json({ ok: false, error: "สถานะการปิดการขายไม่ถูกต้อง" });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  const creditTo = convo.assigned_staff_id || req.staff.id;

  await query(
    `INSERT INTO chat_deals (conversation_id, ticket_seq, amount, outcome, note, staff_id, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (conversation_id, ticket_seq)
     DO UPDATE SET amount = EXCLUDED.amount, outcome = EXCLUDED.outcome, note = EXCLUDED.note,
                   staff_id = EXCLUDED.staff_id, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [convo.id, convo.ticket_seq, amount, outcome, note, creditTo, req.staff.id]
  );

  const label = outcome === "won" ? "ปิดการขายได้" : outcome === "lost" ? "ปิดการขายไม่ได้" : "ยังไม่สรุป";
  const money = amount !== null ? ` ยอด ${amount.toLocaleString("th-TH")} บาท` : "";
  await addSystemMessage(convo.id, `${req.staff.name} บันทึก: ${label}${money}`);

  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

// body: { follow: true|false } — ติดตามของแต่ละคน (ดูเท่านั้นก็ติดตามได้)
router.post("/conversations/:id/follow", requireAuth, async (req, res) => {
  const convo = await loadForAction(req, res, "chat.view");
  if (!convo) return;
  if (req.body?.follow === false) {
    await query("DELETE FROM chat_follows WHERE staff_id = $1 AND conversation_id = $2", [req.staff.id, convo.id]);
  } else {
    await query("INSERT INTO chat_follows (staff_id, conversation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [req.staff.id, convo.id]);
  }
  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

// จำนวนแชทที่ยังไม่อ่าน (ที่ฉันเห็น) — ใช้แสดงตัวเลขแดงที่แท็บ "แชท" ทุกหน้า
// latest = เวลาข้อความลูกค้าล่าสุด ใช้ตัดสินว่าจะเล่นเสียงเตือนไหม
router.get("/unread-count", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const params = [];
  let scope = "";
  if (!can(req.staff, "chat.viewAll")) {
    params.push(req.staff.id);
    scope = "AND (assigned_staff_id IS NULL OR assigned_staff_id = $1)";
  }
  const r = (
    await query(
      `SELECT COUNT(*) FILTER (WHERE unread_count > 0)::int AS unread, MAX(last_inbound_at) AS latest
       FROM chat_conversations WHERE status = 'open' AND NOT is_spam ${scope}`,
      params
    )
  ).rows[0];
  res.json({ ok: true, unread: r.unread, latest: r.latest });
});

// ป้ายทั้งหมด (ป้ายตั้งต้น + ป้ายที่ทีมสร้างเอง)
router.get("/tags", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const result = await query("SELECT DISTINCT unnest(tags) AS tag FROM chat_conversations");
  const used = result.rows.map((r) => r.tag);
  res.json({ ok: true, tags: [...new Set([...PRESET_TAGS, ...used])] });
});

// เปลี่ยนผู้ดูแล และ/หรือ ป้ายกลุ่ม — body: { assigned_staff_id?: number|null, tags?: string[] }
router.patch("/conversations/:id", requireAuth, requirePermission("chat.reply"), async (req, res) => {
  const convo = (await query("SELECT * FROM chat_conversations WHERE id = $1", [req.params.id])).rows[0];
  if (!convo) return res.status(404).json({ ok: false, error: "conversation not found" });
  if (!canSeeConvo(req.staff, convo)) return res.status(403).json(NOT_YOURS);

  let assigned = convo.assigned_staff_id;
  if (req.body && "assigned_staff_id" in req.body) {
    assigned = req.body.assigned_staff_id === null ? null : Number(req.body.assigned_staff_id);
    // เซลล์รับเรื่องเอง หรือปล่อยเรื่องได้ แต่มอบหมายให้คนอื่นไม่ได้
    if (assigned !== null && assigned !== req.staff.id && !can(req.staff, "chat.assignOthers")) {
      return res.status(403).json({ ok: false, error: "คุณมอบหมายแชทให้คนอื่นไม่ได้ — รับเรื่องเองได้เท่านั้น" });
    }
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
    await push.sendToStaff([assigned], {
      title: "📌 ได้รับมอบหมายแชท",
      body: `${req.staff.name} มอบหมายให้คุณดูแล ${convo.display_name || "ลูกค้า"}`,
      url: `/chat/${convo.id}`,
      tag: `chat-${convo.id}`,
    });
  }

  res.json({ ok: true, conversation: await selectConvo(convo.id, req.staff.id) });
});

router.get("/conversations/:id/messages", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const convo = await selectConvo(req.params.id, req.staff.id);
  if (!convo) return res.status(404).json({ ok: false, error: "conversation not found" });
  if (!canSeeConvo(req.staff, convo)) return res.status(403).json(NOT_YOURS);

  const messages = await query(
    `SELECT m.id, m.direction, m.message_type, m.text, m.meta, m.created_at, s.name AS staff_name
     FROM chat_messages m LEFT JOIN staff s ON s.id = m.sent_by_staff_id
     WHERE m.conversation_id = $1 ORDER BY m.created_at ASC, m.id ASC LIMIT 500`,
    [convo.id]
  );
  await query("UPDATE chat_conversations SET unread_count = 0 WHERE id = $1 AND unread_count > 0", [convo.id]);
  res.json({ ok: true, conversation: convo, messages: messages.rows });
});

// รูป / วิดีโอ / เสียง / ไฟล์ ที่ลูกค้าส่งมา — ดึงจาก LINE หรือ Meta ผ่านเซิร์ฟเวอร์เรา (ต้องล็อกอินและมีสิทธิ์เห็นแชทนั้น)
// หน้าเว็บใช้ <img src="/api/chat/messages/:id/content"> ได้เลย เพราะ cookie ล็อกอินส่งไปด้วยอัตโนมัติ
const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);
router.get("/messages/:id/content", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const msg = (
    await query(
      `SELECT m.message_type, m.external_message_id, m.meta, c.assigned_staff_id, c.account_id
       FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE m.id = $1`,
      [req.params.id]
    )
  ).rows[0];
  if (!msg || !MEDIA_TYPES.has(msg.message_type)) return res.status(404).json({ ok: false, error: "media not found" });
  if (!canSeeConvo(req.staff, msg)) return res.status(403).json(NOT_YOURS);

  const account = msg.account_id ? await getAccount(msg.account_id) : null;
  let upstream;
  try {
    if (msg.meta?.externalUrl || msg.meta?.url) {
      upstream = await fetch(msg.meta.externalUrl || msg.meta.url);
      if (!upstream.ok) throw Object.assign(new Error("upstream"), { status: upstream.status });
    } else if (account?.channel === "line" && msg.external_message_id) {
      upstream = await line.getContent(account.line_access_token, msg.external_message_id);
    } else {
      return res.status(404).json({ ok: false, error: "media not found" });
    }
  } catch (err) {
    // LINE เก็บไฟล์ไว้ให้ระยะหนึ่ง; ลิงก์ของ Meta ก็หมดอายุได้
    const gone = err.status === 404 || err.status === 410 || err.status === 403;
    return res.status(gone ? 410 : 502).json({ ok: false, error: gone ? "ไฟล์หมดอายุแล้ว" : "ดึงไฟล์ไม่สำเร็จ" });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  res.set("Cache-Control", "private, max-age=604800"); // เบราว์เซอร์เก็บไว้ 7 วัน ไม่ต้องดึงซ้ำ
  if (msg.message_type === "file" && msg.meta?.fileName) {
    res.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(msg.meta.fileName)}`);
  }
  res.send(buf);
});

// ส่งข้อความตอบลูกค้า — ส่งออกทางบัญชีเดียวกับที่ลูกค้าทักเข้ามา
// เช็กร่วมกันก่อนส่งทุกแบบ (ข้อความ/รูป): สิทธิ์, ทิกเก็ตเปิดอยู่, บัญชียังใช้ได้, กฎ 24 ชม. ของ Meta
// คืน { convo, account } หรือ null (ตอบ error ไปแล้ว)
async function loadForSend(req, res) {
  const convo = (await query("SELECT * FROM chat_conversations WHERE id = $1", [req.params.id])).rows[0];
  if (!convo) return void res.status(404).json({ ok: false, error: "conversation not found" });
  if (!canSeeConvo(req.staff, convo)) return void res.status(403).json(NOT_YOURS);
  if (convo.status === "closed") {
    return void res.status(400).json({ ok: false, error: "ทิกเก็ตนี้ปิดแล้ว — กด \"เปิดอีกครั้ง\" ก่อนตอบ" });
  }
  const account = convo.account_id ? await getAccount(convo.account_id) : null;
  if (!account || !account.is_active) {
    return void res.status(400).json({ ok: false, error: "บัญชีของแชทนี้ถูกลบหรือปิดใช้งานแล้ว ตอบกลับไม่ได้" });
  }
  if (account.channel !== "line") {
    const last = convo.last_inbound_at ? new Date(convo.last_inbound_at).getTime() : 0;
    if (Date.now() - last > meta.REPLY_WINDOW_MS) {
      return void res.status(400).json({ ok: false, error: "ลูกค้าทักมาเกิน 24 ชม.แล้ว Meta ไม่อนุญาตให้ตอบ ต้องรอให้ลูกค้าทักมาใหม่" });
    }
  }
  return { convo, account };
}

// บันทึกข้อความขาออก — Meta จะส่ง echo กลับมาที่ webhook ด้วย ใช้ message id เดียวกันจึงไม่บันทึกซ้ำ
async function saveOutgoing({ convo, staff, type, text, msgMeta = null, externalId = null }) {
  const msg = (
    await query(
      `INSERT INTO chat_messages (conversation_id, direction, message_type, text, meta, sent_by_staff_id, external_message_id)
       VALUES ($1, 'out', $2, $3, $4, $5, $6)
       ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL
       DO UPDATE SET sent_by_staff_id = EXCLUDED.sent_by_staff_id, meta = COALESCE(EXCLUDED.meta, chat_messages.meta)
       RETURNING id, direction, message_type, text, meta, created_at`,
      [convo.id, type, text, msgMeta ? JSON.stringify(msgMeta) : null, staff.id, externalId]
    )
  ).rows[0];
  await query(
    "UPDATE chat_conversations SET last_message_preview = $2, last_message_at = now(), last_message_direction = 'out' WHERE id = $1",
    [convo.id, text]
  );
  return { ...msg, staff_name: staff.name };
}

router.post("/conversations/:id/messages", requireAuth, requirePermission("chat.reply"), async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "text is required" });
  if (text.length > 2000) return res.status(400).json({ ok: false, error: "ข้อความยาวเกิน 2000 ตัวอักษร" });

  const ctx = await loadForSend(req, res);
  if (!ctx) return;
  const { convo, account } = ctx;

  let externalId = null;
  try {
    if (account.channel === "line") await sendLine(account, convo, text);
    else externalId = await meta.send(account.meta_page_token, convo.external_user_id, text);
  } catch (err) {
    console.error("send chat error:", err);
    return res.status(502).json({ ok: false, error: `ส่งข้อความไป ${account.name} ไม่สำเร็จ` });
  }

  res.json({ ok: true, message: await saveOutgoing({ convo, staff: req.staff, type: "text", text, externalId }) });
});

// ส่งรูปให้ลูกค้า — body: { data: "<base64>", contentType: "image/jpeg" | "image/png" }
// หน้าเว็บย่อรูปก่อนส่งแล้ว; เก็บรูปไว้ที่เรา แล้วให้ LINE / Meta ดึงผ่านลิงก์สุ่ม /api/chat/media/<token>
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
router.post("/conversations/:id/images", requireAuth, requirePermission("chat.reply"), async (req, res) => {
  const contentType = req.body?.contentType;
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    return res.status(400).json({ ok: false, error: "รองรับเฉพาะรูป JPG หรือ PNG" });
  }
  const bytes = Buffer.from(String(req.body?.data || ""), "base64");
  if (!bytes.length) return res.status(400).json({ ok: false, error: "ไม่พบรูป" });
  if (bytes.length > MAX_IMAGE_BYTES) return res.status(400).json({ ok: false, error: "รูปใหญ่เกิน 3MB" });
  // ตรวจว่าเป็นรูปจริงตามที่บอก (ดูจากหัวไฟล์)
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes.subarray(0, 4).toString("hex") === "89504e47";
  if ((contentType === "image/jpeg" && !isJpeg) || (contentType === "image/png" && !isPng)) {
    return res.status(400).json({ ok: false, error: "ไฟล์ไม่ใช่รูปที่ถูกต้อง" });
  }

  const ctx = await loadForSend(req, res);
  if (!ctx) return;
  const { convo, account } = ctx;

  const token = crypto.randomBytes(24).toString("hex");
  await query(
    "INSERT INTO chat_media (token, conversation_id, content_type, bytes, size, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)",
    [token, convo.id, contentType, bytes, bytes.length, req.staff.id]
  );
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const url = `${proto}://${req.get("x-forwarded-host") || req.get("host")}/api/chat/media/${token}`;

  let externalId = null;
  try {
    if (account.channel === "line") await sendLine(account, convo, line.imageMessage(url));
    else externalId = await meta.sendImage(account.meta_page_token, convo.external_user_id, url);
  } catch (err) {
    console.error("send image error:", err);
    await query("DELETE FROM chat_media WHERE token = $1", [token]);
    return res.status(502).json({ ok: false, error: `ส่งรูปไป ${account.name} ไม่สำเร็จ` });
  }

  const message = await saveOutgoing({ convo, staff: req.staff, type: "image", text: "[รูปภาพ]", msgMeta: { mediaToken: token }, externalId });
  res.json({ ok: true, message });
});

// ลิงก์รูปที่เราส่งให้ลูกค้า — เปิดได้โดยไม่ต้องล็อกอิน เพราะ LINE / Meta ต้องดึงรูปจากที่นี่
// ปลอดภัยด้วยรหัสสุ่ม 48 ตัวที่เดาไม่ได้
router.get("/media/:token", async (req, res) => {
  if (!/^[a-f0-9]{48}$/.test(req.params.token)) return res.status(404).end();
  const m = (await query("SELECT content_type, bytes FROM chat_media WHERE token = $1", [req.params.token])).rows[0];
  if (!m) return res.status(404).end();
  res.set("Content-Type", m.content_type);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(m.bytes);
});

// message: ข้อความตัวอักษร (string) หรือข้อความแบบอื่นของ LINE (เช่น รูป)
async function sendLine(account, convo, message) {
  const tokenFresh =
    convo.reply_token && convo.reply_token_at && Date.now() - new Date(convo.reply_token_at).getTime() < REPLY_TOKEN_MAX_AGE_MS;
  if (tokenFresh) {
    // ใช้ reply token ทันที (ฟรี) — ล้างทิ้งก่อนส่ง เพราะใช้ได้ครั้งเดียว
    await query("UPDATE chat_conversations SET reply_token = NULL WHERE id = $1", [convo.id]);
    try {
      await line.reply(account.line_access_token, convo.reply_token, message);
      return;
    } catch {
      // token หมดอายุ — ไปส่งแบบ push แทน
    }
  }
  await line.push(account.line_access_token, convo.external_user_id, message);
}

module.exports = router;
