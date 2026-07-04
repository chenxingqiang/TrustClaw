#!/usr/bin/env bash
set -euo pipefail

# TrustClaw-branded macOS distribution (app + zip + dmg).
# Keeps the Swift binary/product as OpenClaw; user-visible bundle name is TrustClaw.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export MAC_APP_NAME="${MAC_APP_NAME:-TrustClaw}"
export SWIFT_DISABLE_AUTOMATIC_RESOLUTION="${SWIFT_DISABLE_AUTOMATIC_RESOLUTION:-1}"

# Reuse a recent local Swift build when Package.resolved/network updates are flaky.
if [[ "${SKIP_SWIFT_BUILD:-}" == "" ]] && [[ -x "$ROOT_DIR/apps/macos/.build/arm64/debug/OpenClaw" ]]; then
  export SKIP_SWIFT_BUILD=1
fi

BUILD_CONFIG="${BUILD_CONFIG:-debug}"
if [[ "$BUILD_CONFIG" == "release" ]]; then
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac}"
else
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac.debug}"
fi

exec bash "$ROOT_DIR/scripts/package-mac-dist.sh" "$@"
