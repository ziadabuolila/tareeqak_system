import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import { mysqlConfigFromEnv } from "./mysql-connection.mjs";

nextEnv.loadEnvConfig(process.cwd());
const requiredTables = [
  "users", "citizens", "personal_access_tokens", "citizen_login_requests",
  "citizen_devices", "reports", "notifications", "system_settings", "citizen_catalog",
];
let database;

try {
  database = await mysql.createConnection({ ...mysqlConfigFromEnv(), connectTimeout: 10000 });
  const [[identity]] = await database.query("SELECT CURRENT_USER() AS database_user, DATABASE() AS database_name");
  const [tableRows] = await database.query("SHOW TABLES");
  const foundTables = new Set(tableRows.map((table) => Object.values(table)[0]));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));
  console.log("MySQL connection successful.", { ...identity, missingTables });
  if (missingTables.length) {
    console.error("Import web/mysql-schema.sql in phpMyAdmin to create the missing application tables.");
    process.exitCode = 1;
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
  console.error("MySQL connectivity check failed.", {
    code,
    message: error instanceof Error ? error.message : "Unknown database error.",
  });
  process.exitCode = 1;
} finally {
  await database?.end().catch(() => undefined);
}
