// จัดการบัญชีแชท: LINE OA / เพจ Facebook / Instagram — เพิ่มได้ไม่จำกัด
// คีย์ลับ (secret / token) เก็บในฐานข้อมูลเท่านั้น ไม่ส่งกลับไปที่หน้าเว็บ
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { requirePermission, requireOwner } = require("../lib/permissions");
const line = require("../lib/line");
const meta = require("../lib/meta");

const router = express.Router();

const PUBLIC_COLUMNS = `id, channel, name, is_active, meta_page_id, meta_ig_id, created_at,
  (line_access_token IS NOT NULL OR meta_page_token IS NOT NULL) AS has_token`;

function withWebhook(account) {
  return {
    ...account,
    webhook_path: account.channel === "line" ? `/api/chat/line/webhook/${account.id}` : "/api/chat/meta/webhook",
  };
}

// ทุกคนที่ล็อกอินดูรายชื่อบัญชีได้ (ใช้กรองแชท) — ไม่มีคีย์ลับ
router.get("/", requireAuth, requirePermission("chat.view"), async (req, res) => {
  const result = await query(`SELECT ${PUBLIC_COLUMNS} FROM chat_accounts ORDER BY channel, id`);
  res.json({ ok: true, accounts: result.rows.map(withWebhook) });
});

// เพิ่มบัญชี — เจ้าของเท่านั้น
// LINE:      { channel: "line", name?, line_channel_secret, line_access_token }
// Messenger: { channel: "messenger", name?, meta_page_token }
// Instagram: { channel: "instagram", name?, meta_page_token }  (token ของเพจที่ผูกกับ IG)
router.post("/", requireAuth, requireOwner, async (req, res) => {
  const body = req.body || {};
  const channel = body.channel;
  const trim = (v) => (typeof v === "string" ? v.trim() : "");
  let name = trim(body.name);

  if (channel === "line") {
    const secret = trim(body.line_channel_secret);
    const token = trim(body.line_access_token);
    if (!secret || !token) return res.status(400).json({ ok: false, error: "กรุณาใส่ Channel secret และ Channel access token" });

    let info;
    try {
      info = await line.getBotInfo(token);
    } catch {
      return res.status(400).json({ ok: false, error: "Channel access token ไม่ถูกต้อง — ตรวจสอบแล้วลองใหม่" });
    }
    name = name || info.displayName || "LINE OA";
    const created = await query(
      `INSERT INTO chat_accounts (channel, name, line_channel_secret, line_access_token) VALUES ('line', $1, $2, $3)
       RETURNING ${PUBLIC_COLUMNS}`,
      [name, secret, token]
    );
    return res.status(201).json({ ok: true, account: withWebhook(created.rows[0]) });
  }

  if (channel === "messenger" || channel === "instagram") {
    const token = trim(body.meta_page_token);
    if (!token) return res.status(400).json({ ok: false, error: "กรุณาใส่ Page access token" });

    let page;
    try {
      page = await meta.getPageInfo(token, { withInstagram: channel === "instagram" });
    } catch (err) {
      // แสดงเหตุผลจาก Meta ด้วย (ไม่มี token อยู่ในข้อความ) จะได้รู้ว่าติดอะไร
      const reason = err.metaError?.message ? ` (Meta: ${String(err.metaError.message).slice(0, 200)})` : "";
      console.error("meta page token check failed:", err.metaError?.code, err.metaError?.message);
      return res.status(400).json({ ok: false, error: `Page access token ใช้ไม่ได้${reason}` });
    }
    if (!page?.id) return res.status(400).json({ ok: false, error: "token นี้ไม่ใช่ token ของเพจ" });
    const ig = page.instagram_business_account;
    if (channel === "instagram" && !ig?.id) {
      return res.status(400).json({ ok: false, error: `เพจ "${page.name}" ยังไม่ได้ผูกกับบัญชี Instagram ธุรกิจ` });
    }

    // สมัครรับข้อความของเพจนี้เข้าแอปเราอัตโนมัติ
    let warning = null;
    try {
      await fetch(
        `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v24.0"}/${page.id}/subscribed_apps?subscribed_fields=messages,message_echoes&access_token=${encodeURIComponent(token)}`,
        { method: "POST" }
      ).then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
      });
    } catch (err) {
      console.error("meta subscribed_apps failed:", err.message);
      warning = "เพิ่มบัญชีแล้ว แต่สมัครรับข้อความของเพจอัตโนมัติไม่สำเร็จ — อาจต้องตั้งค่า Webhook ในหน้า Meta App เอง";
    }

    name = name || (channel === "instagram" ? `IG @${ig.username || ig.id}` : page.name);
    try {
      const created = await query(
        `INSERT INTO chat_accounts (channel, name, meta_page_id, meta_ig_id, meta_page_token) VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PUBLIC_COLUMNS}`,
        [channel, name, page.id, channel === "instagram" ? ig.id : null, token]
      );
      return res.status(201).json({ ok: true, account: withWebhook(created.rows[0]), warning });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ ok: false, error: "บัญชีนี้ถูกเพิ่มไว้แล้ว" });
      throw err;
    }
  }

  res.status(400).json({ ok: false, error: "channel ต้องเป็น line, messenger หรือ instagram" });
});

// เปลี่ยนชื่อ / เปิด-ปิดบัญชี / เปลี่ยน token — เจ้าของเท่านั้น
router.patch("/:id", requireAuth, requireOwner, async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const params = [req.params.id];
  const set = (col, value) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (typeof body.name === "string" && body.name.trim()) set("name", body.name.trim().slice(0, 60));
  if (typeof body.is_active === "boolean") set("is_active", body.is_active);
  if (typeof body.line_channel_secret === "string" && body.line_channel_secret.trim()) set("line_channel_secret", body.line_channel_secret.trim());
  if (typeof body.line_access_token === "string" && body.line_access_token.trim()) set("line_access_token", body.line_access_token.trim());
  if (typeof body.meta_page_token === "string" && body.meta_page_token.trim()) set("meta_page_token", body.meta_page_token.trim());
  if (!sets.length) return res.status(400).json({ ok: false, error: "ไม่มีข้อมูลที่จะแก้ไข" });

  const result = await query(`UPDATE chat_accounts SET ${sets.join(", ")} WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`, params);
  if (!result.rows[0]) return res.status(404).json({ ok: false, error: "account not found" });
  res.json({ ok: true, account: withWebhook(result.rows[0]) });
});

// ลบบัญชี — แชทเก่ายังอยู่ แต่จะตอบกลับไม่ได้แล้ว
router.delete("/:id", requireAuth, requireOwner, async (req, res) => {
  const result = await query("DELETE FROM chat_accounts WHERE id = $1 RETURNING id", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ ok: false, error: "account not found" });
  res.json({ ok: true });
});

module.exports = router;
