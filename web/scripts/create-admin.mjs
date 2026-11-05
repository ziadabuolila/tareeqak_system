import nextEnv from "@next/env";
import { Client } from "pg";
import bcrypt from "bcryptjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
const name = process.env.TAREEQAK_ADMIN_NAME?.trim();
const email = process.env.TAREEQAK_ADMIN_EMAIL?.trim().toLowerCase();
const phone = process.env.TAREEQAK_ADMIN_PHONE?.trim();
const password = process.env.TAREEQAK_ADMIN_PASSWORD;

if (!connectionString) {
  console.error("Set DATABASE_URL to the Supabase PostgreSQL connection string before running this command.");
  process.exit(1);
}
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

const database = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await database.connect();
  const existing = await database.query(
    "SELECT id FROM public.users WHERE email = $1 OR phone = $2 LIMIT 1",
    [email, phone],
  );
  if (existing.rowCount) {
    throw new Error("An account already uses this email address or phone number.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await database.query(
    `INSERT INTO public.users (name, phone, email, password, role, status)
     VALUES ($1, $2, $3, $4, 'admin', 'active')
     RETURNING id`,
    [name, phone, email, passwordHash],
  );
  console.log(`Admin account created with id ${result.rows[0].id} for ${email}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to create the admin account.");
  process.exitCode = 1;
} finally {
  await database.end().catch(() => undefined);
}
