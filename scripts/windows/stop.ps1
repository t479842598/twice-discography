[CmdletBinding()]
param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RunDir = Join-Path $RootDir ".codex-run"
$PidFile = Join-Path $RunDir "twice-discography.pid"

function Stop-ProcessTree([int]$ProcessId) {
  $Children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId ([int]$Child.ProcessId)
  }

  $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($Process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
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

if (-not $Stopped) {
  try {
    $Listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    $OwnerIds = $Listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($OwnerId in $OwnerIds) {
      $Owner = Get-Process -Id $OwnerId -ErrorAction SilentlyContinue
      if ($Owner -and $Owner.ProcessName -in @("node", "pnpm", "cmd", "powershell", "pwsh")) {
        Stop-ProcessTree -ProcessId ([int]$OwnerId)
        Write-Host "Stopped process on port $Port. PID: $OwnerId"
        $Stopped = $true
      }
    }
  } catch {
    Write-Warning "Failed to check process by port: $($_.Exception.Message)"
  }
}

if (-not $Stopped) {
  Write-Host "No running TWICE Discography service found."
}
