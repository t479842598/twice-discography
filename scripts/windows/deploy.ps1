[CmdletBinding()]
param(
  [string]$SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")),
  [string]$DeployDir = "C:\twice-discography",
  [int]$Port = 3000,
  [string]$HostAddress = "0.0.0.0",
  [switch]$KeepBackup
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Invoke-RobocopyMirror([string]$From, [string]$To) {
  New-Item -ItemType Directory -Force $To | Out-Null

  $arguments = @(
    $From,
    $To,
    "/MIR",
    "/R:3",
    "/W:2",
    "/NFL",
    "/NDL",
    "/NP",
    "/XD", ".git", ".github", ".codex-run", "node_modules", "dist", "frontend\dist", "backend\dist", "data",
    "/XF", ".env"
  )

  & robocopy @arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -gt 7) {
    throw "robocopy failed with exit code $exitCode"
  }
}

function Copy-IfExists([string]$From, [string]$To) {
  if (Test-Path $From) {
    Copy-Item $From $To -Force
  }
}

$SourceDir = Resolve-FullPath $SourceDir
$DeployDir = Resolve-FullPath $DeployDir
$NewDir = "$DeployDir-new"
$BackupDir = "$DeployDir-backup"

if (-not (Test-Path $SourceDir)) {
  throw "SourceDir does not exist: $SourceDir"
}

if ($DeployDir -eq $SourceDir) {
  throw "DeployDir must be different from SourceDir to avoid deleting the runner workspace. DeployDir: $DeployDir"
}

Write-Host "Deploy source: $SourceDir"
Write-Host "Deploy target: $DeployDir"

if (Test-Path $NewDir) {
  Remove-Item $NewDir -Recurse -Force
}

Invoke-RobocopyMirror -From $SourceDir -To $NewDir

if (Test-Path $DeployDir) {
  Copy-IfExists -From (Join-Path $DeployDir ".env") -To (Join-Path $NewDir ".env")

  $ExistingDataDir = Join-Path $DeployDir "data"
  if (Test-Path $ExistingDataDir) {
    New-Item -ItemType Directory -Force (Join-Path $NewDir "data") | Out-Null
    Copy-Item (Join-Path $ExistingDataDir "*") (Join-Path $NewDir "data") -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path (Join-Path $NewDir ".env")) -and (Test-Path (Join-Path $NewDir ".env.example"))) {
  Copy-Item (Join-Path $NewDir ".env.example") (Join-Path $NewDir ".env") -Force
  Write-Warning "Created .env from .env.example. Please review production secrets in $DeployDir\.env after first deploy."
}

$OldStopScript = Join-Path $DeployDir "scripts\windows\stop.ps1"
if (Test-Path $OldStopScript) {
  Write-Host "Stopping existing service..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $OldStopScript -Port $Port
}

if (Test-Path $BackupDir) {
  Remove-Item $BackupDir -Recurse -Force
}

if (Test-Path $DeployDir) {
  Move-Item $DeployDir $BackupDir
}

Move-Item $NewDir $DeployDir

try {
  Set-Location $DeployDir

  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    corepack enable
    corepack prepare pnpm@9.7.0 --activate
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DeployDir "scripts\windows\start.ps1") -Port $Port -HostAddress $HostAddress

  if (-not $KeepBackup -and (Test-Path $BackupDir)) {
    Remove-Item $BackupDir -Recurse -Force
  }

  Write-Host "Deployment finished successfully."
} catch {
  Write-Error "Deployment failed: $($_.Exception.Message)"

  $CurrentStopScript = Join-Path $DeployDir "scripts\windows\stop.ps1"
  if (Test-Path $CurrentStopScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $CurrentStopScript -Port $Port
  }

  if (Test-Path $DeployDir) {
    Remove-Item $DeployDir -Recurse -Force
  }

  if (Test-Path $BackupDir) {
    Move-Item $BackupDir $DeployDir
    $RollbackStartScript = Join-Path $DeployDir "scripts\windows\start.ps1"
    if (Test-Path $RollbackStartScript) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RollbackStartScript -Port $Port -HostAddress $HostAddress -SkipInstall -SkipBuild
    }
  }

  throw
}
