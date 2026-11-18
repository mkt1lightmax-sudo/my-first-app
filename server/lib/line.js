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

// message: ข้อความเดียว (string = ข้อความตัวอักษร หรือ object ตามรูปแบบของ LINE เช่น รูปภาพ)
const toLineMessage = (m) => (typeof m === "string" ? { type: "text", text: m } : m);

// ตอบด้วย reply token (ฟรี ไม่นับโควต้า) — ใช้ได้ครั้งเดียวและต้องใช้ภายในเวลาสั้นๆ
function reply(token, replyToken, message) {
  return lineFetch(token, "/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages: [toLineMessage(message)] }),
  });
}

// ส่งข้อความหาลูกค้าเมื่อไหร่ก็ได้ — นับโควต้าข้อความรายเดือนของ OA
function push(token, userId, message) {
  return lineFetch(token, "/message/push", {
    method: "POST",
    body: JSON.stringify({ to: userId, messages: [toLineMessage(message)] }),
  });
}

// ข้อความรูปภาพ — LINE จะดึงรูปจากลิงก์ https สาธารณะเอง
function imageMessage(url) {
  return { type: "image", originalContentUrl: url, previewImageUrl: url };
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

// ข้อมูลเสริมที่ต้องใช้แสดงผล (สติกเกอร์ / ไฟล์ / แผนที่ / รูปจากลิงก์ภายนอก)
function messageMeta(message) {
  switch (message.type) {
    case "sticker":
      return { stickerId: message.stickerId, packageId: message.packageId, resourceType: message.stickerResourceType };
    case "file":
      return { fileName: message.fileName, fileSize: message.fileSize };
    case "location":
      return { latitude: message.latitude, longitude: message.longitude, address: message.address, title: message.title };
    case "image":
    case "video":
    case "audio":
      // ส่วนใหญ่ไฟล์อยู่ที่ LINE (ดึงผ่าน getContent); บางครั้งเป็นลิงก์ภายนอก
      return message.contentProvider?.type === "external"
        ? { externalUrl: message.contentProvider.originalContentUrl, previewUrl: message.contentProvider.previewImageUrl }
        : { duration: message.duration };
    default:
      return null;
  }
}

// ดาวน์โหลดรูป/วิดีโอ/ไฟล์ที่ลูกค้าส่งมา (LINE เก็บไว้ให้ระยะหนึ่งเท่านั้น)
async function getContent(token, messageId) {
  if (!token) throw new Error("LINE access token is missing for this account");
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`LINE content ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

function messageToText(message) {
  if (message.type === "text") return message.text;
  if (message.type === "location") return `[ตำแหน่ง] ${message.address || message.title || ""}`.trim();
  if (message.type === "file") return `[ไฟล์] ${message.fileName || ""}`.trim();
  return TYPE_LABELS[message.type] || `[${message.type}]`;
}

module.exports = { verifySignature, getProfile, reply, push, imageMessage, getBotInfo, messageToText, messageMeta, getContent };
