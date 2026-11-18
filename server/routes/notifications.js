const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT id, type, message, appointment_id, chat_conversation_id, is_read, created_at
     FROM notifications WHERE staff_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [req.staff.id]
  );
  const unread = await query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE staff_id = $1 AND is_read = false",
    [req.staff.id]
  );
  res.json({ ok: true, notifications: result.rows, unreadCount: unread.rows[0].count });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const result = await query(
    "UPDATE notifications SET is_read = true WHERE id = $1 AND staff_id = $2 RETURNING id",
    [req.params.id, req.staff.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: "notification not found" });
  }
  res.json({ ok: true });
});

router.patch("/read-all", requireAuth, async (req, res) => {
  await query("UPDATE notifications SET is_read = true WHERE staff_id = $1 AND is_read = false", [req.staff.id]);
  res.json({ ok: true });
});

module.exports = router;
