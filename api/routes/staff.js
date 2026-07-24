const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, role FROM staff ORDER BY name");
  res.json({ ok: true, staff: result.rows });
});

module.exports = router;
