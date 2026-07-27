import { backendConfig, isPostgresConfigured } from "../config/env.mjs";

let pool;

export async function getPostgresPool() {
  if (!isPostgresConfigured()) return null;
  if (pool) return pool;
  const { Pool } = await import("pg");
  pool = new Pool({
    host: backendConfig.postgres.host,
    port: backendConfig.postgres.port,
    database: backendConfig.postgres.database,
    user: backendConfig.postgres.user,
    password: backendConfig.postgres.password,
    ssl: backendConfig.postgres.ssl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: backendConfig.postgres.connectionTimeoutMillis,
    max: 5,
  });
  pool.on("error", () => {
    // Pool errors are intentionally not logged with connection details.
  });
  return pool;
}

export async function checkPostgres() {
  if (!isPostgresConfigured()) {
    return { status: "not_configured", configured: false };
  }
  try {
    const client = await getPostgresPool();
    const result = await client.query("SELECT current_database() AS database, NOW() AS server_time");
    return {
      status: "connected",
      configured: true,
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time,
    };
  } catch {
    return { status: "unavailable", configured: true };
  }
}

export async function closePostgres() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
