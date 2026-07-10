#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [[ ! -f app.env ]]; then
  cp app.env.example app.env
  echo "Created app.env from example."
fi

if [[ ! -f app.env.dev ]]; then
  cp app.env.dev.example app.env.dev
  echo "Created app.env.dev from example — edit ANTHROPIC_API_KEY before chat tests."
fi

if ! docker image inspect trustclaw-app:arm64 >/dev/null 2>&1; then
  echo "Image trustclaw-app:arm64 not found. Run: ./scripts/build-arm64.sh"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(docker-compose)
fi

"${COMPOSE[@]}" up -d --wait
PORT="$(grep -E '^APP_PORT=' app.env 2>/dev/null | cut -d= -f2- || echo 8080)"
PORT="${PORT:-8080}"
UI_PORT="$(grep -E '^TRUSTCLAW_UI_PORT=' app.env 2>/dev/null | cut -d= -f2- || echo 15174)"
UI_PORT="${UI_PORT:-15174}"

echo "==> Health check http://127.0.0.1:${PORT}/healthz"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null; then
    echo "healthz OK"
    break
  fi
  sleep 2
done

if ! curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null; then
  echo "Health check failed"
  "${COMPOSE[@]}" logs --tail=80
  exit 1
fi

echo "==> TRA Console http://127.0.0.1:${UI_PORT}/trustclaw/"
UI_OK=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${UI_PORT}/trustclaw/" >/dev/null; then
    echo "trustclaw UI OK"
    UI_OK=1
    break
  fi
  sleep 2
done

if [[ "$UI_OK" != "1" ]]; then
  echo "TrustClaw UI check failed (is trustclaw:ui:build included in image?)"
  "${COMPOSE[@]}" logs --tail=80
  exit 1
fi

echo "==> Phase 4 agent-packs API http://127.0.0.1:${PORT}/api/tra/agent-packs"
PACKS_JSON="$(curl -fsS "http://127.0.0.1:${PORT}/api/tra/agent-packs" || true)"
if ! printf '%s' "$PACKS_JSON" | grep -q '"status":"success"'; then
  echo "agent-packs API failed (expected trustclaw-tra + Phase 4 routes)"
  echo "$PACKS_JSON" | head -c 400
  echo
  "${COMPOSE[@]}" logs --tail=80
  exit 1
fi
if ! printf '%s' "$PACKS_JSON" | grep -q 'glp1-eligibility'; then
  echo "agent-packs API missing default pack glp1-eligibility"
  echo "$PACKS_JSON" | head -c 400
  echo
  exit 1
fi
echo "agent-packs API OK"

echo "==> Plugin id in container config"
CONTAINER="$("${COMPOSE[@]}" ps -q app 2>/dev/null || true)"
if [[ -n "$CONTAINER" ]]; then
  PLUGIN_IDS="$(docker exec "$CONTAINER" node -e "const c=require('/home/node/.openclaw/openclaw.json'); console.log(Object.keys(c.plugins?.entries||{}).filter(k=>k.includes('trust')).join(','))" 2>/dev/null || true)"
  if [[ "$PLUGIN_IDS" != *trustclaw-tra* ]]; then
    echo "Expected plugins.entries.trustclaw-tra, got: ${PLUGIN_IDS:-none}"
    exit 1
  fi
  PACKS_DIR="$(docker exec "$CONTAINER" node -e "const c=require('/home/node/.openclaw/openclaw.json'); console.log(c.plugins?.entries?.['trustclaw-tra']?.config?.agentPacksDir||'')" 2>/dev/null || true)"
  case "$PACKS_DIR" in
    */agent-packs)
      echo "agentPacksDir OK: $PACKS_DIR"
      ;;
    *)
      echo "Expected writable …/agent-packs, got: ${PACKS_DIR:-unset}"
      exit 1
      ;;
  esac
fi

"${COMPOSE[@]}" ps
exit 0
