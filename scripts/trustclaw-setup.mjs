#!/usr/bin/env node
import { spawnSync } from "node:child_process";
// Ensures TrustClaw PTDS plugin is enabled for local fork demos.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRUSTCLAW_DEFAULT_GATEWAY_PORT } from "./lib/trustclaw-defaults.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const workspaceTemplateDir = path.join(repoRoot, "trustclaw", "workspace", "dev");

const devArgs = process.argv.includes("--dev") ? ["--dev"] : [];

function runConfigSet(profileArgs, key, value, strictJson = false) {
  const args = [
    path.join(repoRoot, "scripts/run-node.mjs"),
    ...profileArgs,
    "config",
    "set",
    key,
    String(value),
  ];
  if (strictJson) {
    args.push("--strict-json");
  }
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? (result.error ? 1 : 0);
}

function enablePlugin(extraArgs = []) {
  return runConfigSet(extraArgs, "plugins.entries.trustclaw-ptds.enabled", "true");
}

function setDefaultGatewayPort(extraArgs = []) {
  return runConfigSet(extraArgs, "gateway.port", TRUSTCLAW_DEFAULT_GATEWAY_PORT, true);
}

function syncDevWorkspace() {
  if (!existsSync(workspaceTemplateDir)) {
    return;
  }
  const targetDir = path.join(homedir(), ".openclaw", "workspace-dev");
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md"]) {
    const src = path.join(workspaceTemplateDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(targetDir, name), { force: true });
    }
  }
  const avatarSrcDir = path.join(workspaceTemplateDir, "avatars");
  if (existsSync(avatarSrcDir)) {
    cpSync(avatarSrcDir, path.join(targetDir, "avatars"), { force: true, recursive: true });
  }
  console.log(`[trustclaw:setup] Synced PTDS workspace prompts → ${targetDir}`);
}

// Enable for default + dev profiles
const profiles = devArgs.length > 0 ? [devArgs] : [[], ["--dev"]];
let exitCode = 0;
for (const profileArgs of profiles) {
  exitCode = enablePlugin(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = setDefaultGatewayPort(profileArgs);
  if (exitCode !== 0) {
    break;
  }
}

if (exitCode === 0) {
  syncDevWorkspace();
  console.log(
    `[trustclaw:setup] gateway.port → ${TRUSTCLAW_DEFAULT_GATEWAY_PORT} (default + dev profiles)`,
  );
}

process.exit(exitCode);
