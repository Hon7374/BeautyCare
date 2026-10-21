[CmdletBinding()]
param(
  [int[]]$Profiles = @(100, 200, 300),
  [int]$Repetitions = 3,
  [string]$Duration = '5m',
  [switch]$AllowOverloadProfiles,
  [switch]$KeepDatabase
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$container = 'beautycare-iccit-mysql-test'
$mysqlHostPort = 13310
$database = 'beautycare_test'
$results = Join-Path $workspace 'results\iccIT-replication'
$backendProcess = $null
$createdContainer = $false

function Fail([string]$message) {
  throw "BLOCKED: $message"
}

function Invoke-Docker([string[]]$DockerArgs) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker @DockerArgs 2>&1
  $ErrorActionPreference = $previousPreference
  if ($output) { $output | Write-Host }
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: docker $($DockerArgs -join ' ')" }
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail 'Docker CLI is not installed.' }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Fail 'Docker daemon is not running.' }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is not installed.' }
  if (-not (Test-Path (Join-Path $workspace 'backend\node_modules'))) { Fail 'backend dependencies are not installed.' }
  if (-not (Test-Path (Join-Path $workspace 'database\beautycare.mysql.sql'))) { Fail 'MySQL schema is missing.' }
  $allowedProfiles = if ($AllowOverloadProfiles) { @(100,200,300,400,500) } else { @(100,200,300) }
  if ($Profiles | Where-Object { $_ -notin $allowedProfiles }) { Fail 'Profiles 400/500 require -AllowOverloadProfiles.' }
  if ($Repetitions -lt 1 -or $Repetitions -gt 3) { Fail 'Repetitions must be between 1 and 3.' }

  New-Item -ItemType Directory -Force -Path $results | Out-Null
  if ((docker ps -a --format '{{.Names}}') -contains $container) { Fail "Container $container already exists; remove/inspect it manually before retrying." }

  Write-Host 'Creating disposable MySQL test container...'
  Invoke-Docker -DockerArgs @('run','-d','--name',$container,'-e','MYSQL_ROOT_PASSWORD=iccIT_test_only','-e','MYSQL_DATABASE=beautycare_test','-p',"${mysqlHostPort}:3306",'mysql:8.4')
  $createdContainer = $true

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $probe = docker exec $container mysql -uroot -piccIT_test_only -e 'SELECT 1' 2>&1
    $probeExit = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    if ($probeExit -eq 0) { $ready = $true; break }
  }
  if (-not $ready) { Fail 'Disposable MySQL container did not become ready within 120 seconds.' }

  $schemaContainerPath = '/tmp/beautycare.mysql.sql'
  Invoke-Docker -DockerArgs @('cp',(Join-Path $workspace 'database\beautycare.mysql.sql'),"${container}:${schemaContainerPath}")
  Invoke-Docker -DockerArgs @('exec',$container,'mysql','-uroot','-piccIT_test_only','beautycare_test','-e',"source $schemaContainerPath")

  $old = @{}
  foreach ($name in @('DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','NODE_ENV','PERF_TEST','PERF_TEST_RATE_LIMIT','PUBLIC_APP_URL','PORT')) {
    $old[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
  }
  $env:DB_HOST = '127.0.0.1'; $env:DB_PORT = "$mysqlHostPort"; $env:DB_NAME = $database
  $env:DB_USER = 'root'; $env:DB_PASSWORD = 'iccIT_test_only'; $env:NODE_ENV = 'development'
  $env:PERF_TEST = 'true'; $env:PERF_TEST_RATE_LIMIT = '1000000'; $env:PUBLIC_APP_URL = 'http://127.0.0.1:3010'; $env:PORT = '3010'

  Write-Host 'Starting backend on localhost:3010...'
  $backendLogDir = Join-Path $results 'backend-startup'
  New-Item -ItemType Directory -Force -Path $backendLogDir | Out-Null
  $backendStdout = Join-Path $backendLogDir 'stdout.log'
  $backendStderr = Join-Path $backendLogDir 'stderr.log'
  $backendProcess = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory (Join-Path $workspace 'backend') -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendStdout -RedirectStandardError $backendStderr
  $healthy = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if ($backendProcess.HasExited) {
      $details = (Get-Content $backendStderr -Raw -ErrorAction SilentlyContinue)
      if (-not $details) { $details = (Get-Content $backendStdout -Raw -ErrorAction SilentlyContinue) }
      Fail "Backend exited before health check. See $backendLogDir. $details"
    }
    try { $h = Invoke-WebRequest 'http://127.0.0.1:3010/api/health' -UseBasicParsing -TimeoutSec 2; if ($h.StatusCode -eq 200) { $healthy = $true; break } } catch {}
  }
  if (-not $healthy) { Fail 'Backend health endpoint did not become ready.' }

  foreach ($vus in $Profiles) {
    for ($run = 1; $run -le $Repetitions; $run++) {
      $out = Join-Path $results ("k6-load-{0}vus-run{1}.json" -f $vus,$run)
      Write-Host "Running $vus VU, repetition $run/$Repetitions. Output: $out"
      $relativeOut = 'results/iccIT-replication/' + (Split-Path $out -Leaf)
      & docker run --rm --add-host=host.docker.internal:host-gateway -v "${workspace}:/work" -w /work grafana/k6 run -e BASE_URL=http://host.docker.internal:3010 -e VUS=$vus -e DURATION=$Duration performance/k6-load.js
      $k6Exit = $LASTEXITCODE
      $default = Join-Path $workspace ("results\k6-load-{0}vus.json" -f $vus)
      if (Test-Path $default) { Move-Item -LiteralPath $default -Destination $out -Force }
      if (-not (Test-Path $out)) { Fail "Expected k6 summary was not produced: $out" }
      if ($k6Exit -ne 0) { Fail "k6 failed at ${vus} VU repetition ${run}; summary preserved at $out." }
    }
  }
  Write-Host "COMPLETED: results saved under $results"
}
finally {
  if ($backendProcess -and -not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -Force }
  if ($createdContainer -and -not $KeepDatabase) { docker rm -f $container *> $null }
}
