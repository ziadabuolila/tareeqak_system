import { Pool, type PoolClient, type QueryResult } from "pg";

export type RowDataPacket = Record<string, unknown>;
export type ResultSetHeader = {
  insertId?: number | string | null;
  rowCount?: number;
  affectedRows?: number;
};

type DatabaseGlobal = typeof globalThis & {
  tareeqakPgPool?: Pool;
  tareeqakPgInitialization?: Promise<void>;
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
  await initializeDatabase();
  const { text, values: normalizedValues } = normalizeSql(sql, values);
  const result = await database.query<T>(text, normalizedValues);
  return result.rows as T[];
}

export async function row<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, values))[0];
}

export async function execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
  await initializeDatabase();
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

export async function initializeDatabase(): Promise<void> {
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

  if (globalDatabase.tareeqakPgInitialization) return globalDatabase.tareeqakPgInitialization;

  globalDatabase.tareeqakPgInitialization = (async () => {
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NULL UNIQUE,
        email_verified_at TIMESTAMPTZ NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'citizen',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        employee_number VARCHAR(64) NULL,
        job_title VARCHAR(120) NULL,
        department VARCHAR(120) NULL,
        employment_type VARCHAR(32) NULL,
        hire_date DATE NULL,
        birth_date DATE NULL,
        gender VARCHAR(32) NULL,
        national_id VARCHAR(64) NULL,
        address TEXT NULL,
        emergency_contact_name VARCHAR(255) NULL,
        emergency_contact_phone VARCHAR(64) NULL,
        salary NUMERIC(12,2) NULL,
        notes TEXT NULL,
        remember_token VARCHAR(100) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS citizens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(32) NULL,
        age VARCHAR(32) NULL,
        address TEXT NULL,
        governorate VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        phone VARCHAR(255) NOT NULL UNIQUE,
        national_id VARCHAR(100) NULL,
        front_of_card TEXT NULL,
        back_of_card TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT citizens_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS personal_access_tokens (
        id BIGSERIAL PRIMARY KEY,
        tokenable_type VARCHAR(255) NOT NULL,
        tokenable_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        abilities TEXT NULL,
        last_used_at TIMESTAMPTZ NULL,
        expires_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT personal_access_tokens_user_foreign FOREIGN KEY (tokenable_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS reports (
        id BIGSERIAL PRIMARY KEY,
        reference VARCHAR(64) NOT NULL UNIQUE,
        user_id BIGINT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        governorate VARCHAR(100) NOT NULL DEFAULT '',
        city VARCHAR(100) NOT NULL DEFAULT '',
        location TEXT NOT NULL,
        image_url TEXT NULL,
        image_data BYTEA NULL,
        image_type VARCHAR(100) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    ];

    for (const statement of schemaStatements) {
      await database.query(statement);
    }

    const employeeColumns: Record<string, string> = {
      employee_number: "VARCHAR(64)",
      job_title: "VARCHAR(120)",
      department: "VARCHAR(120)",
      employment_type: "VARCHAR(32)",
      hire_date: "DATE",
      birth_date: "DATE",
      gender: "VARCHAR(32)",
      national_id: "VARCHAR(64)",
      address: "TEXT",
      emergency_contact_name: "VARCHAR(255)",
      emergency_contact_phone: "VARCHAR(64)",
      salary: "NUMERIC(12,2)",
      notes: "TEXT",
    };

    for (const [column, definition] of Object.entries(employeeColumns)) {
      await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    }

    const triggerSql = `
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await database.query(triggerSql);

    const tableNames = ["users", "citizens", "personal_access_tokens", "reports", "system_settings"];
    for (const tableName of tableNames) {
      await database.query(`
        DO $trigger$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_trigger
            WHERE tgrelid = 'public.${tableName}'::regclass
              AND tgname = '${tableName}_updated_at'
              AND NOT tgisinternal
          ) THEN
              EXECUTE 'CREATE TRIGGER ${tableName}_updated_at
                BEFORE UPDATE ON public.${tableName}
                FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
          END IF;
        END;
        $trigger$;
      `);
    }

    await database.query(`CREATE INDEX IF NOT EXISTS users_role_created_idx ON users (role, created_at)`);
    await database.query(`CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_idx ON personal_access_tokens (tokenable_type, tokenable_id)`);
    await database.query(`CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports (status, created_at)`);
  })().catch((error) => {
    globalDatabase.tareeqakPgInitialization = undefined;
    throw error;
  });

  return globalDatabase.tareeqakPgInitialization;
}
