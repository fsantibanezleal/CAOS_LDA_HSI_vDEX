# Prepare backend and frontend dependencies for local web work.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install --upgrade pip wheel
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

Push-Location frontend
try {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpm) { pnpm install } else { npm install }
} finally {
    Pop-Location
}
