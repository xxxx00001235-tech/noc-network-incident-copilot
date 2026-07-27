const integer = (value, fallback) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const backendConfig = Object.freeze({
  app: {
    name: "NOC Network Incident Copilot Backend",
    version: "1.0.1",
    environment: process.env.NODE_ENV || "development",
  },
  http: {
    host: process.env.BACKEND_HOST || "127.0.0.1",
    port: integer(process.env.BACKEND_PORT || process.env.MONITOR_PORT, 3001),
  },
  postgres: {
    host: process.env.PGHOST || "",
    port: integer(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE || "",
    user: process.env.PGUSER || "",
    password: process.env.PGPASSWORD || "",
    ssl: process.env.PGSSL === "true",
    connectionTimeoutMillis: integer(process.env.PG_CONNECTION_TIMEOUT_MS, 3000),
  },
});

export function isPostgresConfigured() {
  const { host, database, user, password } = backendConfig.postgres;
  return Boolean(host && database && user && password);
}
