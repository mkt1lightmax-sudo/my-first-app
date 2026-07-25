// รันไฟล์ .sql กับฐานข้อมูลที่ตั้งไว้ใน DATABASE_URL — ใช้ตอน setup ครั้งแรก หรือหลังแก้ schema
// วิธีใช้: node api/db/migrate.js [ชื่อไฟล์.sql]  (ไม่ระบุ = ใช้ schema.sql)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./pool");

async function main() {
  const fileName = process.argv[2] || "schema.sql";
  const sql = fs.readFileSync(path.join(__dirname, fileName), "utf8");
  await pool.query(sql);
  console.log(`รันไฟล์ ${fileName} สำเร็จ`);
  await pool.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาดตอนรัน migrate:", err.message);
  process.exit(1);
});
