// ส่งแจ้งเตือนเด้ง (Web Push) ไปยังมือถือ/คอมของพนักงาน
// กุญแจ VAPID: ใช้จาก env ถ้าตั้งไว้ ไม่งั้นระบบสร้างเองครั้งแรกแล้วเก็บในตาราง app_settings
const webpush = require("web-push");
const { query } = require("../db/pool");

let cachedKeys = null;

async function getVapidKeys() {
  if (cachedKeys) return cachedKeys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cachedKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cachedKeys;
  }
  let row = (await query("SELECT value FROM app_settings WHERE key = 'vapid'")).rows[0];
  if (!row) {
    const generated = webpush.generateVAPIDKeys();
    // ถ้ามีอีกเครื่องสร้างพร้อมกัน ใช้ของที่บันทึกก่อน
    await query("INSERT INTO app_settings (key, value) VALUES ('vapid', $1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(generated)]);
    row = (await query("SELECT value FROM app_settings WHERE key = 'vapid'")).rows[0];
  }
  cachedKeys = row.value;
  return cachedKeys;
}

// subject ต้องเป็น https:// หรือ mailto: — ใช้ที่อยู่เว็บของแอปที่บันทึกไว้ตอนมีคนเปิดรับแจ้งเตือน
async function getSubject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const row = (await query("SELECT value FROM app_settings WHERE key = 'push_subject'")).rows[0];
  return row?.value || "https://vercel.app";
}

async function rememberSubject(origin) {
  if (!origin || !/^https:\/\//.test(origin)) return;
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('push_subject', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(origin)]
  );
}

/**
 * ส่งแจ้งเตือนถึงพนักงานตามรายชื่อ — ไม่โยน error (แจ้งเตือนพลาดต้องไม่ทำให้ระบบหลักพัง)
 * payload: { title, body, url, tag }
 */
async function sendToStaff(staffIds, payload) {
  const ids = [...new Set(staffIds.filter(Boolean))];
  if (!ids.length) return { sent: 0 };
  try {
    const subs = (await query("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE staff_id = ANY($1)", [ids])).rows;
    if (!subs.length) return { sent: 0 };

    const keys = await getVapidKeys();
    const options = {
      vapidDetails: { subject: await getSubject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 60 * 60, // ถ้าเครื่องปิดอยู่ เก็บแจ้งเตือนไว้ส่งภายใน 1 ชม.
      timeout: 5000,
      urgency: "high",
    };
    const body = JSON.stringify(payload);

    let sent = 0;
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, options);
          sent++;
          await query("UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1", [s.id]);
        } catch (err) {
          // 404/410 = เครื่องนั้นยกเลิกรับแจ้งเตือนแล้ว → ลบทิ้ง
          if (err.statusCode === 404 || err.statusCode === 410) {
            await query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
          } else {
            console.error("push send error:", err.statusCode || err.message);
          }
        }
      })
    );
    return { sent };
  } catch (err) {
    console.error("push error:", err.message);
    return { sent: 0 };
  }
}

module.exports = { getVapidKeys, rememberSubject, sendToStaff };
