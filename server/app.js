const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRouter = require("./routes/auth");
const staffRouter = require("./routes/staff");
const surveysRouter = require("./routes/surveys");
const calculateRouter = require("./routes/calculate");
const appointmentsRouter = require("./routes/appointments");
const notificationsRouter = require("./routes/notifications");
const chatRouter = require("./routes/chat");
const pushRouter = require("./routes/push");

const app = express();

app.use(cors({ origin: true, credentials: true }));
// เก็บ body ดิบไว้ด้วย — LINE webhook ต้องใช้ตรวจลายเซ็น
// limit 4.5mb: พอสำหรับรูปที่แนบในแชท (ย่อแล้ว ≤3MB, base64 ใหญ่ขึ้น ~33%) — Vercel รับได้สูงสุด 4.5MB ต่อคำขอ
app.use(express.json({ limit: "4.5mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "my-ads-assistant-api" });
});

app.post("/api/ask", (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "prompt is required" });
  }

  // ตอนนี้ยังไม่ต่อ AI — แค่ echo กลับเพื่อเทสระบบ
  res.json({ ok: true, reply: `รับแล้ว: ${prompt}` });
});

app.use("/api/auth", authRouter);
app.use("/api/staff", staffRouter);
app.use("/api/surveys", surveysRouter);
app.use("/api/calculate", calculateRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/push", pushRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "internal server error" });
});

module.exports = app;
