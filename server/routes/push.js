// เปิด/ปิดรับแจ้งเตือนเด้งของเครื่องนี้
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const push = require("../lib/push");

const router = express.Router();

router.get("/public-key", requireAuth, async (req, res) => {
  const keys = await push.getVapidKeys();
  res.json({ ok: true, publicKey: keys.publicKey });
});

// body: { subscription: PushSubscription.toJSON() }
router.post("/subscribe", requireAuth, async (req, res) => {
  const sub = req.body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || typeof p256dh !== "string" || typeof auth !== "string") {
    return res.status(400).json({ ok: false, error: "ข้อมูลการรับแจ้งเตือนไม่ถูกต้อง" });
  }
  // เครื่องเดียวกันเปลี่ยนคนล็อกอิน → ย้ายให้คนปัจจุบัน
  await query(
    `INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET staff_id = EXCLUDED.staff_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                                          user_agent = EXCLUDED.user_agent, created_at = now()`,
    [req.staff.id, endpoint, p256dh, auth, String(req.get("user-agent") || "").slice(0, 300)]
  );
  await push.rememberSubject(req.get("origin"));
  res.json({ ok: true });
});

router.post("/unsubscribe", requireAuth, async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint === "string") {
    await query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND staff_id = $2", [endpoint, req.staff.id]);
  }
  res.json({ ok: true });
});

// ส่งแจ้งเตือนทดสอบหาตัวเอง
router.post("/test", requireAuth, async (req, res) => {
  const result = await push.sendToStaff([req.staff.id], {
    title: "LIGHTMAX SOLAR",
    body: "ทดสอบแจ้งเตือน — ถ้าเห็นข้อความนี้แปลว่าใช้ได้แล้ว ✓",
    url: "/chat",
    tag: "test",
  });
  if (!result.sent) return res.status(400).json({ ok: false, error: "ไม่พบเครื่องที่เปิดรับแจ้งเตือน หรือส่งไม่สำเร็จ" });
  res.json({ ok: true, sent: result.sent });
});

module.exports = router;
