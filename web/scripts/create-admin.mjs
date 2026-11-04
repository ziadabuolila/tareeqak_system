import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());
const name = process.env.TAREEQAK_ADMIN_NAME?.trim();
const email = process.env.TAREEQAK_ADMIN_EMAIL?.trim().toLowerCase();
const phone = process.env.TAREEQAK_ADMIN_PHONE?.trim();
const password = process.env.TAREEQAK_ADMIN_PASSWORD;

if (!name || !email || !phone || !password) {
  console.error("Set TAREEQAK_ADMIN_NAME, TAREEQAK_ADMIN_EMAIL, TAREEQAK_ADMIN_PHONE, and TAREEQAK_ADMIN_PASSWORD before running this command.");
  process.exit(1);
}
if (!/^01[0125]\d{8}$/.test(phone)) {
  console.error("TAREEQAK_ADMIN_PHONE must be an Egyptian mobile number.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("TAREEQAK_ADMIN_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}

const database = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "tareeqak_system",
});
const [existing] = await database.execute("SELECT 1 FROM users WHERE email = ? OR phone = ? LIMIT 1", [email, phone]);
if (existing.length) {
  console.error("An account already uses this email address or phone number.");
  await database.end();
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
await database.execute(`
  INSERT INTO users (name, phone, email, password, role)
  VALUES (?, ?, ?, ?, 'admin')
`, [name, phone, email, passwordHash]);
await database.end();
console.log(`Admin account created for ${email}.`);
