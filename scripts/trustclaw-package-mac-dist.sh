#!/usr/bin/env bash
set -euo pipefail

# TrustClaw-branded macOS distribution (app + zip + dmg).
# Keeps the Swift binary/product as OpenClaw; user-visible bundle name is TrustClaw.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export MAC_APP_NAME="${MAC_APP_NAME:-TrustClaw}"

BUILD_CONFIG="${BUILD_CONFIG:-debug}"
if [[ "$BUILD_CONFIG" == "release" ]]; then
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac}"
else
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac.debug}"
fi

exec bash "$ROOT_DIR/scripts/package-mac-dist.sh" "$@"
