[CmdletBinding()]
param(
  [string]$SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")),
  [string]$DeployDir = "C:\twice-discography",
  [int]$Port = 3000,
  [string]$HostAddress = "0.0.0.0",
  [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Test-PortAvailable($PortNumber) {
  try {
    $Listeners = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
    return -not $Listeners
  } catch {
    return $true
  }
}

function Invoke-StopScript([string]$ScriptPath, [switch]$UseRootDir) {
  if (-not (Test-Path $ScriptPath)) { return }

  $StopArgs = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", $ScriptPath, "-Port", $Port
  )
  if ($UseRootDir) {
    $StopArgs += @("-RootDir", $DeployDir)
  }

  & powershell.exe @StopArgs
  $StopExitCode = $LASTEXITCODE
  if (Test-PortAvailable $Port) { return }

  Write-Warning "stop.ps1 did not release port $Port (exit $StopExitCode). Forcing..."
  # Force kill anything on the port, then wait for release
  try {
    $pids = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
    foreach ($p in $pids) {
      taskkill /PID $p /T /F 2>$null
      Start-Sleep -Milliseconds 500
    }
  } catch {}
  # Wait for port to actually be released
  for ($i = 1; $i -le 10; $i++) {
    if (Test-PortAvailable $Port) { break }
    Start-Sleep -Seconds 1
  }
  if (-not (Test-PortAvailable $Port)) {
    throw "Port $Port could not be released after force-kill. Aborting."
  }
}

# ---- Main ----

$SourceDir = Resolve-FullPath $SourceDir
$DeployDir = Resolve-FullPath $DeployDir

if (-not (Test-Path $SourceDir)) {
  throw "SourceDir does not exist: $SourceDir"
}
if ($DeployDir -eq $SourceDir) {
  throw "DeployDir must be different from SourceDir. DeployDir: $DeployDir"
}

Write-Host "Deploy source: $SourceDir"
Write-Host "Deploy target: $DeployDir"
Write-Host "Deploy port: $Port"

# 1. Stop existing service
if ((Test-Path $DeployDir) -or (-not (Test-PortAvailable $Port))) {
  $SourceStopScript = Join-Path $SourceDir "scripts\windows\stop.ps1"
  if (Test-Path $SourceStopScript) {
    Write-Host "Stopping existing service..."
    Invoke-StopScript -ScriptPath $SourceStopScript -UseRootDir
  }
}

# Try to clean up old node_modules before deployment
if (Test-Path (Join-Path $DeployDir "node_modules")) {
  Write-Host "Cleaning old node_modules..."
  cmd /c "rmdir /s /q `"$DeployDir\node_modules`" 2>nul"
}

# 2. Robocopy source → deploy (only source code, skip everything external)
Write-Host "Copying source files..."
$roboArgs = @(
  $SourceDir, $DeployDir,
  "/E",          # include subdirs
  "/COPY:DAT",   # data, attributes, timestamps
  "/DCOPY:T",    # directory timestamps
  "/R:3", "/W:2",
  "/NFL", "/NDL", "/NP",
  "/XD",          # exclude these dirs:
    ".git", ".github", ".codex-run", ".codegraph", ".reasonix",
    "node_modules", "dist", "data",
    "frontend\dist", "backend\dist"
  "/XF", ".env"   # exclude .env (preserve production config)
)

& robocopy @roboArgs
$roboExit = $LASTEXITCODE
if ($roboExit -gt 7) {
  throw "robocopy failed with exit code $roboExit"
}

# 3. Preserve .env and database
if (Test-Path $DeployDir) {
  if (-not (Test-Path (Join-Path $DeployDir ".env")) -and (Test-Path (Join-Path $DeployDir ".env.example"))) {
    Copy-Item (Join-Path $DeployDir ".env.example") (Join-Path $DeployDir ".env") -Force
    Write-Warning "Created .env from .env.example. Review it."
  }
  if (-not (Test-Path (Join-Path $DeployDir ".env"))) {
    Write-Warning "No .env found. Creating from .env.example..."
    Copy-Item (Join-Path $DeployDir ".env.example") (Join-Path $DeployDir ".env") -Force
  }
  # Backend SQLite database lives in backend\data, not root data\
  # The source repo's data/twice.db is tracking-only; production DB is backend\data\twice.db
  # /E flag won't touch it since source doesn't have backend\data\
}

# 4. Enable corepack + start
Set-Location $DeployDir

if (Get-Command corepack -ErrorAction SilentlyContinue) {
  corepack enable
  corepack prepare pnpm@9.7.0 --activate
}

# 5. Run start.ps1
$StartArgs = @(
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $DeployDir "scripts\windows\start.ps1"),
  "-Port", $Port, "-HostAddress", $HostAddress
)
if ($BackendOnly) { $StartArgs += "-BackendOnly" }

& powershell.exe @StartArgs
if ($LASTEXITCODE -ne 0) {
  throw "start.ps1 failed with exit code $LASTEXITCODE"
}

Write-Host "Deployment finished successfully."
