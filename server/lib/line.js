// ตัวช่วยคุยกับ LINE Messaging API — แต่ละ OA มี secret/token ของตัวเอง (เก็บในตาราง chat_accounts)
const crypto = require("crypto");

const API = "https://api.line.me/v2/bot";

// ตรวจว่าข้อความที่ส่งมาที่ webhook มาจาก LINE จริง (กันคนอื่นปลอมข้อความ)
function verifySignature(secret, rawBody, signature) {
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function lineFetch(token, path, options = {}) {
  if (!token) throw new Error("LINE access token is missing for this account");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`LINE API ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

async function getProfile(token, userId) {
  try {
    const p = await lineFetch(token, `/profile/${encodeURIComponent(userId)}`);
    return { displayName: p.displayName || null, pictureUrl: p.pictureUrl || null };
  } catch {
    return null; // ลูกค้าบล็อก OA หรือดึงโปรไฟล์ไม่ได้ — ไม่เป็นไร
  }
}

// ตอบด้วย reply token (ฟรี ไม่นับโควต้า) — ใช้ได้ครั้งเดียวและต้องใช้ภายในเวลาสั้นๆ
function reply(token, replyToken, text) {
  return lineFetch(token, "/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

// ส่งข้อความหาลูกค้าเมื่อไหร่ก็ได้ — นับโควต้าข้อความรายเดือนของ OA
function push(token, userId, text) {
  return lineFetch(token, "/message/push", {
    method: "POST",
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  });
}

// ใช้ตอนแอดมินเพิ่มบัญชี — เช็กว่า token ใช้ได้ และเอาชื่อ OA มาแสดง
function getBotInfo(token) {
  return lineFetch(token, "/info");
}

const TYPE_LABELS = {
  image: "[รูปภาพ]",
  video: "[วิดีโอ]",
  audio: "[ข้อความเสียง]",
  file: "[ไฟล์]",
  location: "[ตำแหน่งที่ตั้ง]",
  sticker: "[สติกเกอร์]",
};

function messageToText(message) {
  if (message.type === "text") return message.text;
  if (message.type === "location") return `[ตำแหน่ง] ${message.address || message.title || ""}`.trim();
  if (message.type === "file") return `[ไฟล์] ${message.fileName || ""}`.trim();
  return TYPE_LABELS[message.type] || `[${message.type}]`;
}

module.exports = { verifySignature, getProfile, reply, push, getBotInfo, messageToText };
