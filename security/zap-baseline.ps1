param(
  [string]$BaseUrl = 'http://host.docker.internal:3000',
  [string]$Image = 'zaproxy/zap-stable'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$results = Join-Path $repo 'results\zap'
New-Item -ItemType Directory -Force -Path $results | Out-Null

docker run --rm -t `
  -v "${results}:/zap/wrk/:rw" `
  $Image zap-baseline.py `
  -t $BaseUrl `
  -r zap-baseline.html `
  -J zap-baseline.json `
  -m 5

Write-Host "ZAP reports: $results\zap-baseline.html and $results\zap-baseline.json"
