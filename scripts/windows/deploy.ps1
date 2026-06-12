[CmdletBinding()]
param(
  [string]$SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")),
  [string]$DeployDir = "C:\twice-discography",
  [int]$Port = 3000,
  [string]$HostAddress = "0.0.0.0",
  [switch]$KeepBackup,
  [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Assert-SafeRecursivePath([string]$Path) {
  $FullPath = Resolve-FullPath $Path
  $Root = [System.IO.Path]::GetPathRoot($FullPath)
  if ($FullPath.TrimEnd('\') -eq $Root.TrimEnd('\')) {
    throw "Refusing to recursively remove drive root: $FullPath"
  }

  return $FullPath
}

function Remove-TreeWithRetry([string]$Path, [switch]$BestEffort) {
  $FullPath = Assert-SafeRecursivePath $Path
  if (-not (Test-Path -LiteralPath $FullPath)) {
    return
  }

  $LastError = $null
  for ($Attempt = 1; $Attempt -le 3; $Attempt++) {
    try {
      Remove-Item -LiteralPath $FullPath -Recurse -Force -ErrorAction Stop
      return
    } catch {
      $LastError = $_.Exception.Message
      if ($Attempt -lt 3) {
        Start-Sleep -Seconds $Attempt
      }
    }
  }

  $Message = "Failed to remove $FullPath after retries: $LastError"
  if ($BestEffort) {
    Write-Warning $Message
    return
  }

  throw $Message
}

function Move-PathWithRetry([string]$From, [string]$To) {
  $FullFrom = Resolve-FullPath $From
  $FullTo = Resolve-FullPath $To
  $LastError = $null

  for ($Attempt = 1; $Attempt -le 10; $Attempt++) {
    try {
      Move-Item -LiteralPath $FullFrom -Destination $FullTo -ErrorAction Stop
      return
    } catch {
      $LastError = $_.Exception.Message
      if ($Attempt -lt 10) {
        Start-Sleep -Seconds 1
      }
    }
  }

  throw "Failed to move $FullFrom to $FullTo after retries: $LastError"
}

function New-BackupPath([string]$BasePath) {
  return "{0}-backup-{1}-{2}" -f $BasePath, (Get-Date -Format "yyyyMMddHHmmss"), $PID
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
    "/XD", ".git", ".github", ".codex-run", "node_modules", "dist", "frontend\dist", "backend\dist", (Join-Path $From "data"),
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
$LegacyBackupDir = "$DeployDir-backup"
$BackupDir = New-BackupPath $DeployDir
$SourceStopScript = Join-Path $SourceDir "scripts\windows\stop.ps1"

if (-not (Test-Path $SourceDir)) {
  throw "SourceDir does not exist: $SourceDir"
}

if ($DeployDir -eq $SourceDir) {
  throw "DeployDir must be different from SourceDir to avoid deleting the runner workspace. DeployDir: $DeployDir"
}

Write-Host "Deploy source: $SourceDir"
Write-Host "Deploy target: $DeployDir"
Write-Host "Deploy backup: $BackupDir"

if (Test-Path $NewDir) {
  Remove-TreeWithRetry $NewDir
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
if (Test-Path $SourceStopScript) {
  Write-Host "Stopping existing service..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $SourceStopScript -Port $Port -RootDir $DeployDir
} elseif (Test-Path $OldStopScript) {
  Write-Host "Stopping existing service..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $OldStopScript -Port $Port
}

$PreviousDeployMoved = $false
$NewDeployMoved = $false

try {
  if (Test-Path $DeployDir) {
    Move-PathWithRetry -From $DeployDir -To $BackupDir
    $PreviousDeployMoved = $true
  }

  Move-PathWithRetry -From $NewDir -To $DeployDir
  $NewDeployMoved = $true

  Set-Location $DeployDir

  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    corepack enable
    corepack prepare pnpm@9.7.0 --activate
  }

  $StartArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $DeployDir "scripts\windows\start.ps1"),
    "-Port",
    $Port,
    "-HostAddress",
    $HostAddress
  )
  if ($BackendOnly) {
    $StartArgs += "-BackendOnly"
  }

  & powershell.exe @StartArgs
  if ($LASTEXITCODE -ne 0) {
    throw "start.ps1 failed with exit code $LASTEXITCODE"
  }

  if (-not $KeepBackup) {
    foreach ($CleanupPath in @($BackupDir, $LegacyBackupDir) | Select-Object -Unique) {
      Remove-TreeWithRetry -Path $CleanupPath -BestEffort
    }
  }

  Write-Host "Deployment finished successfully."
} catch {
  Write-Warning "Deployment failed: $($_.Exception.Message)"
  Set-Location $SourceDir

  if ($NewDeployMoved -and (Test-Path $SourceStopScript)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $SourceStopScript -Port $Port -RootDir $DeployDir
  } elseif ($NewDeployMoved) {
    $CurrentStopScript = Join-Path $DeployDir "scripts\windows\stop.ps1"
    if (Test-Path $CurrentStopScript) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $CurrentStopScript -Port $Port
    }
  }

  if ($NewDeployMoved -and (Test-Path $DeployDir)) {
    Remove-TreeWithRetry $DeployDir
  }

  if ($PreviousDeployMoved -and (Test-Path $BackupDir)) {
    Move-PathWithRetry -From $BackupDir -To $DeployDir
  }

  $RollbackStartScript = Join-Path $DeployDir "scripts\windows\start.ps1"
  if (Test-Path $RollbackStartScript) {
    $RollbackStartArgs = @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      $RollbackStartScript,
      "-Port",
      $Port,
      "-HostAddress",
      $HostAddress,
      "-SkipInstall",
      "-SkipBuild"
    )
    if ($BackendOnly) {
      $RollbackStartArgs += "-BackendOnly"
    }

    & powershell.exe @RollbackStartArgs
  }

  throw
}
