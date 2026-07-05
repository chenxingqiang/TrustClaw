# TrustClaw Windows portable launcher (Gateway + bundled config).
param(
  [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"
$InstallRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $InstallRoot "runtime"
$NodeDir = Join-Path $InstallRoot "node-win-x64"

function Resolve-NodeExe {
  if (Test-Path (Join-Path $NodeDir "node.exe")) {
    return Join-Path $NodeDir "node.exe"
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Node.js not found. Install Node 24+ or unpack node-win-x64 into the TrustClaw folder."
}

& (Join-Path $PSScriptRoot "Init-TrustClawConfig.ps1") -InstallRoot $InstallRoot
if ($InstallOnly) { return }

if (-not (Test-Path (Join-Path $RuntimeRoot "openclaw.mjs"))) {
  throw "Runtime missing at $RuntimeRoot"
}

$nodeExe = Resolve-NodeExe
$nodeModules = Join-Path $RuntimeRoot "node_modules"
if (-not (Test-Path $nodeModules)) {
  Write-Host "[trustclaw] First run: installing runtime dependencies (npm ci --omit=dev)..." -ForegroundColor Yellow
  Push-Location $RuntimeRoot
  try {
    if (Test-Path (Join-Path $RuntimeRoot "npm-shrinkwrap.json")) {
      & npm ci --omit=dev
    } else {
      & npm install --omit=dev
    }
  } finally {
    Pop-Location
  }
}

$env:OPENCLAW_STATE_DIR = Join-Path $env:USERPROFILE ".openclaw"
$env:OPENCLAW_CONFIG_PATH = Join-Path $env:OPENCLAW_STATE_DIR "openclaw.json"

Write-Host "[trustclaw] Starting Gateway on http://127.0.0.1:19001/" -ForegroundColor Green
Write-Host "[trustclaw] Control UI: open the URL above in your browser (use token from openclaw.json gateway.auth.token)" -ForegroundColor DarkGray

Push-Location $RuntimeRoot
try {
  & $nodeExe "openclaw.mjs" "gateway" "run" "--bind" "loopback"
} finally {
  Pop-Location
}
