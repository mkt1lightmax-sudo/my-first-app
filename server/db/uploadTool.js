// อัปโหลด/อัปเดตไฟล์เครื่องมือ HTML เข้าฐานข้อมูล (ไม่เก็บใน GitHub เพราะมีราคาแพ็กเกจ)
// วิธีใช้: node server/db/uploadTool.js presentation "/path/to/lightmax-solar-hourly-infographic.html"
require("dotenv").config({ quiet: true });
const fs = require("fs");
const { pool } = require("./pool");

async function main() {
  const [name, file] = process.argv.slice(2);
  if (!name || !file) throw new Error('วิธีใช้: node server/db/uploadTool.js <ชื่อ> "<ไฟล์.html>"');
  const content = fs.readFileSync(file, "utf8");
  await pool.query(
    `INSERT INTO app_files (name, content) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [name, content]
  );
  console.log(`อัปโหลด ${name} แล้ว (${Math.round(content.length / 1024)} KB)`);
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
