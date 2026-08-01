import { createMonitorServer } from "../server/index.mjs";

const server = createMonitorServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const [healthResponse, readyResponse, versionResponse, forbiddenResponse, metricsResponse] = await Promise.all([
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/api/ready`),
    fetch(`${baseUrl}/api/version`),
    fetch(`${baseUrl}/api/metrics/current`),
    fetch(`${baseUrl}/api/metrics/current`, { headers: { "X-NOC-Role": "operator" } }),
  ]);
  const [health, ready, version] = await Promise.all([
    healthResponse.json(), readyResponse.json(), versionResponse.json(),
  ]);
  if (healthResponse.status !== 200 || health.status !== "ok") throw new Error("Health check failed");
  if (![200, 503].includes(readyResponse.status)) throw new Error("Readiness status is invalid");
  if (versionResponse.status !== 200 || !version.version) throw new Error("Version endpoint failed");
  if (forbiddenResponse.status !== 403) throw new Error("Missing role must return 403");
  if (metricsResponse.status !== 200) throw new Error("Authorized metrics request failed");
  console.log(JSON.stringify({ health, readiness: ready, version }, null, 2));
  console.log("Backend foundation test passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
