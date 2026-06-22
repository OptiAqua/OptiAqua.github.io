#!/usr/bin/env pwsh
<#
.SYNOPSIS
    OptiAqua one-command commit & push script.

.EXAMPLE
    .\push.ps1 "feat: add sales chart"
    .\push.ps1 "fix: HR table not loading"
    .\push.ps1 "docs: update README"
#>

param(
    [Parameter(Mandatory, Position=0)]
    [string]$Message
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  [1/4] Updating changelog..." -ForegroundColor Cyan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Update-Changelog.ps1" -Mode append

Write-Host "  [2/4] Staging all changes..." -ForegroundColor Cyan
git add .

Write-Host "  [3/4] Committing: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "  [4/4] Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "  Done! Live at: https://optiaqua.github.io/" -ForegroundColor Green
Write-Host ""
