import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

type DatabaseGlobal = typeof globalThis & {
  tareeqakMySqlPool?: Pool;
  tareeqakMySqlInitialization?: Promise<void>;
};
type SqlValue = string | number | boolean | Date | Buffer | Uint8Array | null;

const globalDatabase = globalThis as DatabaseGlobal;

export const database = globalDatabase.tareeqakMySqlPool ?? mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "tareeqak_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
  dateStrings: true,
  charset: "utf8mb4",
});
globalDatabase.tareeqakMySqlPool = database;

export async function rows<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T[]> {
  await initializeDatabase();
  const [result] = await database.execute<T[]>(sql, values);
  return result;
}

export async function row<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, values))[0];
}

export async function execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
  await initializeDatabase();
  const [result] = await database.execute<ResultSetHeader>(sql, values);
  return result;
}

export async function initializeDatabase(): Promise<void> {
  if (globalDatabase.tareeqakMySqlInitialization) return globalDatabase.tareeqakMySqlInitialization;

  globalDatabase.tareeqakMySqlInitialization = (async () => {
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NULL UNIQUE,
        email_verified_at DATETIME NULL,
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
        salary DECIMAL(12,2) NULL,
        notes TEXT NULL,
        remember_token VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX users_role_created_idx (role, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS citizens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(32) NULL,
        age VARCHAR(32) NULL,
        address TEXT NULL,
        governorate VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        phone VARCHAR(255) NOT NULL UNIQUE,
        national_id VARCHAR(100) NULL,
        front_of_card LONGTEXT NULL,
        back_of_card LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT citizens_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS personal_access_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tokenable_type VARCHAR(255) NOT NULL,
        tokenable_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        abilities TEXT NULL,
        last_used_at DATETIME NULL,
        expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX personal_access_tokens_tokenable_idx (tokenable_type, tokenable_id),
        CONSTRAINT personal_access_tokens_user_foreign FOREIGN KEY (tokenable_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS reports (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reference VARCHAR(64) NOT NULL UNIQUE,
        user_id BIGINT UNSIGNED NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        governorate VARCHAR(100) NOT NULL DEFAULT '',
        city VARCHAR(100) NOT NULL DEFAULT '',
        location TEXT NOT NULL,
        image_url TEXT NULL,
        image_data LONGBLOB NULL,
        image_type VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX reports_status_created_idx (status, created_at),
        CONSTRAINT reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'info',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(190) NOT NULL PRIMARY KEY,
        value LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    for (const statement of schemaStatements) {
      await database.query(statement);
    }
    const employeeColumns: Record<string, string> = {
      employee_number: "VARCHAR(64) NULL", job_title: "VARCHAR(120) NULL", department: "VARCHAR(120) NULL",
      employment_type: "VARCHAR(32) NULL", hire_date: "DATE NULL", birth_date: "DATE NULL", gender: "VARCHAR(32) NULL",
      national_id: "VARCHAR(64) NULL", address: "TEXT NULL", emergency_contact_name: "VARCHAR(255) NULL",
      emergency_contact_phone: "VARCHAR(64) NULL", salary: "DECIMAL(12,2) NULL", notes: "TEXT NULL",
    };
    for (const [column, definition] of Object.entries(employeeColumns)) {
      try {
        const [existing] = await database.execute<RowDataPacket[]>(
          "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME=?", [column],
        );
        if (Number(existing[0]?.total ?? 0) === 0) await database.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
      } catch (error) {
        // Keep legacy accounts readable when the database user cannot run schema migrations.
        console.error(`Employee profile migration skipped for ${column}:`, error);
      }
    }
  })().catch((error) => {
    globalDatabase.tareeqakMySqlInitialization = undefined;
    throw error;
  });

  return globalDatabase.tareeqakMySqlInitialization;
}
