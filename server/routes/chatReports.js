// รายงานยอดขายจากแชท — เจ้าของ/แอดมิน/ดูเท่านั้น เห็นทุกคน, เซลล์เห็นเฉพาะของตัวเอง
const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { can, requirePermission } = require("../lib/permissions");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// วันที่ปัจจุบันตามเวลาไทย เป็น YYYY-MM-DD
function bangkokDate(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

// GET /api/chat/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD (ไม่ใส่ = ตั้งแต่ต้นเดือนนี้ถึงวันนี้)
router.get("/sales", requireAuth, requirePermission("reports.view"), async (req, res) => {
  const today = bangkokDate();
  const from = DATE_RE.test(String(req.query.from)) ? String(req.query.from) : today.slice(0, 8) + "01";
  const to = DATE_RE.test(String(req.query.to)) ? String(req.query.to) : today;
  if (from > to) return res.status(400).json({ ok: false, error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" });

  const params = [from, to];
  let scope = "";
  if (!can(req.staff, "reports.viewAll")) {
    params.push(req.staff.id);
    scope = `AND d.staff_id = $${params.length}`;
  }
  const inRange = `(d.updated_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date ${scope}`;

  const [summary, byStaff, recent] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(d.amount) FILTER (WHERE d.outcome = 'won'), 0)::float AS won_amount,
              COUNT(*) FILTER (WHERE d.outcome = 'won')::int  AS won_count,
              COUNT(*) FILTER (WHERE d.outcome = 'lost')::int AS lost_count,
              COUNT(*) FILTER (WHERE d.outcome IS NULL)::int  AS pending_count,
              COALESCE(SUM(d.amount) FILTER (WHERE d.outcome IS NULL), 0)::float AS pending_amount
       FROM chat_deals d WHERE ${inRange}`,
      params
    ),
    query(
      `SELECT d.staff_id, COALESCE(s.name, 'ไม่ระบุ') AS staff_name,
              COALESCE(SUM(d.amount) FILTER (WHERE d.outcome = 'won'), 0)::float AS won_amount,
              COUNT(*) FILTER (WHERE d.outcome = 'won')::int  AS won_count,
              COUNT(*) FILTER (WHERE d.outcome = 'lost')::int AS lost_count,
              COUNT(*) FILTER (WHERE d.outcome IS NULL)::int  AS pending_count
       FROM chat_deals d LEFT JOIN staff s ON s.id = d.staff_id
       WHERE ${inRange}
       GROUP BY d.staff_id, s.name
       ORDER BY won_amount DESC, won_count DESC`,
      params
    ),
    query(
      `SELECT d.id, d.conversation_id, d.ticket_seq, d.amount::float AS amount, d.outcome, d.note, d.updated_at,
              c.display_name AS customer_name, c.channel, COALESCE(s.name, 'ไม่ระบุ') AS staff_name
       FROM chat_deals d
       JOIN chat_conversations c ON c.id = d.conversation_id
       LEFT JOIN staff s ON s.id = d.staff_id
       WHERE ${inRange}
       ORDER BY d.updated_at DESC LIMIT 30`,
      params
    ),
  ]);

  const s = summary.rows[0];
  const decided = s.won_count + s.lost_count;
  res.json({
    ok: true,
    from,
    to,
    scope: can(req.staff, "reports.viewAll") ? "all" : "mine",
    summary: { ...s, win_rate: decided ? Math.round((s.won_count / decided) * 100) : null },
    by_staff: byStaff.rows,
    recent: recent.rows,
  });
});

module.exports = router;
