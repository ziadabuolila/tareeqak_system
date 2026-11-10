import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

export type RowDataPacket = Record<string, unknown>;
export type ResultSetHeader = {
  insertId?: number | string | null;
  rowCount?: number;
  affectedRows?: number;
};
export type QueryResult<T = RowDataPacket> = {
  rows: T[];
  rowCount: number;
  insertId?: number;
};

type SqlValue = string | number | boolean | Date | Buffer | Uint8Array | null | undefined;
type Connection = {
  query: <T extends RowDataPacket = RowDataPacket>(sql: string, values?: SqlValue[]) => Promise<QueryResult<T>>;
  execute: <T extends RowDataPacket = RowDataPacket>(sql: string, values?: SqlValue[]) => Promise<QueryResult<T>>;
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
};

type DatabaseGlobal = typeof globalThis & { tareeqakMysqlPool?: Pool };
const globalDatabase = globalThis as DatabaseGlobal;
const connectionString = process.env.DATABASE_URL?.trim();

function mysqlConfig() {
  if (connectionString) {
    let url: URL;
    try {
      url = new URL(connectionString);
    } catch {
      throw Object.assign(new Error("DATABASE_URL must be a valid MySQL connection URL."), { code: "CONFIG_DATABASE_URL_INVALID" });
    }
    if (!["mysql:", "mariadb:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
      throw Object.assign(new Error("DATABASE_URL must use mysql:// or mariadb:// and include a database name."), { code: "CONFIG_DATABASE_URL_INVALID" });
    }
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: url.searchParams.get("ssl") === "true" || ["require", "required"].includes((url.searchParams.get("ssl-mode") ?? url.searchParams.get("sslmode") ?? "").toLowerCase())
        ? { rejectUnauthorized: url.searchParams.get("ssl-accept-unauthorized") !== "true" }
        : undefined,
    };
  }
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "tareeqak_system",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

const pool = globalDatabase.tareeqakMysqlPool ?? mysql.createPool({
  ...mysqlConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10_000,
  supportBigNumbers: true,
  bigNumberStrings: false,
  charset: "utf8mb4",
  dateStrings: true,
});
globalDatabase.tareeqakMysqlPool = pool;

function prepareSql(sql: string, values: SqlValue[] = []) {
  // MySQL treats backslashes as string escapes, while JavaScript query literals
  // contain one slash for each Laravel token type namespace separator.
  const text = sql.replace(/App\\Models\\(User|Citizen)/g, (_match, model: string) => `App\\\\Models\\\\${model}`);
  return { text, values };
}

async function run<T extends RowDataPacket>(connection: PoolConnection, sql: string, values: SqlValue[] = []): Promise<QueryResult<T>> {
  const { text, values: params } = prepareSql(sql, values);
  const trimmed = text.trim().replace(/;$/, "").toUpperCase();
  if (trimmed === "BEGIN" || trimmed === "BEGIN TRANSACTION") { await connection.beginTransaction(); return { rows: [], rowCount: 0 }; }
  if (trimmed === "COMMIT") { await connection.commit(); return { rows: [], rowCount: 0 }; }
  if (trimmed === "ROLLBACK") { await connection.rollback(); return { rows: [], rowCount: 0 }; }
  const [result] = await connection.execute(text, params.map((value) => value === undefined ? null : value) as never[]);
  if (Array.isArray(result)) return { rows: result as T[], rowCount: result.length };
  const header = result as { insertId?: number; affectedRows?: number };
  return { rows: [], rowCount: Number(header.affectedRows ?? 0), insertId: header.insertId };
}

export const database = {
  async connect(): Promise<Connection> {
    const connection = await pool.getConnection();
    const query = <T extends RowDataPacket = RowDataPacket>(sql: string, values: SqlValue[] = []) => run<T>(connection, sql, values);
    return {
      query,
      execute: query,
      beginTransaction: () => connection.beginTransaction(),
      commit: () => connection.commit(),
      rollback: () => connection.rollback(),
      release: () => connection.release(),
    };
  },
  async query<T extends RowDataPacket = RowDataPacket>(sql: string, values: SqlValue[] = []) {
    const connection = await pool.getConnection();
    try { return await run<T>(connection, sql, values); }
    finally { connection.release(); }
  },
  getConnection() { return this.connect(); },
};

export async function rows<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T[]> {
  await assertDatabaseConfigured();
  return (await database.query<T>(sql, values)).rows;
}

export async function row<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, values))[0];
}

export async function execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
  await assertDatabaseConfigured();
  const result = await database.query(sql, values);
  return { insertId: result.insertId ?? null, rowCount: result.rowCount, affectedRows: result.rowCount };
}

export function isDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  return code === "23505" || code === "ER_DUP_ENTRY";
}

export async function assertDatabaseConfigured(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !connectionString && (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER)) {
    throw Object.assign(new Error("Set DATABASE_URL or DB_HOST, DB_NAME, and DB_USER for MySQL."), { code: "CONFIG_DATABASE_URL_MISSING" });
  }
  if (connectionString) mysqlConfig();
}
