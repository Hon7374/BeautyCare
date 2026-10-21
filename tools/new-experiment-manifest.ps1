[CmdletBinding()]
param(
  [ValidateSet('Check','Start','Finalize')][string]$Mode = 'Check',
  [string]$RunId,
  [int]$Vus,
  [int]$DurationSeconds,
  [string]$TargetEndpoint = 'http://127.0.0.1:3010/api/services',
  [string]$ResultPath,
  [string]$ConsoleLogPath,
  [ValidateSet('PASS','FAIL','INTERRUPTED','UNKNOWN')][string]$Status = 'UNKNOWN',
  [string]$ErrorSummary = '',
  [string]$OutputRoot = 'results/experiment-manifests'
)

$ErrorActionPreference = 'Stop'
$workspace = (Get-Location).Path
$scriptPath = Join-Path $workspace 'performance/k6-load.js'
$backendPackagePath = Join-Path $workspace 'backend/package.json'

function Redact([object]$Value) {
  if ($null -eq $Value) { return $null }
  $text = [string]$Value
  if ($text -match '(?i)(password|secret|token|key|cookie|authorization)') { return '[REDACTED]' }
  return $text
}

function Get-EnvironmentSnapshot {
  $nodeVersion = (& node --version 2>$null).Trim()
  $npmVersion = (& npm --version 2>$null).Trim()
  $dockerVersion = (& docker version --format '{{.Server.Version}}' 2>$null).Trim()
  $k6Version = 'containerized; host k6 not required'
  $package = Get-Content $backendPackagePath -Raw | ConvertFrom-Json
  $envNames = @('NODE_ENV','PERF_TEST','PUBLIC_APP_URL','PORT','DB_HOST','DB_PORT','DB_NAME','DB_POOL_SIZE','PERF_TEST_DB_POOL_SIZE','PERF_TEST_RATE_LIMIT')
  $environment = [ordered]@{}
  foreach ($name in $envNames) {
    $environment[$name] = Redact (Get-Item "Env:$name" -ErrorAction SilentlyContinue | ForEach-Object { $_.Value })
  }
  return [ordered]@{
    captured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    node_version = $nodeVersion
    npm_version = $npmVersion
    docker_server_version = $dockerVersion
    k6_version = $k6Version
    backend_package_version = $package.version
    backend_package_name = $package.name
    environment_variables = $environment
    secrets_included = $false
  }
}

function Get-RunDirectory {
  if ([string]::IsNullOrWhiteSpace($RunId)) { throw 'RunId is required for Start and Finalize.' }
  $dir = Join-Path $workspace (Join-Path $OutputRoot $RunId)
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Write-JsonFile([string]$Path, [object]$Value) {
  $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

if (-not (Test-Path $scriptPath)) { throw "Missing benchmark script: $scriptPath" }
if (-not (Test-Path $backendPackagePath)) { throw "Missing backend package: $backendPackagePath" }

$scriptHash = (Get-FileHash $scriptPath -Algorithm SHA256).Hash

if ($Mode -eq 'Check') {
  $snapshot = Get-EnvironmentSnapshot
  [ordered]@{
    mode = 'Check'
    load_test_executed = $false
    script = 'performance/k6-load.js'
    script_sha256 = $scriptHash
    environment = $snapshot
    required_inputs = @('RunId for Start/Finalize','Vus','DurationSeconds','ResultPath after k6 completes')
  } | ConvertTo-Json -Depth 8
  exit 0
}

if ($Vus -lt 1 -or $DurationSeconds -lt 1) { throw 'Vus and DurationSeconds must be positive.' }
$dir = Get-RunDirectory
$manifestPath = Join-Path $dir 'manifest.json'

if ($Mode -eq 'Start') {
  if (Test-Path $manifestPath) { throw "Manifest already exists: $manifestPath" }
  $manifest = [ordered]@{
    run_id = $RunId
    status = 'RUNNING'
    started_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    ended_at_utc = $null
    target_endpoint = $TargetEndpoint
    vus = $Vus
    duration_seconds = $DurationSeconds
    script = 'performance/k6-load.js'
    script_sha256 = $scriptHash
    result_path = $ResultPath
    console_log_path = $ConsoleLogPath
    result_sha256 = $null
    console_log_sha256 = $null
    backend_version = (Get-Content $backendPackagePath -Raw | ConvertFrom-Json).version
    environment_identifier = 'localhost-disposable-test'
    error_summary = ''
    files = @('manifest.json','environment.json','script-sha256.txt','backend-version.txt','run-notes.md')
  }
  Write-JsonFile $manifestPath $manifest
  Write-JsonFile (Join-Path $dir 'environment.json') (Get-EnvironmentSnapshot)
  "$scriptHash  performance/k6-load.js" | Set-Content (Join-Path $dir 'script-sha256.txt') -Encoding UTF8
  "BeautyCare backend package version $($manifest.backend_version)" | Set-Content (Join-Path $dir 'backend-version.txt') -Encoding UTF8
  "Run started by manifest tool. This tool does not execute k6 or any load test." | Set-Content (Join-Path $dir 'run-notes.md') -Encoding UTF8
  Write-Host "Manifest started: $manifestPath"
  exit 0
}

if (-not (Test-Path $manifestPath)) { throw "Manifest not found: $manifestPath" }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.status = $Status
$manifest.ended_at_utc = (Get-Date).ToUniversalTime().ToString('o')
$manifest.error_summary = $ErrorSummary
$manifest.result_sha256 = if ($ResultPath -and (Test-Path $ResultPath)) { (Get-FileHash $ResultPath -Algorithm SHA256).Hash } else { $null }
$manifest.console_log_sha256 = if ($ConsoleLogPath -and (Test-Path $ConsoleLogPath)) { (Get-FileHash $ConsoleLogPath -Algorithm SHA256).Hash } else { $null }
Write-JsonFile $manifestPath $manifest
Write-Host "Manifest finalized: $manifestPath"
