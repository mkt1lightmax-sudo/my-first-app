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

// ใช้ตอนแอดมินเพิ่มบัญชี — เช็กว่า token ใช้ได้ และหาไอดีเพจ + IG ที่ผูกอยู่
function getPageInfo(token) {
  return graphFetch(token, "/me?fields=id,name,instagram_business_account{id,username}");
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

module.exports = { verifySignature, getProfile, send, getPageInfo, messageToText, messageMeta, REPLY_WINDOW_MS };
