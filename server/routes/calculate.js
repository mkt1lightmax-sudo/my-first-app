const express = require("express");
const { compareSystemOptions } = require("../lib/solarCalculator");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// คำนวณเทียบระบบ On-Grid vs Hybrid+Battery แบบ standalone ไม่บันทึกลงฐานข้อมูล
// ใช้กับหน้าคำนวณระบบ และ preview สดตอนกรอกฟอร์มสำรวจ (ฝั่งฟอร์มจะเลือกเฉพาะ scenario ที่แนะนำมาโชว์)
router.post("/", requireAuth, (req, res) => {
  try {
    const result = compareSystemOptions(req.body);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
