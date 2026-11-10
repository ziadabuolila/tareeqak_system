export function mysqlConfigFromEnv(env = process.env) {
  const connectionString = env.DATABASE_URL?.trim();
  if (connectionString) {
    const url = new URL(connectionString);
    if (!["mysql:", "mariadb:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
      throw new Error("DATABASE_URL must use mysql:// or mariadb:// and include a database name.");
    }
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: url.searchParams.get("ssl") === "true" || ["require", "required"].includes((url.searchParams.get("ssl-mode") || url.searchParams.get("sslmode") || "").toLowerCase())
        ? { rejectUnauthorized: url.searchParams.get("ssl-accept-unauthorized") !== "true" }
        : undefined,
    };
  }
  return {
    host: env.DB_HOST || "127.0.0.1",
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME || "tareeqak_system",
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}
