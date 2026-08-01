import http from "node:http";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { backendConfig } from "./config/env.mjs";
import { checkPostgres, closePostgres } from "./db/postgres.mjs";

const execFileAsync = promisify(execFile);
const HOST = backendConfig.http.host;
const PORT = backendConfig.http.port;
const SAMPLE_INTERVAL_MS = Math.max(2000, Number.parseInt(process.env.MONITOR_SAMPLE_INTERVAL_MS || "5000", 10));
const WINDOWS_SYSTEM_DRIVE = `${process.env.SystemDrive || "C:"}\\`;
const DATABASE_PATH = path.resolve(process.env.MONITOR_DATABASE_PATH || "runtime-data/monitor.sqlite");
const REQUIRE_CF_ACCESS = process.env.MONITOR_REQUIRE_CF_ACCESS === "true";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.MONITOR_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 75, critical: 90 },
  disk: { warning: 80, critical: 90 },
};

await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });
const database = new DatabaseSync(DATABASE_PATH);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collected_at TEXT NOT NULL,
    cpu_percent REAL NOT NULL,
    memory_percent REAL NOT NULL,
    disk_percent REAL NOT NULL,
    network_received_bytes INTEGER,
    network_sent_bytes INTEGER,
    uptime_seconds INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON metrics(collected_at DESC);
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL,
    severity TEXT NOT NULL,
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    status TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, opened_at DESC);
`);

let latestMetrics;
let sampler;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function cpuSnapshot() {
  return os.cpus().reduce(
    (total, cpu) => {
      const idle = cpu.times.idle;
      const all = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      return { idle: total.idle + idle, total: total.total + all };
    },
    { idle: 0, total: 0 },
  );
}

async function cpuUsagePercent() {
  const start = cpuSnapshot();
  await delay(250);
  const end = cpuSnapshot();
  const total = end.total - start.total;
  const idle = end.idle - start.idle;
  return total > 0 ? Number((((total - idle) / total) * 100).toFixed(1)) : 0;
}

async function diskMetrics() {
  const stats = await fs.statfs(WINDOWS_SYSTEM_DRIVE);
  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  return {
    totalBytes,
    usedBytes,
    usedPercent: totalBytes ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0,
  };
}

async function networkMetrics() {
  if (process.platform !== "win32") {
    return { receivedBytes: null, sentBytes: null, available: false };
  }
  try {
    const { stdout } = await execFileAsync(
      `${process.env.SystemRoot || "C:\\Windows"}\\System32\\netstat.exe`,
      ["-e"],
      { timeout: 3000, windowsHide: true, maxBuffer: 64 * 1024 },
    );
    const values = stdout
      .split(/\r?\n/)
      .map((line) => line.match(/(\d+)\s+(\d+)\s*$/))
      .find(Boolean)
      ?.slice(1)
      .map(Number);
    if (!values || values.length < 2) throw new Error("Network byte counters unavailable");
    return { receivedBytes: values[0], sentBytes: values[1], available: true };
  } catch {
    return { receivedBytes: null, sentBytes: null, available: false };
  }
}

async function collectMetrics() {
  const [cpuPercent, disk, network] = await Promise.all([
    cpuUsagePercent(),
    diskMetrics(),
    networkMetrics(),
  ]);
  const totalMemoryBytes = os.totalmem();
  const usedMemoryBytes = totalMemoryBytes - os.freemem();
  return {
    source: "local",
    status: "online",
    collectedAt: new Date().toISOString(),
    cpu: { usedPercent: cpuPercent },
    memory: {
      totalBytes: totalMemoryBytes,
      usedBytes: usedMemoryBytes,
      usedPercent: Number(((usedMemoryBytes / totalMemoryBytes) * 100).toFixed(1)),
    },
    disk,
    network,
    uptimeSeconds: Math.floor(os.uptime()),
  };
}

function severityFor(metric, value) {
  const threshold = THRESHOLDS[metric];
  if (value >= threshold.critical) return { severity: "Critical", threshold: threshold.critical };
  if (value >= threshold.warning) return { severity: "Warning", threshold: threshold.warning };
  return null;
}

function updateAlerts(metrics) {
  const readings = {
    cpu: metrics.cpu.usedPercent,
    memory: metrics.memory.usedPercent,
    disk: metrics.disk.usedPercent,
  };
  const findActive = database.prepare("SELECT id, severity FROM alerts WHERE metric = ? AND status = 'active' ORDER BY id DESC LIMIT 1");
  const insert = database.prepare("INSERT INTO alerts(metric, severity, value, threshold, status, opened_at) VALUES (?, ?, ?, ?, 'active', ?)");
  const resolve = database.prepare("UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ?");
  for (const [metric, value] of Object.entries(readings)) {
    const next = severityFor(metric, value);
    const active = findActive.get(metric);
    if (!next && active) {
      resolve.run(metrics.collectedAt, active.id);
    } else if (next && !active) {
      insert.run(metric, next.severity, value, next.threshold, metrics.collectedAt);
    } else if (next && active && active.severity !== next.severity) {
      resolve.run(metrics.collectedAt, active.id);
      insert.run(metric, next.severity, value, next.threshold, metrics.collectedAt);
    }
  }
}

async function sampleAndStore() {
  const metrics = await collectMetrics();
  latestMetrics = metrics;
  database.prepare(`
    INSERT INTO metrics(
      collected_at, cpu_percent, memory_percent, disk_percent,
      network_received_bytes, network_sent_bytes, uptime_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    metrics.collectedAt,
    metrics.cpu.usedPercent,
    metrics.memory.usedPercent,
    metrics.disk.usedPercent,
    metrics.network.receivedBytes,
    metrics.network.sentBytes,
    metrics.uptimeSeconds,
  );
  updateAlerts(metrics);
  database.prepare("DELETE FROM metrics WHERE id NOT IN (SELECT id FROM metrics ORDER BY id DESC LIMIT 17280)").run();
  return metrics;
}

function startSampler() {
  if (sampler) return;
  void sampleAndStore().catch(() => undefined);
  sampler = setInterval(() => void sampleAndStore().catch(() => undefined), SAMPLE_INTERVAL_MS);
  sampler.unref();
}

function history(limit) {
  const safeLimit = Math.min(1000, Math.max(1, Number.parseInt(limit || "120", 10)));
  return database.prepare(`
    SELECT collected_at AS collectedAt, cpu_percent AS cpuPercent,
           memory_percent AS memoryPercent, disk_percent AS diskPercent,
           network_received_bytes AS networkReceivedBytes,
           network_sent_bytes AS networkSentBytes
    FROM metrics ORDER BY id DESC LIMIT ?
  `).all(safeLimit).reverse();
}

function alerts(limit) {
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit || "50", 10)));
  return database.prepare(`
    SELECT id, metric, severity, value, threshold, status,
           opened_at AS openedAt, resolved_at AS resolvedAt
    FROM alerts ORDER BY id DESC LIMIT ?
  `).all(safeLimit);
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  return origin && ALLOWED_ORIGINS.has(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : {};
}

function sendJson(response, statusCode, value, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(value));
}

function hasCloudflareAccess(request) {
  if (!REQUIRE_CF_ACCESS) return true;
  const assertion = request.headers["cf-access-jwt-assertion"];
  return typeof assertion === "string" && assertion.length > 40;
}

const ROLE_PERMISSIONS = {
  admin: new Set(["metrics.read"]),
  operator: new Set(["metrics.read"]),
  engineer: new Set(["metrics.read"]),
};

function hasPermission(request, permission) {
  const role = request.headers["x-noc-role"];
  return typeof role === "string" && ROLE_PERMISSIONS[role]?.has(permission);
}

export function createMonitorServer() {
  startSampler();
  return http.createServer(async (request, response) => {
    const headers = corsHeaders(request);
    const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...headers,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-NOC-Role",
      });
      response.end();
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" }, headers);
      return;
    }
    if (!hasCloudflareAccess(request)) {
      sendJson(response, 401, { error: "Cloudflare Access authentication required" }, headers);
      return;
    }
    const publicPaths = new Set(["/api/health", "/api/ready", "/api/version"]);
    if (url.pathname.startsWith("/api/") && !publicPaths.has(url.pathname) && !hasPermission(request, "metrics.read")) {
      sendJson(response, 403, { error: "Forbidden" }, headers);
      return;
    }
    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        service: backendConfig.app.name,
        environment: backendConfig.app.environment,
        uptimeSeconds: Math.floor(process.uptime()),
        collectedAt: latestMetrics?.collectedAt || null,
      }, headers);
      return;
    }
    if (url.pathname === "/api/ready") {
      const postgres = await checkPostgres();
      const ready = postgres.status === "connected";
      sendJson(response, ready ? 200 : 503, {
        status: ready ? "ready" : "not_ready",
        dependencies: { postgres },
      }, headers);
      return;
    }
    if (url.pathname === "/api/version") {
      sendJson(response, 200, {
        name: backendConfig.app.name,
        version: backendConfig.app.version,
        environment: backendConfig.app.environment,
      }, headers);
      return;
    }
    if (url.pathname === "/api/metrics/current") {
      try {
        sendJson(response, 200, latestMetrics || await sampleAndStore(), headers);
      } catch {
        sendJson(response, 503, { status: "unavailable", error: "Metrics are temporarily unavailable" }, headers);
      }
      return;
    }
    if (url.pathname === "/api/metrics/history") {
      sendJson(response, 200, { items: history(url.searchParams.get("limit")) }, headers);
      return;
    }
    if (url.pathname === "/api/alerts") {
      sendJson(response, 200, { items: alerts(url.searchParams.get("limit")), thresholds: THRESHOLDS }, headers);
      return;
    }
    sendJson(response, 404, { error: "Not found" }, headers);
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const server = createMonitorServer();
  server.listen(PORT, HOST, () => {
    console.log(`NOC local monitor listening on http://${HOST}:${PORT}`);
    console.log("Loopback only: this API is not exposed to the LAN or internet.");
    console.log(`SQLite history: ${DATABASE_PATH}`);
    console.log(`Sampling every ${SAMPLE_INTERVAL_MS / 1000} seconds.`);
  });
  const shutdown = async () => {
    server.close();
    await closePostgres();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
