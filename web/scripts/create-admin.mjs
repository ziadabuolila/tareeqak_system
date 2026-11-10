import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { mysqlConfigFromEnv } from "./mysql-connection.mjs";

nextEnv.loadEnvConfig(process.cwd());
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

let database;
try {
  database = await mysql.createConnection(mysqlConfigFromEnv());
  const [existing] = await database.execute("SELECT id FROM users WHERE email=? OR phone=? LIMIT 1", [email, phone]);
  if (existing.length) throw new Error("An account already uses this email address or phone number.");
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await database.execute(
    "INSERT INTO users (name,phone,email,password,role,status) VALUES (?,?,?,?,'admin','active')",
    [name, phone, email, passwordHash],
  );
  console.log(`Admin account created with id ${result.insertId} for ${email}.`);
} catch (error) {
  if (error && typeof error === "object" && error.code === "ER_DUP_ENTRY") {
    console.error("An account already uses this email address or phone number.");
  } else {
    console.error(error instanceof Error ? error.message : "Unable to create the admin account.");
  }
  process.exitCode = 1;
} finally {
  await database?.end().catch(() => undefined);
}
