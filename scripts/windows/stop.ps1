[CmdletBinding()]
param(
  [int]$Port = 3000,
  [string]$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$ErrorActionPreference = "Stop"

$RootDir = [System.IO.Path]::GetFullPath($RootDir)
$RunDir = Join-Path $RootDir ".codex-run"
$PidFile = Join-Path $RunDir "twice-discography.pid"
$ServiceProcessNames = @("node.exe", "pnpm.exe", "cmd.exe", "powershell.exe", "pwsh.exe")

function Stop-ProcessTree([int]$ProcessId) {
  $Children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId ([int]$Child.ProcessId)
  }

  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($Process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction SilentlyContinue
  }
}

function Test-CommandLineReferencesRoot([string]$CommandLine) {
  if (-not $CommandLine) {
    return $false
  }

  return $CommandLine.IndexOf($RootDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-RootProcessReferences {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessId -ne $PID -and
      $_.Name -in $ServiceProcessNames -and
      (Test-CommandLineReferencesRoot $_.CommandLine)
    }
}

function Stop-RootProcessReferences {
  $StoppedAny = $false
  $Processes = @(Get-RootProcessReferences)
  foreach ($Process in $Processes) {
    Stop-ProcessTree -ProcessId ([int]$Process.ProcessId)
    Write-Host "Stopped process referencing $RootDir. PID: $($Process.ProcessId)"
    $StoppedAny = $true
  }

  return $StoppedAny
}

function Test-PortAvailable($PortNumber) {
  try {
    $Listeners = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
    return -not $Listeners
  } catch {
    return $true
  }
}

function Get-PortProcessReferences {
  try {
    $Listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    $OwnerIds = @($Listeners | ForEach-Object { $_.OwningProcess } | Select-Object -Unique)
    foreach ($OwnerId in $OwnerIds) {
      Get-CimInstance Win32_Process -Filter "ProcessId = $OwnerId" -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessId -ne $PID -and $_.Name -in $ServiceProcessNames }
    }
  } catch {
    Write-Warning "Failed to check process by port: $($_.Exception.Message)"
  }
}

function Stop-PortProcessReferences {
  $StoppedAny = $false
  $Processes = @(Get-PortProcessReferences)
  foreach ($Process in $Processes) {
    Stop-ProcessTree -ProcessId ([int]$Process.ProcessId)
    Write-Host "Stopped process on port $Port. PID: $($Process.ProcessId)"
    $StoppedAny = $true
  }

  return $StoppedAny
}

function Wait-ServiceReleased {
  for ($Attempt = 1; $Attempt -le 20; $Attempt++) {
    $RemainingRootProcesses = @(Get-RootProcessReferences)
    $RemainingPortProcesses = @(Get-PortProcessReferences)
    if ((Test-PortAvailable $Port) -and $RemainingRootProcesses.Count -eq 0 -and $RemainingPortProcesses.Count -eq 0) {
      return
    }

    $RemainingProcesses = @($RemainingRootProcesses + $RemainingPortProcesses) |
      Sort-Object -Property ProcessId -Unique
    foreach ($Process in $RemainingProcesses) {
      Stop-ProcessTree -ProcessId ([int]$Process.ProcessId)
    }

    Start-Sleep -Seconds 1
  }

  throw "Service did not release port $Port or root $RootDir after waiting."
}

$Stopped = $false

if (Test-Path $PidFile) {
  $SavedPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($SavedPid) {
    $Process = Get-Process -Id $SavedPid -ErrorAction SilentlyContinue
    if ($Process) {
      Stop-ProcessTree -ProcessId ([int]$SavedPid)
      Write-Host "Stopped TWICE Discography. PID: $SavedPid"
      $Stopped = $true
    }
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

if (Stop-PortProcessReferences) {
  $Stopped = $true
}

if (Stop-RootProcessReferences) {
  $Stopped = $true
}

if ($Stopped) {
  Wait-ServiceReleased
}

if (-not $Stopped) {
  Write-Host "No running TWICE Discography service found."
}
