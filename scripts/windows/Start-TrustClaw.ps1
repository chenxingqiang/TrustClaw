# TrustClaw Windows portable launcher (Gateway + bundled config).
param(
  [switch]$InstallOnly,
  [switch]$NoOpenBrowser
)

$ErrorActionPreference = "Stop"
$InstallRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $InstallRoot "runtime"
$NodeDir = Join-Path $InstallRoot "node-win-x64"
$DefaultGatewayToken = "trustclaw-local-default"
$GatewayPort = 19001

function Resolve-NodeExe {
  if (Test-Path (Join-Path $NodeDir "node.exe")) {
    return Join-Path $NodeDir "node.exe"
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Node.js not found. Install Node 24+ or unpack node-win-x64 into the TrustClaw folder."
}

function Read-GatewayAuthToken {
  param([string]$ConfigPath)
  if (-not (Test-Path $ConfigPath)) {
    return $DefaultGatewayToken
  }
  try {
    $config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
    $token = [string]$config.gateway.auth.token
    if ($token) { return $token.Trim() }
  } catch {}
  return $DefaultGatewayToken
}

function Build-DashboardUrl {
  param([string]$Token)
  $encoded = [uri]::EscapeDataString($Token)
  return "http://127.0.0.1:$GatewayPort/#token=$encoded"
}

function Wait-GatewayReady {
  param([int]$TimeoutSec = 45)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$GatewayPort/" -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

function Open-TrustClawDashboard {
  param([string]$Token)
  $url = Build-DashboardUrl -Token $Token
  Write-Host "[trustclaw] Opening Control UI: $url" -ForegroundColor Cyan
  Start-Process $url | Out-Null
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
$authToken = Read-GatewayAuthToken -ConfigPath $env:OPENCLAW_CONFIG_PATH
$dashboardUrl = Build-DashboardUrl -Token $authToken

Write-Host "[trustclaw] Starting Gateway on http://127.0.0.1:$GatewayPort/" -ForegroundColor Green
Write-Host "[trustclaw] Default token: $authToken" -ForegroundColor DarkGray
Write-Host "[trustclaw] One-click URL: $dashboardUrl" -ForegroundColor DarkGray
Write-Host "[trustclaw] Or double-click TrustClaw Connect.url in this folder." -ForegroundColor DarkGray

$openBrowser = -not $NoOpenBrowser
if ($openBrowser) {
  $gatewayArgs = @(
    "openclaw.mjs", "gateway", "run", "--bind", "loopback"
  )
  $gateway = Start-Process -FilePath $nodeExe -ArgumentList $gatewayArgs -WorkingDirectory $RuntimeRoot -PassThru -WindowStyle Normal
  if (Wait-GatewayReady) {
    Open-TrustClawDashboard -Token $authToken
  } else {
    Write-Host "[trustclaw] Gateway not ready yet; open $dashboardUrl manually when it starts." -ForegroundColor Yellow
  }
  Wait-Process -Id $gateway.Id
  return
}

Push-Location $RuntimeRoot
try {
  & $nodeExe "openclaw.mjs" "gateway" "run" "--bind" "loopback"
} finally {
  Pop-Location
}
