# Prepare both local environments.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

& "$PSScriptRoot\\setup-web.ps1"
& "$PSScriptRoot\\setup-pipeline.ps1"
