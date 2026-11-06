import { lookup } from "node:dns/promises";
import nextEnv from "@next/env";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL?.trim();
let stage = "configuration";
let client;
let configuredDatabaseLogin = null;
const applicationTables = [
  "users",
  "citizens",
  "personal_access_tokens",
  "reports",
  "notifications",
  "system_settings",
];

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
  configuredDatabaseLogin = decodeURIComponent(parsedUrl.username);

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
  const identityResult = await client.query(`
    SELECT current_user::TEXT AS current_user,
           session_user::TEXT AS session_user,
           current_database() AS current_database,
           has_schema_privilege(current_user, 'public', 'CREATE') AS public_schema_create,
           has_schema_privilege(current_user, 'public', 'USAGE') AS public_schema_usage
  `);

  const tablesResult = await client.query(`
    WITH expected(table_name) AS (
      VALUES ${applicationTables.map((_, index) => `($${index + 1})`).join(", ")}
    ), actual AS (
      SELECT table_name,
             to_regclass(format('public.%I', table_name)) AS relation_oid
      FROM expected
    )
    SELECT table_name,
           relation_oid IS NOT NULL AS table_exists,
           CASE WHEN relation_oid IS NOT NULL THEN has_table_privilege(current_user, relation_oid, 'SELECT') END AS can_select,
           CASE WHEN relation_oid IS NOT NULL THEN has_table_privilege(current_user, relation_oid, 'INSERT') END AS can_insert,
           CASE WHEN relation_oid IS NOT NULL THEN has_table_privilege(current_user, relation_oid, 'UPDATE') END AS can_update,
           CASE WHEN relation_oid IS NOT NULL THEN has_table_privilege(current_user, relation_oid, 'DELETE') END AS can_delete
    FROM actual
    ORDER BY table_name
  `, applicationTables);

  const sequencesResult = await client.query(`
    WITH expected(table_name) AS (
      VALUES ${applicationTables.map((_, index) => `($${index + 1})`).join(", ")}
    ), actual AS (
      SELECT table_name,
             CASE WHEN to_regclass(format('public.%I', table_name)) IS NOT NULL
               THEN pg_get_serial_sequence(format('public.%I', table_name), 'id')
             END AS sequence_name
      FROM expected
    )
    SELECT table_name,
           sequence_name,
           CASE WHEN sequence_name IS NOT NULL THEN has_sequence_privilege(current_user, sequence_name, 'USAGE') END AS can_use,
           CASE WHEN sequence_name IS NOT NULL THEN has_sequence_privilege(current_user, sequence_name, 'SELECT') END AS can_select
    FROM actual
    WHERE sequence_name IS NOT NULL
    ORDER BY table_name
  `, applicationTables);

  const ddlResult = await client.query(`
    WITH expected(table_name) AS (
      VALUES ${applicationTables.map((_, index) => `($${index + 1})`).join(", ")}
    ), trigger_function AS (
      SELECT proc.oid AS function_oid,
             proc.proowner AS function_owner
      FROM (SELECT to_regprocedure('public.set_updated_at()') AS function_oid) AS found_function
      LEFT JOIN pg_catalog.pg_proc AS proc ON proc.oid = found_function.function_oid
    )
    SELECT expected.table_name,
           pg_get_userbyid(table_owner.relowner) AS table_owner,
           CASE WHEN table_owner.oid IS NOT NULL
             THEN pg_has_role(current_user, table_owner.relowner, 'USAGE')
           END AS can_create_index,
           CASE WHEN table_owner.oid IS NOT NULL
             THEN has_table_privilege(current_user, table_owner.oid, 'TRIGGER')
                  AND trigger_function.function_oid IS NOT NULL
                  AND has_function_privilege(current_user, trigger_function.function_oid, 'EXECUTE')
           END AS can_create_trigger,
           has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_tables,
           has_schema_privilege(current_user, 'public', 'CREATE')
             AND (trigger_function.function_oid IS NULL
                  OR pg_has_role(current_user, trigger_function.function_owner, 'USAGE'))
             AS can_create_or_replace_trigger_function
    FROM expected
    LEFT JOIN pg_catalog.pg_class AS table_owner
      ON table_owner.relnamespace = 'public'::regnamespace
     AND table_owner.relname = expected.table_name
     AND table_owner.relkind IN ('r', 'p')
    CROSS JOIN trigger_function
    ORDER BY expected.table_name
  `, applicationTables);

  console.log("Database privilege inspection completed using read-only queries.", {
    configuredDatabaseLogin,
    identity: identityResult.rows[0],
    tablePrivileges: tablesResult.rows,
    sequencePrivileges: sequencesResult.rows,
    ddlCapabilities: ddlResult.rows,
    ddlChecksAreCatalogBased: true,
  });
} catch (error) {
  console.error("Database connectivity check failed.", {
    stage,
    configuredDatabaseLogin,
    ...safeErrorDetails(error),
  });
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => undefined);
}