#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }

if ($env:BUKLOD_CANONICAL_RELEASE -ne '1') {
  Fail 'Canonical release authorization is missing. Start web release only through scripts\RUN_CANONICAL_WEB_RELEASE.ps1.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_WORKSPACE_ROOT)) {
  Fail 'BUKLOD_WORKSPACE_ROOT is missing. Direct deploy invocation is not allowed.'
}

$WorkspaceRoot = Full $env:BUKLOD_WORKSPACE_ROOT
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$ExpectedReleaseWork = Full (Join-Path $WorkspaceRoot 'RELEASE\WEB\current')
$CurrentRoot = Full (Get-Location).Path

if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  Fail "Canonical workspace manifest missing: $ManifestPath"
}
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

if ($manifest.repository -ne $ExpectedRepo) {
  Fail "Workspace manifest repository mismatch: $($manifest.repository)"
}
if ((Full ([string]$manifest.release_web)) -ne (Full (Join-Path $WorkspaceRoot 'RELEASE\WEB'))) {
  Fail 'Workspace release_web identity mismatch.'
}
if ($CurrentRoot -ne $ExpectedReleaseWork) {
  Fail "Wrong deployment root. Expected disposable canonical release staging: $ExpectedReleaseWork; actual: $CurrentRoot"
}

$origin = (& git remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -ne $ExpectedRepo) {
  Fail "Release staging origin mismatch: $origin"
}
$branch = (& git symbolic-ref --short -q HEAD).Trim()
if ($branch -ne 'main') {
  Fail "Production web release requires branch main; actual: $branch"
}
$dirty = @(& git status --porcelain)
if ($dirty.Count -gt 0) {
  Fail 'Disposable release staging is dirty before deployment.'
}

$sourceGuard = Join-Path $CurrentRoot 'scripts\assert-production-source.cjs'
if (!(Test-Path -LiteralPath $sourceGuard -PathType Leaf)) {
  Fail 'Production source identity guard is missing.'
}
& node $sourceGuard
if ($LASTEXITCODE -ne 0) {
  Fail 'Production source identity guard failed.'
}

$implementation = Join-Path $CurrentRoot 'scripts\DEPLOY_GAMES_WEB_DIRECT.ps1'
if (!(Test-Path -LiteralPath $implementation -PathType Leaf)) {
  Fail 'Canonical web deploy implementation is missing.'
}

Write-Host 'BUKLOD_CANONICAL_RELEASE_GUARD: PASS' -ForegroundColor Green
Write-Host "Workspace : $WorkspaceRoot"
Write-Host "Release   : $CurrentRoot"
Write-Host "Origin    : $origin"
Write-Host "Branch    : $branch"
Write-Host ''
Write-Host 'Starting protected web deployment implementation...' -ForegroundColor Cyan

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $implementation
exit $LASTEXITCODE
