$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

# Local runtime only: do not change the user's backend/.env or primary DB.
$env:PORT = '3000'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3411'
$env:DB_USER = 'root'
$env:DB_PASSWORD = ''
$env:DB_NAME = 'beautycare'
$env:API_BASE_URL = 'http://127.0.0.1:3000'
$env:FRONTEND_URL = 'http://127.0.0.1:3000'
$env:PUBLIC_APP_URL = 'http://127.0.0.1:3000'
$env:CORS_ORIGINS = 'http://127.0.0.1:3000'
$env:AUTH_DEMO_MODE = 'false'
$env:EMAIL_DELIVERY_MODE = 'smtp'
$env:EMAIL_FALLBACK_TO_OUTBOX = 'false'
$env:PAYMENTS_MODE = 'real'

& 'E:\node.exe' server.js
