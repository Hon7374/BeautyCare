# Generate self-signed TLS cert for localhost (Windows PowerShell)
# Requires OpenSSL in PATH.

$ErrorActionPreference = "Stop"

$certDir = Join-Path $PSScriptRoot "..\certs"
if (!(Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

$key = Join-Path $certDir "localhost.key"
$crt = Join-Path $certDir "localhost.crt"

Write-Host "Generating self-signed cert to $certDir"
openssl req -x509 -newkey rsa:2048 -nodes -keyout $key -out $crt -days 365 -subj "/CN=localhost"

Write-Host "Done. Files:"
Write-Host " - $key"
Write-Host " - $crt"
