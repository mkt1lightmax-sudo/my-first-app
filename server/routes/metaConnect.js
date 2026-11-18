// "เชื่อมเพจด้วย Facebook" — เจ้าของล็อกอิน Facebook แล้วเลือกเพจ ระบบเก็บ token ให้เอง (ไม่มีใครเห็น token)
//
// ขั้นตอน:
//   1. GET  /api/chat/accounts/meta/connect          → พาไปหน้าอนุญาตของ Facebook
//   2. GET  /api/chat/accounts/meta/callback         → Facebook ส่งกลับมา: เอา token ของทุกเพจ เก็บไว้ชั่วคราว (10 นาที)
//                                                       แล้วพากลับไปหน้า "บัญชีแชท" ให้เลือกเพจ
//   3. GET  /api/chat/accounts/meta/pending/:id      → รายชื่อเพจให้เลือก (ไม่มี token)
//   4. POST /api/chat/accounts/meta/pending/:id      → เพิ่ม/อัปเดตเพจที่เลือก + สมัครรับข้อความให้อัตโนมัติ
//
// ต้องตั้งค่า: META_APP_ID + META_APP_SECRET ใน env และใส่ลิงก์ callback ใน Meta App (Facebook Login → Valid OAuth Redirect URIs)
const crypto = require("crypto");
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { requireOwner } = require("../lib/permissions");
const meta = require("../lib/meta");

const router = express.Router();

const STATE_COOKIE = "meta_oauth_state";
const PENDING_TTL_MS = 10 * 60 * 1000;

function origin(req) {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${req.get("x-forwarded-host") || req.get("host")}`;
}
const callbackUrl = (req) => `${origin(req)}/api/chat/accounts/meta/callback`;
const backToApp = (req, query) => `${origin(req)}/chat/accounts?${new URLSearchParams(query)}`;

function appConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

// ลิงก์ callback ที่ต้องนำไปใส่ใน Meta App (หน้าแอปแสดงให้คัดลอก)
router.get("/info", requireAuth, requireOwner, (req, res) => {
  res.json({ ok: true, ready: Boolean(appConfig()), redirectUri: callbackUrl(req) });
});

router.get("/connect", requireAuth, requireOwner, (req, res) => {
  const cfg = appConfig();
  if (!cfg) return res.redirect(backToApp(req, { connect_error: "ยังไม่ได้ตั้งค่า META_APP_ID ใน Vercel" }));
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.secure || req.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    maxAge: PENDING_TTL_MS,
  });
  res.redirect(meta.oauthDialogUrl({ appId: cfg.appId, redirectUri: callbackUrl(req), state }));
});

router.get("/callback", requireAuth, requireOwner, async (req, res) => {
  const expected = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);
  if (req.query.error) {
    return res.redirect(backToApp(req, { connect_error: "ยกเลิกการเชื่อมกับ Facebook แล้ว" }));
  }
  // กันคนอื่นปลอมลิงก์ callback มาให้กด
  if (!expected || typeof req.query.state !== "string" || req.query.state !== expected || typeof req.query.code !== "string") {
    return res.redirect(backToApp(req, { connect_error: "ลิงก์หมดอายุหรือไม่ถูกต้อง — กดเชื่อมใหม่อีกครั้ง" }));
  }
  const cfg = appConfig();
  if (!cfg) return res.redirect(backToApp(req, { connect_error: "ยังไม่ได้ตั้งค่า META_APP_ID ใน Vercel" }));

  let pages;
  try {
    pages = await meta.pagesFromOAuthCode({ ...cfg, redirectUri: callbackUrl(req), code: req.query.code });
  } catch (err) {
    console.error("meta oauth failed:", err.metaError?.message || err.message);
    const reason = err.metaError?.message ? ` (Meta: ${String(err.metaError.message).slice(0, 160)})` : "";
    return res.redirect(backToApp(req, { connect_error: `เชื่อมกับ Facebook ไม่สำเร็จ${reason}` }));
  }
  if (!pages.length) {
    return res.redirect(backToApp(req, { connect_error: "ไม่พบเพจที่คุณดูแล — ตอนอนุญาตต้องเลือกเพจด้วย" }));
  }

  // เก็บ token ไว้ฝั่งเซิร์ฟเวอร์ชั่วคราว ระหว่างให้เจ้าของเลือกเพจ (หน้าเว็บไม่เห็น token)
  const id = crypto.randomBytes(16).toString("hex");
  await query("DELETE FROM app_settings WHERE key LIKE 'meta_connect:%' AND updated_at < now() - interval '10 minutes'");
  await query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
    `meta_connect:${id}`,
    JSON.stringify({ staffId: req.staff.id, pages }),
  ]);
  res.redirect(backToApp(req, { connect: id }));
});

async function loadPending(req, res) {
  if (!/^[a-f0-9]{32}$/.test(req.params.id)) return void res.status(404).json({ ok: false, error: "not found" });
  const row = (
    await query(
      "SELECT value FROM app_settings WHERE key = $1 AND updated_at > now() - interval '10 minutes'",
      [`meta_connect:${req.params.id}`]
    )
  ).rows[0];
  if (!row || row.value.staffId !== req.staff.id) {
    return void res.status(404).json({ ok: false, error: "หมดเวลาแล้ว — กดเชื่อมกับ Facebook ใหม่อีกครั้ง" });
  }
  return row.value.pages;
}

// รายชื่อเพจ + IG ที่ผูกอยู่ ให้เลือก (ไม่มี token)
router.get("/pending/:id", requireAuth, requireOwner, async (req, res) => {
  const pages = await loadPending(req, res);
  if (!pages) return;
  const existing = (await query("SELECT channel, meta_page_id, meta_ig_id FROM chat_accounts WHERE channel IN ('messenger', 'instagram')")).rows;
  res.json({
    ok: true,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      added: existing.some((a) => a.channel === "messenger" && a.meta_page_id === p.id),
      instagram: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username || null,
            added: existing.some((a) => a.channel === "instagram" && a.meta_ig_id === p.instagram_business_account.id),
          }
        : null,
    })),
  });
});

// body: { messenger: [pageId...], instagram: [pageId...] } — เพิ่มใหม่ หรืออัปเดต token ของที่มีอยู่แล้ว
router.post("/pending/:id", requireAuth, requireOwner, async (req, res) => {
  const pages = await loadPending(req, res);
  if (!pages) return;
  const wantFb = new Set(Array.isArray(req.body?.messenger) ? req.body.messenger.map(String) : []);
  const wantIg = new Set(Array.isArray(req.body?.instagram) ? req.body.instagram.map(String) : []);
  if (!wantFb.size && !wantIg.size) return res.status(400).json({ ok: false, error: "เลือกอย่างน้อย 1 เพจ" });

  const results = [];
  for (const p of pages) {
    const doFb = wantFb.has(p.id);
    const ig = p.instagram_business_account;
    const doIg = wantIg.has(p.id) && ig?.id;
    if (!doFb && !doIg) continue;

    const subErr = await meta.subscribePage(p.access_token, p.id);
    if (doFb) {
      await upsertMetaAccount({ channel: "messenger", name: p.name, pageId: p.id, igId: null, token: p.access_token });
      results.push({ name: p.name, channel: "messenger", warning: subErr });
    }
    if (doIg) {
      await upsertMetaAccount({
        channel: "instagram",
        name: `IG @${ig.username || ig.id}`,
        pageId: p.id,
        igId: ig.id,
        token: p.access_token,
      });
      results.push({ name: `IG @${ig.username || ig.id}`, channel: "instagram", warning: subErr });
    }
  }
  await query("DELETE FROM app_settings WHERE key = $1", [`meta_connect:${req.params.id}`]);
  res.json({ ok: true, results });
});

// เพิ่มบัญชีใหม่ หรืออัปเดต token + เปิดใช้งานบัญชีเดิม (ไม่เปลี่ยนชื่อที่ทีมตั้งไว้)
async function upsertMetaAccount({ channel, name, pageId, igId, token }) {
  const existing = (
    await query(
      channel === "instagram"
        ? "SELECT id FROM chat_accounts WHERE channel = 'instagram' AND meta_ig_id = $1"
        : "SELECT id FROM chat_accounts WHERE channel = 'messenger' AND meta_page_id = $1",
      [channel === "instagram" ? igId : pageId]
    )
  ).rows[0];
  if (existing) {
    await query("UPDATE chat_accounts SET meta_page_token = $2, meta_page_id = $3, is_active = true WHERE id = $1", [existing.id, token, pageId]);
  } else {
    await query(
      "INSERT INTO chat_accounts (channel, name, meta_page_id, meta_ig_id, meta_page_token) VALUES ($1, $2, $3, $4, $5)",
      [channel, name, pageId, igId, token]
    );
  }
}

module.exports = router;
