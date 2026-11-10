import { Pool, type PoolClient, type QueryResult } from "pg";

export type RowDataPacket = Record<string, unknown>;
export type ResultSetHeader = {
  insertId?: number | string | null;
  rowCount?: number;
  affectedRows?: number;
};

type DatabaseGlobal = typeof globalThis & {
  tareeqakPgPool?: Pool;
};

type SqlValue = string | number | boolean | Date | Buffer | Uint8Array | null | undefined;

type DatabaseWithConnection = Pool & {
  getConnection: () => Promise<PoolClient & {
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    execute: <T extends RowDataPacket = RowDataPacket>(sql: string, values?: SqlValue[]) => Promise<QueryResult<T>>;
  }>;
};

const globalDatabase = globalThis as DatabaseGlobal;

const normalizeSql = (sql: string, values: SqlValue[] = []) => {
  let index = 0;
  let finalSql = "";
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === "?" && sql[i + 1] !== "?") {
      index += 1;
      finalSql += `$${index}`;
      continue;
    }
    if (char === "?" && sql[i + 1] === "?") {
      finalSql += "?";
      i += 1;
      continue;
    }
    finalSql += char;
  }
  return { text: finalSql, values };
};

const connectionString = process.env.DATABASE_URL?.trim() || undefined;

export const database = (globalDatabase.tareeqakPgPool ?? new Pool({
  connectionString,
  host: connectionString ? undefined : (process.env.DB_HOST ?? "127.0.0.1"),
  port: connectionString ? undefined : Number(process.env.DB_PORT ?? 5432),
  user: connectionString ? undefined : (process.env.DB_USER ?? "postgres"),
  password: connectionString ? undefined : (process.env.DB_PASSWORD ?? ""),
  database: connectionString ? undefined : (process.env.DB_NAME ?? "tareeqak_system"),
  ssl: connectionString ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
})) as DatabaseWithConnection;

globalDatabase.tareeqakPgPool = database;

database.getConnection = async () => {
  const client = await database.connect();
  const extendedClient = client as PoolClient & {
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    execute: <T extends RowDataPacket = RowDataPacket>(sql: string, values?: SqlValue[]) => Promise<QueryResult<T>>;
  };
  extendedClient.beginTransaction = async () => { await client.query("BEGIN"); };
  extendedClient.commit = async () => { await client.query("COMMIT"); };
  extendedClient.rollback = async () => { await client.query("ROLLBACK"); };
  extendedClient.execute = async <T extends RowDataPacket = RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<QueryResult<T>> => {
    const { text, values: normalizedValues } = normalizeSql(sql, values);
    return client.query<T>(text, normalizedValues);
  };
  return extendedClient;
};

export async function rows<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T[]> {
  await assertDatabaseConfigured();
  const { text, values: normalizedValues } = normalizeSql(sql, values);
  const result = await database.query<T>(text, normalizedValues);
  return result.rows as T[];
}

export async function row<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, values))[0];
}

export async function execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
  await assertDatabaseConfigured();
  const { text, values: normalizedValues } = normalizeSql(sql, values);
  const result = await database.query(text, normalizedValues);

  let insertId: number | string | null | undefined;
  if (result.command === "INSERT" && result.rows?.[0] && typeof result.rows[0] === "object" && "id" in result.rows[0]) {
    insertId = (result.rows[0].id as number | string | null | undefined) ?? null;
  }

  return {
    insertId: insertId ?? null,
    rowCount: Number(result.rowCount ?? 0),
    affectedRows: Number(result.rowCount ?? 0),
  };
}

export function isDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  return code === "23505" || code === "ER_DUP_ENTRY";
}

export async function assertDatabaseConfigured(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !connectionString) {
    throw Object.assign(new Error("DATABASE_URL is required in production."), {
      code: "CONFIG_DATABASE_URL_MISSING",
    });
  }
  if (connectionString) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(connectionString);
    } catch {
      throw Object.assign(new Error("DATABASE_URL must be a valid PostgreSQL connection URL."), {
        code: "CONFIG_DATABASE_URL_INVALID",
      });
    }
    if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
      throw Object.assign(new Error("DATABASE_URL must point to a PostgreSQL host."), {
        code: "CONFIG_DATABASE_URL_INVALID",
      });
    }
  }
}
