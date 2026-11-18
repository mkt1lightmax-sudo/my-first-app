// ตั้งรหัสผ่านใหม่ให้พนักงาน (ใช้ตอนลืมรหัส) — รหัสที่พิมพ์จะไม่แสดงบนจอ
// วิธีใช้: node server/db/resetPassword.js email@company.com
require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const { pool } = require("./pool");

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.stdout.write("\nยกเลิกแล้ว\n");
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("วิธีใช้: node server/db/resetPassword.js email@company.com");
    process.exit(1);
  }

  const staff = (await pool.query("SELECT id, name FROM staff WHERE email = $1", [email])).rows[0];
  if (!staff) {
    console.error(`ไม่พบพนักงานที่ใช้อีเมล ${email}`);
    console.error("อีเมลที่มีในระบบ:", (await pool.query("SELECT email FROM staff ORDER BY id")).rows.map((r) => r.email).join(", "));
    await pool.end();
    process.exit(1);
  }

  const pw1 = await askHidden(`รหัสผ่านใหม่ของ ${staff.name} (อย่างน้อย 8 ตัว): `);
  if (pw1.length < 8) {
    console.error("รหัสสั้นเกินไป — ต้องอย่างน้อย 8 ตัวอักษร");
    await pool.end();
    process.exit(1);
  }
  const pw2 = await askHidden("พิมพ์รหัสผ่านใหม่อีกครั้ง: ");
  if (pw1 !== pw2) {
    console.error("รหัสทั้งสองครั้งไม่ตรงกัน — ลองใหม่");
    await pool.end();
    process.exit(1);
  }

  await pool.query("UPDATE staff SET password_hash = $2 WHERE id = $1", [staff.id, await bcrypt.hash(pw1, 10)]);
  console.log(`ตั้งรหัสผ่านใหม่ให้ ${staff.name} เรียบร้อย — ล็อกอินด้วยรหัสใหม่ได้เลย`);
  await pool.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
