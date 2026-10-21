$ErrorActionPreference = 'Stop'

$demoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir = Join-Path $demoDir '.venv'
$pythonExe = Join-Path $venvDir 'Scripts\python.exe'
$requirementsFile = Join-Path $demoDir 'requirements.txt'
$scriptFile = Join-Path $demoDir 'full_demo.py'
$videoFile = Join-Path $demoDir 'beautycare-full-demo.mkv'
$readmeFile = Join-Path $demoDir 'README-full-demo.md'
$resultsFile = Join-Path $demoDir 'demo-results.md'

function Test-DemoFfmpeg {
  if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { return $true }

  $paths = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName

  return [bool]($paths | Select-Object -First 1)
}

if (-not (Test-Path $venvDir)) {
  py -3 -m venv $venvDir
}

& $pythonExe -m pip install --disable-pip-version-check -r $requirementsFile

if (-not (Test-DemoFfmpeg)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements --silent
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install ffmpeg -y
  } else {
    throw 'ffmpeg is missing and neither winget nor choco is available to install it automatically.'
  }
}

& $pythonExe $scriptFile

if ($LASTEXITCODE -eq 0) {
  if (Test-Path $videoFile) {
    Start-Process -FilePath $videoFile
  }

  if (Test-Path $readmeFile) {
    Start-Process -FilePath $readmeFile
  }

  if (Test-Path $resultsFile) {
    Start-Process -FilePath $resultsFile
  }
}
