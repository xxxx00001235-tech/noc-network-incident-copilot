import { createMonitorServer } from "../server/index.mjs";

const host = "127.0.0.1";
const server = createMonitorServer();

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, host, resolve);
});

try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  const baseUrl = `http://${host}:${address.port}`;
  const readOptions = { headers: { "X-NOC-Role": "operator" } };
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  const metricsResponse = await fetch(`${baseUrl}/api/metrics/current`, readOptions);
  const historyResponse = await fetch(`${baseUrl}/api/metrics/history?limit=10`, readOptions);
  const alertsResponse = await fetch(`${baseUrl}/api/alerts?limit=10`, readOptions);
  const health = await healthResponse.json();
  const metrics = await metricsResponse.json();
  const history = await historyResponse.json();
  const alerts = await alertsResponse.json();

  if (!healthResponse.ok || health.status !== "ok") throw new Error("Health endpoint failed");
  if (!metricsResponse.ok || metrics.status !== "online") throw new Error("Metrics endpoint failed");
  if (!historyResponse.ok || !Array.isArray(history.items)) throw new Error("History endpoint failed");
  if (!alertsResponse.ok || !Array.isArray(alerts.items)) throw new Error("Alerts endpoint failed");
  if (typeof metrics.cpu?.usedPercent !== "number") throw new Error("CPU metric missing");
  if (typeof metrics.memory?.usedPercent !== "number") throw new Error("Memory metric missing");
  if (typeof metrics.disk?.usedPercent !== "number") throw new Error("Disk metric missing");

  const forbiddenKeys = ["username", "hostname", "mac", "serial", "productId", "files", "token"];
  const serialized = JSON.stringify(metrics).toLowerCase();
  for (const key of forbiddenKeys) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`Forbidden field found: ${key}`);
    }
  }

  console.log("Monitor API test passed.");
  console.log(JSON.stringify({
    health: health.status,
    source: metrics.source,
    cpu: metrics.cpu.usedPercent,
    memory: metrics.memory.usedPercent,
    disk: metrics.disk.usedPercent,
    networkAvailable: metrics.network.available,
    historyRows: history.items.length,
    alertRows: alerts.items.length,
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
