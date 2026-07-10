#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
CONTAINER="${TRUSTCLAW_CONTAINER:-trustclaw-arm64-app-1}"
REMOTE_WORKSPACE="/home/node/.openclaw/workspace/trustclaw-agents"
TARGET_AGENTS_DIR="$ROOT/trustclaw/agents"
STAGING_DIR="$(mktemp -d)"

cleanup() { rm -rf "$STAGING_DIR"; }
trap cleanup EXIT

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container not found: $CONTAINER" >&2
  exit 1
fi

echo "==> Pull legacy domain packs from container workspace"
docker cp "$CONTAINER:$REMOTE_WORKSPACE/." "$STAGING_DIR/"

echo "==> Normalize ptds-* → tra-* into $TARGET_AGENTS_DIR"
node --input-type=module <<NODE
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  LEGACY_DOMAIN_PACK_FOLDER_MAP,
  normalizePackDirectory,
  resolveTargetPackId,
} from "$ROOT/scripts/lib/normalize-domain-agent-pack.mjs";

const stagingDir = "$STAGING_DIR";
const targetAgentsDir = "$TARGET_AGENTS_DIR";
mkdirSync(targetAgentsDir, { recursive: true });

for (const entry of readdirSync(stagingDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const targetPackId = resolveTargetPackId(entry.name);
  if (!targetPackId) continue;
  const sourceDir = path.join(stagingDir, entry.name);
  const targetDir = path.join(targetAgentsDir, targetPackId);
  if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  normalizePackDirectory(targetDir, targetPackId);
  console.log(\`  synced \${entry.name} → \${targetPackId}\`);
}

const expected = Object.values(LEGACY_DOMAIN_PACK_FOLDER_MAP);
const missing = expected.filter((packId) => !existsSync(path.join(targetAgentsDir, packId, "agent.pack.json")));
if (missing.length > 0) {
  console.error("Missing normalized packs:", missing.join(", "));
  process.exit(1);
}
console.log(\`OK: \${expected.length} domain agent packs in \${targetAgentsDir}\`);
NODE

echo "==> Done"
