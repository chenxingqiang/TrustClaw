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
const workspaceRoot = path.join(repoRoot, "trustclaw", "workspace");

/** Repo-relative workspace templates synced into OpenClaw agent workspaces. */
const TRUSTCLAW_AGENT_WORKSPACES = [
  {
    agentId: "main",
    templateDir: path.join(workspaceRoot, "dev"),
    syncTargetName: "workspace-dev",
  },
  {
    agentId: "nrdl-reimburse",
    templateDir: path.join(workspaceRoot, "nrdl-reimburse"),
    syncTargetName: "workspace-nrdl-reimburse",
  },
  {
    agentId: "compliance-auditor",
    templateDir: path.join(workspaceRoot, "compliance-auditor"),
    syncTargetName: "workspace-compliance-auditor",
  },
];

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

function runOpenClaw(profileArgs, commandArgs, { allowAlreadyExists = false } = {}) {
  const args = [path.join(repoRoot, "scripts/run-node.mjs"), ...profileArgs, ...commandArgs];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (
    allowAlreadyExists &&
    result.status !== 0 &&
    output.includes("already exists")
  ) {
    return 0;
  }
  if (result.status !== 0) {
    if (output.trim()) {
      process.stderr.write(output);
    }
  } else if (output.trim()) {
    process.stdout.write(output);
  }
  return result.status ?? (result.error ? 1 : 0);
}

function enablePlugin(extraArgs = []) {
  return runConfigSet(extraArgs, "plugins.entries.trustclaw-ptds.enabled", "true");
}

function setDefaultGatewayPort(extraArgs = []) {
  return runConfigSet(extraArgs, "gateway.port", TRUSTCLAW_DEFAULT_GATEWAY_PORT, true);
}

function setDefaultAgentPack(extraArgs = []) {
  return runConfigSet(
    extraArgs,
    "plugins.entries.trustclaw-ptds.config.defaultAgentPack",
    "glp1-eligibility",
  );
}

function syncWorkspaceTemplate(templateDir, targetDir) {
  if (!existsSync(templateDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md"]) {
    const src = path.join(templateDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(targetDir, name), { force: true });
    }
  }
  const avatarSrcDir = path.join(templateDir, "avatars");
  if (existsSync(avatarSrcDir)) {
    cpSync(avatarSrcDir, path.join(targetDir, "avatars"), { force: true, recursive: true });
  }
}

function syncDevWorkspace() {
  for (const entry of TRUSTCLAW_AGENT_WORKSPACES) {
    const targetDir = path.join(homedir(), ".openclaw", entry.syncTargetName);
    syncWorkspaceTemplate(entry.templateDir, targetDir);
    console.log(`[trustclaw:setup] Synced ${entry.agentId} workspace → ${targetDir}`);
  }
}

function ensureTrustclawAgents(profileArgs) {
  let exitCode = 0;
  for (const entry of TRUSTCLAW_AGENT_WORKSPACES) {
    if (entry.agentId === "main") {
      continue;
    }
    const workspacePath = entry.templateDir;
    const displayName =
      entry.agentId === "nrdl-reimburse" ? "NRDL Reimburse Advisor" : "PTDS Compliance Auditor";
    const code = runOpenClaw(
      profileArgs,
      [
        "agents",
        "add",
        entry.agentId,
        "--workspace",
        workspacePath,
        "--name",
        displayName,
        "--non-interactive",
      ],
      { allowAlreadyExists: true },
    );
    if (code !== 0) {
      exitCode = code;
      break;
    }
    const targetDir = path.join(homedir(), ".openclaw", entry.syncTargetName);
    syncWorkspaceTemplate(entry.templateDir, targetDir);
  }
  return exitCode;
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
  exitCode = setDefaultAgentPack(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = ensureTrustclawAgents(profileArgs);
  if (exitCode !== 0) {
    break;
  }
}

if (exitCode === 0) {
  syncDevWorkspace();
  console.log(
    `[trustclaw:setup] gateway.port → ${TRUSTCLAW_DEFAULT_GATEWAY_PORT} (default + dev profiles)`,
  );
  console.log(
    "[trustclaw:setup] agents: main (dev), nrdl-reimburse, compliance-auditor — use PTDS Console agent selector or switch OpenClaw agent",
  );
}

process.exit(exitCode);
