param(
  [switch]$Clear,
  [switch]$LanOnly,
  [switch]$TunnelOnly
)

$ErrorActionPreference = 'Stop'

if ($LanOnly -and $TunnelOnly) {
  throw "Use either -LanOnly or -TunnelOnly, not both."
}

$fnmLinkPath = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links'
if (Test-Path $fnmLinkPath) {
  $env:Path = "$fnmLinkPath;$env:Path"
}

if (Get-Command fnm -ErrorAction SilentlyContinue) {
  fnm env --shell powershell | Out-String | Invoke-Expression
  fnm use 22 | Out-Null
} elseif (Get-Command nvm -ErrorAction SilentlyContinue) {
  nvm use 22 | Out-Null
}

$nodeVersion = node -v
Write-Host "Using Node $nodeVersion"

if ($nodeVersion -notmatch '^v22\.') {
  Write-Warning "Node 22.x is recommended for Expo SDK 54. Current: $nodeVersion"
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Stop-ProcessIfRunning([int]$ProcessId, [string]$Reason) {
  if (-not $ProcessId) {
    return
  }

  try {
    $proc = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return
  }

  try {
    Write-Host "Stopping PID $ProcessId ($($proc.ProcessName)) - $Reason"
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
  } catch {
    Write-Warning "Unable to stop PID ${ProcessId}: $($_.Exception.Message)"
  }
}

function Clear-MetroPort([int]$Port = 8081) {
  $listeners = @()

  try {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
  } catch {
    return
  }

  if (-not $listeners -or $listeners.Count -eq 0) {
    return
  }

  $owningProcessIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($ownerProcessId in $owningProcessIds) {
    Stop-ProcessIfRunning -ProcessId $ownerProcessId -Reason "port $Port is in use"
  }
}

function Clear-StaleExpoProcesses() {
  $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
  if (-not $nodeProcesses) {
    return
  }

  foreach ($proc in $nodeProcesses) {
    $cmd = $proc.CommandLine
    if (-not $cmd) {
      continue
    }

    if (
      $cmd -match 'expo(\\|/)bin(\\|/)cli' -or
      $cmd -match '@expo\\cli' -or
      $cmd -match 'expo start'
    ) {
      if ($cmd -match [regex]::Escape($projectRoot)) {
        Stop-ProcessIfRunning -ProcessId $proc.ProcessId -Reason 'stale Expo process for this project'
      }
    }
  }
}

function Clear-StaleTunnelProcesses() {
  # Kill any stale ngrok or tunnel-related processes
  Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-ProcessIfRunning -ProcessId $_.Id -Reason 'stale ngrok tunnel process'
  }
}

Write-Host 'Cleaning stale Metro/Expo state...'
Clear-StaleExpoProcesses
Clear-StaleTunnelProcesses
Clear-MetroPort -Port 8081
Start-Sleep -Seconds 1

function Start-Expo([string]$Mode) {
  $args = @('.\\node_modules\\expo\\bin\\cli', 'start', "--$Mode", '--port', '8081')
  if ($Clear) {
    $args += '--clear'
  }

  Write-Host "Starting Expo in $Mode mode..."
  
  # Configure ngrok for tunnel mode
  if ($Mode -eq 'tunnel') {
    $env:NGROK_SKIP_BROWSER_LAUNCH = 'true'
    # Increase ngrok timeout and connection settings significantly
    $env:RN_TUNNEL_TIMEOUT = '180000'  # 180 seconds in milliseconds
    $env:NGROK_TIMEOUT = '180'
    # Additional Expo tunnel timeout
    $env:EXPO_TUNNEL_CONNECTION_TIMEOUT = '180000'
    # Help ngrok work around network issues
    $env:RPORT = '443'
    # Disable IPv6 if causing issues
    $env:NGROK_LOG = $null
    Write-Host "Ngrok timeout set to 180 seconds for tunnel mode"
  }
  
  & node @args | Out-Host
  return $LASTEXITCODE
}

function Start-TunnelWithRetry([int]$MaxAttempts = 2) {
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    if ($attempt -gt 1) {
      $delaySeconds = 5 * $attempt
      Write-Host "Retrying Expo tunnel (attempt $attempt of $MaxAttempts)..."
      Write-Host "Waiting ${delaySeconds}s before retry (ngrok connectivity issue)..."
      Clear-StaleExpoProcesses
      Clear-StaleTunnelProcesses
      Clear-MetroPort -Port 8081
      Start-Sleep -Seconds $delaySeconds
    } else {
      Write-Host "Attempting tunnel connection (first attempt, ngrok timeout is 180 seconds)..."
    }

    $tunnelExit = Start-Expo 'tunnel'
    if ($tunnelExit -eq 0) {
      return 0
    }

    if ($attempt -lt $MaxAttempts) {
      Write-Warning "Expo tunnel failed on attempt $attempt (exit code $tunnelExit). ngrok connection timeout may have occurred."
    } else {
      return $tunnelExit
    }
  }

  return 1
}

if ($LanOnly) {
  $lanExit = Start-Expo 'lan'
  exit $lanExit
}

if ($TunnelOnly) {
  Write-Host "Attempting to establish ngrok tunnel..."
  Write-Host "Note: If tunnel times out repeatedly, your network may be blocking ngrok."
  $tunnelExit = Start-TunnelWithRetry
  if ($tunnelExit -ne 0) {
    Write-Error "Tunnel could not be established after retries."
    Write-Host "Possible causes:"
    Write-Host "  - Firewall/proxy blocking ngrok connections"
    Write-Host "  - Network connectivity issues"
    Write-Host "  - ngrok service unavailable"
    Write-Host ""
    Write-Host "Try these troubleshooting steps:"
    Write-Host "  1. Check your firewall settings for ngrok ports (typically 443)"
    Write-Host "  2. Try: npm run start:lan  (LAN mode instead)"
    Write-Host "  3. Restart your router/connection"
    Write-Host "  4. Check if ngrok is accessible: curl -I https://ngrok.com"
  }
  exit $tunnelExit
}

$tunnelExit = Start-TunnelWithRetry
if ($tunnelExit -eq 0) {
  exit 0
}

Write-Warning "Expo tunnel failed (exit code $tunnelExit). Falling back to LAN mode."
$lanExit = Start-Expo 'lan'
exit $lanExit
