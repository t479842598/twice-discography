[CmdletBinding()]
param(
  [int]$Port = 3000,
  [string]$HostAddress = "0.0.0.0",
  [switch]$SkipInstall,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RunDir = Join-Path $RootDir ".codex-run"
$PidFile = Join-Path $RunDir "twice-discography.pid"
$RunnerFile = Join-Path $RunDir "run-backend.ps1"
$StdoutLog = Join-Path $RunDir "twice-discography.out.log"
$StderrLog = Join-Path $RunDir "twice-discography.err.log"

function Ensure-Command($Name, $InstallHint) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    return
  }

  throw "$Name is not installed or not available in PATH. $InstallHint"
}

function Resolve-BackendDatabasePath {
  $ConfiguredPath = $null
  if (Test-Path ".env") {
    $ConfiguredLine = Get-Content ".env" | Where-Object { $_ -match '^DATABASE_PATH=' } | Select-Object -First 1
    if ($ConfiguredLine) {
      $ConfiguredPath = $ConfiguredLine.Substring('DATABASE_PATH='.Length).Trim().Trim('"')
    }
  }

  if (-not $ConfiguredPath) {
    $ConfiguredPath = ".\data\twice.db"
  }

  if ([System.IO.Path]::IsPathRooted($ConfiguredPath)) {
    return $ConfiguredPath
  }

  return Join-Path (Join-Path $RootDir "backend") $ConfiguredPath
}

function Test-PortAvailable($PortNumber) {
  try {
    $listeners = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
    return -not $listeners
  } catch {
    return $true
  }
}

Set-Location $RootDir
New-Item -ItemType Directory -Force $RunDir | Out-Null

if (Test-Path $PidFile) {
  $ExistingPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($ExistingPid) {
    $ExistingProcess = Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue
    if ($ExistingProcess) {
      Write-Host "TWICE Discography is already running. PID: $ExistingPid"
      Write-Host "Local URL: http://127.0.0.1:$Port"
      exit 0
    }
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

if (-not (Test-PortAvailable $Port)) {
  throw "Port $Port is already in use. Run stop-windows.cmd first, or pass another -Port."
}

Ensure-Command "node" "Install Node.js 20+ first: https://nodejs.org/"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    corepack enable
    corepack prepare pnpm@9.7.0 --activate
  }
}

Ensure-Command "pnpm" "Run first: corepack enable; corepack prepare pnpm@9.7.0 --activate"

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example. Adjust domain/port settings if needed."
}

if (-not $SkipInstall -and -not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  pnpm install --frozen-lockfile
}

$env:NODE_ENV = "production"
$env:BACKEND_PORT = "$Port"
$env:BACKEND_HOST = $HostAddress
$env:VITE_API_BASE = "/api"
$env:VITE_STATIC_BASE = "/static"

if (-not $SkipBuild) {
  Write-Host "Building frontend and backend..."
  pnpm build
}

$DatabasePath = Resolve-BackendDatabasePath
if (-not (Test-Path $DatabasePath)) {
  Write-Host "Database not found. Initializing SQLite data..."
  pnpm --filter backend db:init
}

@"
`$ErrorActionPreference = "Stop"
Set-Location "$RootDir"
`$env:NODE_ENV = "production"
`$env:BACKEND_PORT = "$Port"
`$env:BACKEND_HOST = "$HostAddress"
`$env:VITE_API_BASE = "/api"
`$env:VITE_STATIC_BASE = "/static"
pnpm --filter backend start
"@ | Set-Content -Path $RunnerFile -Encoding UTF8

$Process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$RunnerFile`"" `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $StdoutLog `
  -RedirectStandardError $StderrLog

Set-Content -Path $PidFile -Value $Process.Id -Encoding ASCII

$HealthUrl = "http://127.0.0.1:$Port/health"
$Healthy = $false
for ($Attempt = 1; $Attempt -le 20; $Attempt++) {
  Start-Sleep -Milliseconds 500
  if (-not (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue)) {
    throw "Service failed to start. Check log: $StderrLog"
  }

  try {
    $Response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
    if ($Response.ok) {
      $Healthy = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

Write-Host "TWICE Discography started."
Write-Host "PID: $($Process.Id)"
Write-Host "Local URL: http://127.0.0.1:$Port"
Write-Host "Log: $StdoutLog"

if (-not $Healthy) {
  Write-Warning "Process started, but health check did not pass yet. Try $HealthUrl later, or check $StderrLog."
}

