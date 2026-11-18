// ตัวช่วยคุยกับ Meta (Facebook Messenger + Instagram) ผ่าน Graph API
// ใช้ Meta App ตัวเดียว (META_APP_SECRET) แต่แต่ละเพจ/IG มี Page access token ของตัวเอง (เก็บใน chat_accounts)
const crypto = require("crypto");

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v24.0"}`;

// Meta อนุญาตให้ตอบได้ภายใน 24 ชม. หลังลูกค้าทักมาล่าสุด
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

// ตรวจว่าข้อความที่ webhook ได้รับมาจาก Meta จริง
function verifySignature(rawBody, header) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header || !rawBody || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function graphFetch(token, path, options = {}) {
  if (!token) throw new Error("Page access token is missing for this account");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Meta API ${res.status}: ${data?.error?.message || ""}`);
    err.status = res.status;
    err.metaError = data?.error;
    throw err;
  }
  return data;
}

// ดึงชื่อ + รูปลูกค้า — Messenger กับ IG ใช้ชื่อฟิลด์ต่างกัน
async function getProfile(token, channel, userId) {
  try {
    if (channel === "instagram") {
      const p = await graphFetch(token, `/${encodeURIComponent(userId)}?fields=name,username,profile_pic`);
      return { displayName: p.name || (p.username ? `@${p.username}` : null), pictureUrl: p.profile_pic || null };
    }
    const p = await graphFetch(token, `/${encodeURIComponent(userId)}?fields=first_name,last_name,profile_pic`);
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return { displayName: name || null, pictureUrl: p.profile_pic || null };
  } catch {
    return null; // บางบัญชีไม่อนุญาตให้ดึงโปรไฟล์ — ไม่เป็นไร
  }
}

// ส่งข้อความตอบลูกค้า (ใช้ได้ทั้ง Messenger และ IG) — คืนค่า message_id ของ Meta
async function send(token, userId, text) {
  const data = await graphFetch(token, "/me/messages", {
    method: "POST",
    body: JSON.stringify({ recipient: { id: userId }, messaging_type: "RESPONSE", message: { text } }),
  });
  return data.message_id || null;
}

// ส่งรูปให้ลูกค้า (Messenger / IG) — Meta ดึงรูปจากลิงก์ https สาธารณะเอง
async function sendImage(token, userId, url) {
  const data = await graphFetch(token, "/me/messages", {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: userId },
      messaging_type: "RESPONSE",
      message: { attachment: { type: "image", payload: { url, is_reusable: false } } },
    }),
  });
  return data.message_id || null;
}

// ใช้ตอนแอดมินเพิ่มบัญชี — เช็กว่า token ใช้ได้ และหาไอดีเพจ (+ IG ที่ผูกอยู่ เฉพาะตอนเพิ่ม IG)
// ขอข้อมูล IG แยกต่างหาก เพราะ token ของเพจที่ได้จากหน้า Messenger มักไม่มีสิทธิ์ IG
// ถ้าขอรวมกัน Meta จะปฏิเสธทั้งคำขอ ทั้งที่ token ใช้กับ Messenger ได้ปกติ
async function getPageInfo(token, { withInstagram = false } = {}) {
  const page = await graphFetch(token, "/me?fields=id,name");
  if (withInstagram) {
    const ig = await graphFetch(token, `/${page.id}?fields=instagram_business_account{id,username}`);
    page.instagram_business_account = ig.instagram_business_account || null;
  }
  return page;
}

const ATTACHMENT_LABELS = {
  image: "[รูปภาพ]",
  video: "[วิดีโอ]",
  audio: "[ข้อความเสียง]",
  file: "[ไฟล์]",
  location: "[ตำแหน่งที่ตั้ง]",
  sticker: "[สติกเกอร์]",
  story_mention: "[แท็กในสตอรี่]",
  share: "[แชร์โพสต์]",
  ig_reel: "[แชร์รีล]",
};

function messageToText(message) {
  if (message.text) return message.text;
  const att = message.attachments?.[0];
  if (att) return ATTACHMENT_LABELS[att.type] || `[${att.type}]`;
  return "[ข้อความ]";
}

// ลิงก์ไฟล์แนบของ Meta (รูป/วิดีโอ/สติกเกอร์) — ลิงก์อาจหมดอายุหลังผ่านไประยะหนึ่ง
function messageMeta(message) {
  const att = message.attachments?.[0];
  if (!att) return null;
  return { url: att.payload?.url || null, stickerId: att.payload?.sticker_id || null, title: att.payload?.title || null };
}

// ให้แอปเรารับข้อความของเพจนี้ (webhook) — คืน null ถ้าสำเร็จ หรือข้อความ error
async function subscribePage(token, pageId) {
  try {
    await graphFetch(token, `/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=messages,message_echoes`, { method: "POST" });
    return null;
  } catch (err) {
    return err.metaError?.message || err.message;
  }
}

// ---------- เชื่อมด้วย Facebook (OAuth) — ไม่ต้องคัดลอก token เอง ----------
const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_manage_messages",
];

function oauthDialogUrl({ appId, redirectUri, state }) {
  const u = new URL(`https://www.facebook.com/${process.env.META_GRAPH_VERSION || "v24.0"}/dialog/oauth`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", OAUTH_SCOPES.join(","));
  return u.toString();
}

async function graphGet(path, params) {
  const u = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Meta API ${res.status}: ${data?.error?.message || ""}`);
    err.metaError = data?.error;
    throw err;
  }
  return data;
}

// code → user token (อายุยาว) → รายชื่อเพจพร้อม Page token (Page token ที่ได้จาก user token อายุยาวจะไม่หมดอายุ)
async function pagesFromOAuthCode({ appId, appSecret, redirectUri, code }) {
  const short = await graphGet("/oauth/access_token", { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
  const long = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short.access_token,
  });
  const pages = [];
  let next = `/me/accounts`;
  let params = { access_token: long.access_token, fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100" };
  for (let i = 0; i < 5 && next; i++) {
    const d = await graphGet(next, params);
    for (const p of d.data || []) pages.push(p);
    next = d.paging?.next ? new URL(d.paging.next).pathname.replace(/^\/v[\d.]+/, "") : null;
    params = d.paging?.cursors?.after ? { ...params, after: d.paging.cursors.after } : params;
  }
  return pages;
}

module.exports = {
  verifySignature,
  getProfile,
  send,
  sendImage,
  getPageInfo,
  subscribePage,
  oauthDialogUrl,
  pagesFromOAuthCode,
  messageToText,
  messageMeta,
  REPLY_WINDOW_MS,
};
