// สคริปต์สำหรับสร้างพนักงานคนแรก (admin) รันครั้งเดียวตอน setup
// วิธีใช้: DATABASE_URL=... node api/db/seedStaff.js "ชื่อ" "email@company.com" "รหัสผ่าน" "admin"

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./pool");

async function main() {
  const [name, email, password, role = "admin"] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('วิธีใช้: node api/db/seedStaff.js "ชื่อ" "email@company.com" "รหัสผ่าน" [role]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO staff (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id, name, email, role`,
    [name, email, passwordHash, role]
  );

  console.log("สร้าง/อัปเดตพนักงานสำเร็จ:", result.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err);
  process.exit(1);
});
