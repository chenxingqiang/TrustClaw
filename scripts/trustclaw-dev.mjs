#!/usr/bin/env node
// One-command TrustClaw dev loop: enable plugin, start gateway + demo UI dev server.
import { execSync, spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const children = [];

const gatewayPort =
  process.env.OPENCLAW_GATEWAY_PORT ?? process.env.TRUSTCLAW_GATEWAY_PORT ?? "19001";
const uiPort = process.env.TRUSTCLAW_UI_PORT ?? "5174";

function listenerPid(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const pid = out.split("\n").find((line) => /^\d+$/.test(line.trim()));
    return pid ? Number(pid) : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gateway rebuild on cold start can take 15–90s; Vite must not proxy until listen. */
async function waitForGatewayListen(port, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (listenerPid(port) != null) {
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `[trustclaw:dev] Gateway did not listen on :${port} within ${Math.round(timeoutMs / 1000)}s`,
  );
}

function assertDevPortsFree() {
  const conflicts = [];
  for (const [label, port] of [
    ["Gateway", gatewayPort],
    ["TrustClaw UI (Vite)", uiPort],
  ]) {
    const pid = listenerPid(port);
    if (pid != null) {
      conflicts.push({ label, port, pid });
    }
  }
  if (conflicts.length === 0) {
    return;
  }

  console.error(
    "[trustclaw:dev] Dev ports already in use — another dev session may still be running:\n",
  );
  for (const { label, port, pid } of conflicts) {
    console.error(`  ${label}: :${port} (PID ${pid})`);
  }
  console.error(
    `\nIf that session is yours, open:\n` +
      `  http://127.0.0.1:${uiPort}/trustclaw/\n` +
      `  http://127.0.0.1:${gatewayPort}/\n` +
      `\nTo restart, stop the old process first (example: kill ${conflicts[0]?.pid}).\n` +
      `Or use another UI port: TRUSTCLAW_UI_PORT=5175 pnpm trustclaw:dev\n`,
  );
  process.exit(1);
}

function ensureControlUiPublicAssets() {
  const distUiDir = path.join(repoRoot, "dist", "control-ui");
  const publicUiDir = path.join(repoRoot, "ui", "public");
  const marker = path.join(distUiDir, "favicon.svg");
  if (existsSync(marker)) {
    return;
  }
  if (!existsSync(publicUiDir)) {
    console.warn("[trustclaw:dev] ui/public missing; chat logos may not load until `pnpm ui:build`.");
    return;
  }
  mkdirSync(distUiDir, { recursive: true });
  for (const name of [
    "favicon.svg",
    "apple-touch-icon.png",
    "favicon-32.png",
    "favicon.ico",
    "manifest.webmanifest",
  ]) {
    const src = path.join(publicUiDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(distUiDir, name), { force: true });
    }
  }
  console.log("[trustclaw:dev] Copied Control UI public icons → dist/control-ui/");
}

function runNodeScript(scriptRelPath, args = []) {
  return spawn(process.execPath, [path.join(repoRoot, scriptRelPath), ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[trustclaw:dev] Enabling trustclaw-ptds plugin in local dev config…");
const setup = spawnSync(
  process.execPath,
  [path.join(repoRoot, "scripts/trustclaw-setup.mjs"), "--dev"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  },
);
if ((setup.status ?? 1) !== 0) {
  process.exit(setup.status ?? 1);
}

ensureControlUiPublicAssets();

assertDevPortsFree();

console.log("[trustclaw:dev] Starting Gateway (channels skipped)…");
console.log(`[trustclaw:dev] Waiting for gateway :${gatewayPort} before TrustClaw UI (Vite)…`);

const devEnv = {
  ...process.env,
  OPENCLAW_SKIP_CHANNELS: "1",
  OPENCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_UI_PORT: uiPort,
};

const gatewayChild = spawn(
  process.execPath,
  [path.join(repoRoot, "scripts/run-node.mjs"), "--dev", "gateway"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: devEnv,
  },
);
children.push(gatewayChild);

gatewayChild.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

try {
  await waitForGatewayListen(gatewayPort);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}

console.log(
  `[trustclaw:dev] Gateway ready. Open http://127.0.0.1:${uiPort}/trustclaw/ (API proxied to :${gatewayPort})`,
);

const uiChild = spawn(process.execPath, [path.join(repoRoot, "scripts/trustclaw-ui.js"), "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: devEnv,
});
children.push(uiChild);

uiChild.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});
