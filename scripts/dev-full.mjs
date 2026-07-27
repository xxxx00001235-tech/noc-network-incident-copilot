import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const children = [
  spawn(process.execPath, [path.join(root, "server", "index.mjs")], {
    stdio: "inherit",
    shell: false,
  }),
  spawn(process.execPath, [
    path.join(root, "node_modules", "vite", "bin", "vite.js"),
    "--base", "/",
    "--port", "5173",
    "--strictPort",
  ], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_DATA_MODE: "live",
      VITE_API_BASE_URL: "http://127.0.0.1:3001",
    },
  }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 200);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping && code !== 0) stop(code || 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
