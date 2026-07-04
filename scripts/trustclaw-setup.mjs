#!/usr/bin/env node
// Ensures TrustClaw PTDS plugin is enabled for local fork demos.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const devArgs = process.argv.includes("--dev") ? ["--dev"] : [];

function enablePlugin(extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/run-node.mjs"),
      ...extraArgs,
      "config",
      "set",
      "plugins.entries.trustclaw-ptds.enabled",
      "true",
    ],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );
  return result.status ?? (result.error ? 1 : 0);
}

// Enable for default + dev profiles so Control UI (:18789) and trustclaw:dev (:19001) both work.
const profiles = devArgs.length > 0 ? [devArgs] : [[], ["--dev"]];
let exitCode = 0;
for (const profileArgs of profiles) {
  exitCode = enablePlugin(profileArgs);
  if (exitCode !== 0) {
    break;
  }
}

process.exit(exitCode);
