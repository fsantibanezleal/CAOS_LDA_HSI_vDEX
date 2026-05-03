# Prepare the local data-pipeline environment.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root
$RepoVenv = Join-Path $Root ".venv-pipeline"
$ShortVenvRoot = Join-Path $env:LOCALAPPDATA "caos-lda-hsi\venvs"
$ShortVenvTarget = Join-Path $ShortVenvRoot "pipeline"

if (-not (Test-Path $RepoVenv)) {
    New-Item -ItemType Directory -Path $ShortVenvRoot -Force | Out-Null
    if (-not (Test-Path $ShortVenvTarget)) {
        python -m venv $ShortVenvTarget
    }
    cmd /c mklink /J "$RepoVenv" "$ShortVenvTarget" | Out-Null
}

& .\.venv-pipeline\Scripts\python.exe -m pip install --upgrade pip "setuptools<82" wheel
& .\.venv-pipeline\Scripts\python.exe -m pip install -r data-pipeline\requirements.txt
