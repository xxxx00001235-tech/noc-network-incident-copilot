import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresPool } from "./postgres.mjs";

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const client = await getPostgresPool();
if (!client) {
  console.error("PostgreSQL is not configured. Copy .env.example to .env and set PG* values.");
  process.exitCode = 1;
} else {
  await client.query("CREATE SCHEMA IF NOT EXISTS noc");
  await client.query(`CREATE TABLE IF NOT EXISTS noc.schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = await client.query("SELECT 1 FROM noc.schema_migrations WHERE name = $1", [name]);
    if (exists.rowCount) continue;
    const sql = await fs.readFile(path.join(directory, name), "utf8");
    const connection = await client.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(sql);
      await connection.query("INSERT INTO noc.schema_migrations(name) VALUES ($1)", [name]);
      await connection.query("COMMIT");
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
  console.log("Database migrations are up to date.");
  await client.end();
}
