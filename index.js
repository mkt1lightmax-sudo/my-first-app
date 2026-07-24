// จุดเริ่มสำหรับรัน API บนเครื่องตัวเอง (local dev) — `npm start`
// Vercel ใช้ api/index.js แยกต่างหาก แต่ทั้งคู่ใช้ Express app เดียวกันจาก api/app.js
require("dotenv").config();
const app = require("./api/app");

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("API running on port", port);
});
