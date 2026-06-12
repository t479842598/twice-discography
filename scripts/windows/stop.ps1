[CmdletBinding()]
param(
  [int]$Port = 3000,
  [string]$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$ErrorActionPreference = "Stop"

$RootDir = [System.IO.Path]::GetFullPath($RootDir)
function Get-ProcessById([int]$ProcessId) {
  Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

$RunDir = Join-Path $RootDir ".codex-run"
$PidFile = Join-Path $RunDir "twice-discography.pid"
$ServiceProcessNames = @("node.exe", "pnpm.exe", "cmd.exe", "powershell.exe", "pwsh.exe")
$ProtectedProcessIds = @([int]$PID)
$ProtectedProcess = Get-ProcessById -ProcessId ([int]$PID)
while ($ProtectedProcess -and $ProtectedProcess.ParentProcessId) {
  $ProtectedParent = Get-ProcessById -ProcessId ([int]$ProtectedProcess.ParentProcessId)
  if (-not $ProtectedParent) {
    break
  }

  $ProtectedProcessIds += [int]$ProtectedParent.ProcessId
  $ProtectedProcess = $ProtectedParent
}
$ProtectedProcessIds = @($ProtectedProcessIds | Select-Object -Unique)

function Stop-ProcessTree([int]$ProcessId) {
  if ($ProtectedProcessIds -contains $ProcessId) {
    return
  }

  $Children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId ([int]$Child.ProcessId)
  }

  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($Process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction SilentlyContinue
  }

  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    try {
      & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null
    } catch {
      # The process may have exited between the check and taskkill.
    }
    Wait-Process -Id $ProcessId -Timeout 5 -ErrorAction SilentlyContinue
  }
}

function Get-ServiceProcessFamily($Process) {
  $Family = @($Process)
  $Current = $Process

  while ($Current -and $Current.ParentProcessId) {
    $Parent = Get-ProcessById -ProcessId ([int]$Current.ParentProcessId)
    if (-not $Parent) {
      break
    }
    if (($ProtectedProcessIds -contains [int]$Parent.ProcessId) -or $Parent.Name -notin $ServiceProcessNames) {
      break
    }

    $Family += $Parent
    $Current = $Parent
  }

  $Family |
    Where-Object { -not ($ProtectedProcessIds -contains [int]$_.ProcessId) } |
    Sort-Object -Property ProcessId -Unique
}

function Stop-ServiceProcessFamily($Process, [string]$Reason) {
  $Family = @(Get-ServiceProcessFamily $Process)
  foreach ($Target in $Family) {
    Stop-ProcessTree -ProcessId ([int]$Target.ProcessId)
    Write-Host "Stopped $Reason. PID: $($Target.ProcessId) Name: $($Target.Name)"
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
      -not ($ProtectedProcessIds -contains [int]$_.ProcessId) -and
      $_.Name -in $ServiceProcessNames -and
      (Test-CommandLineReferencesRoot $_.CommandLine)
    }
}

function Stop-RootProcessReferences {
  $StoppedAny = $false
  $Processes = @(Get-RootProcessReferences)
  foreach ($Process in $Processes) {
    Stop-ServiceProcessFamily -Process $Process -Reason "process referencing $RootDir"
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
        Where-Object {
          -not ($ProtectedProcessIds -contains [int]$_.ProcessId) -and
          $_.Name -in $ServiceProcessNames
        }
    }
  } catch {
    Write-Warning "Failed to check process by port: $($_.Exception.Message)"
  }
}

function Stop-PortProcessReferences {
  $StoppedAny = $false
  $Processes = @(Get-PortProcessReferences)
  foreach ($Process in $Processes) {
    Stop-ServiceProcessFamily -Process $Process -Reason "process on port $Port"
    $StoppedAny = $true
  }

  return $StoppedAny
}

function Write-RemainingProcesses {
  $RemainingPortProcesses = @(Get-PortProcessReferences)
  foreach ($Process in $RemainingPortProcesses) {
    Write-Warning "Remaining process on port $Port. PID: $($Process.ProcessId) Name: $($Process.Name) CommandLine: $($Process.CommandLine)"
  }

  $RemainingRootProcesses = @(Get-RootProcessReferences)
  foreach ($Process in $RemainingRootProcesses) {
    Write-Warning "Remaining process referencing $RootDir. PID: $($Process.ProcessId) Name: $($Process.Name) CommandLine: $($Process.CommandLine)"
  }
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
      Stop-ServiceProcessFamily -Process $Process -Reason "remaining service process"
    }

    Start-Sleep -Seconds 1
  }

  Write-RemainingProcesses
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
