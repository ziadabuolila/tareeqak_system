import { lookup } from "node:dns/promises";
import nextEnv from "@next/env";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL?.trim();
let stage = "configuration";
let client;

function safeErrorDetails(error) {
  const name = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "UnknownError";
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "UNKNOWN";

  return {
    name: /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : "Error",
    code: /^[A-Z0-9_]{1,64}$/.test(code) ? code : "UNKNOWN",
  };
}

try {
  if (!connectionString) {
    throw Object.assign(new Error("DATABASE_URL is not configured."), {
      code: "CONFIG_DATABASE_URL_MISSING",
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw Object.assign(new Error("DATABASE_URL is not a valid URL."), {
      code: "CONFIG_DATABASE_URL_INVALID",
    });
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw Object.assign(new Error("DATABASE_URL must point to a PostgreSQL host."), {
      code: "CONFIG_DATABASE_URL_INVALID",
    });
  }

  stage = "DNS resolution";
  await lookup(parsedUrl.hostname);

  client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  stage = "PostgreSQL connection";
  await client.connect();

  stage = "read-only query";
  const result = await client.query("SELECT 1 AS ok");
  if (result.rows[0]?.ok !== 1) {
    throw Object.assign(new Error("Database read-only check returned an unexpected result."), {
      code: "DATABASE_CHECK_UNEXPECTED_RESULT",
    });
  }

  console.log("Database connectivity check passed.", {
    stages: ["configuration", "DNS resolution", "PostgreSQL connection", "read-only query"],
  });
} catch (error) {
  console.error("Database connectivity check failed.", {
    stage,
    ...safeErrorDetails(error),
  });
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => undefined);
}