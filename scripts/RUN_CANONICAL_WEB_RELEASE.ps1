#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$RecoveryBranch = 'recovery/r31-r40-approved-local-20260910'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$RecoveryRepo = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40_APPROVED'
$RecoveryPackage = Join-Path $RecoveryRepo 'recovery-import\r31-r40'
$ReleaseRoot = Join-Path $WorkspaceRoot 'RELEASE\WEB'
$ReleaseWork = Join-Path $ReleaseRoot 'current'
$Manifest = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }

if (!(Test-Path -LiteralPath $Manifest -PathType Leaf)) {
  Fail "Canonical workspace is not initialized. Missing: $Manifest"
}
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  Fail "Canonical SOURCE missing: $SourceRoot"
}

$workspaceIdentity = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
if ($workspaceIdentity.repository -ne $RepoUrl) {
  Fail "Workspace manifest repository mismatch: $($workspaceIdentity.repository)"
}
if ((Full ([string]$workspaceIdentity.canonical_source)) -ne (Full $SourceRoot)) {
  Fail 'Workspace manifest canonical_source does not match SOURCE\BUKLOD-MAIN.'
}
if ((Full ([string]$workspaceIdentity.release_web)) -ne (Full $ReleaseRoot)) {
  Fail 'Workspace manifest release_web does not match RELEASE\WEB.'
}

Write-Host 'BUKLOD CANONICAL WEB RELEASE' -ForegroundColor Cyan
Write-Host "SOURCE   : $SourceRoot"
Write-Host "RECOVERY : $RecoveryPackage"
Write-Host "STAGING  : $ReleaseWork"
Write-Host ''

# 1. Canonical source must be clean and on current main. Never build from random clones.
Push-Location $SourceRoot
try {
  $origin = (& git remote get-url origin).Trim()
  if ($origin -ne $RepoUrl) { Fail "Canonical SOURCE origin mismatch: $origin" }

  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) {
    git status --short
    Fail 'Canonical SOURCE is dirty. No reset/discard was attempted.'
  }

  & git switch main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }

  & git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not update canonical SOURCE main.' }

  $sourceSha = (& git rev-parse HEAD).Trim()
  Write-Host "Canonical source HEAD: $sourceSha" -ForegroundColor Green
} finally {
  Pop-Location
}

# 2. Refresh the approved R31/R40 recovery package from its dedicated review branch.
# This is reference/recovery material only; it is never merged wholesale into main.
if (Test-Path -LiteralPath $RecoveryRepo) {
  Remove-Item -LiteralPath $RecoveryRepo -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RecoveryRepo) | Out-Null

& git clone --depth 1 --branch $RecoveryBranch --single-branch $RepoUrl $RecoveryRepo
if ($LASTEXITCODE -ne 0) { Fail 'Could not clone approved R31/R40 recovery branch.' }

$RecoveryManifest = Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json'
if (!(Test-Path -LiteralPath $RecoveryManifest -PathType Leaf)) {
  Fail "Approved recovery manifest missing: $RecoveryManifest"
}
$recoveryIdentity = Get-Content -LiteralPath $RecoveryManifest -Raw | ConvertFrom-Json
if ([int]$recoveryIdentity.r40_named_asset_count -lt 168) {
  Fail "Approved recovery manifest reports incomplete R40 assets: $($recoveryIdentity.r40_named_asset_count)"
}
if (@($recoveryIdentity.source_files).Count -lt 11) {
  Fail 'Approved recovery manifest does not contain the complete R31/R40 source family.'
}
Write-Host 'Approved R31/R40 recovery package: VERIFIED' -ForegroundColor Green

# 3. Build/deploy only from a fresh disposable clone of main.
if (Test-Path -LiteralPath $ReleaseWork) {
  Remove-Item -LiteralPath $ReleaseWork -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

& git clone --branch main --single-branch $RepoUrl $ReleaseWork
if ($LASTEXITCODE -ne 0) { Fail 'Could not create disposable release staging clone.' }

$env:BUKLOD_CANONICAL_RELEASE = '1'
$env:BUKLOD_WORKSPACE_ROOT = Full $WorkspaceRoot
$env:BUKLOD_R31_R40_RECOVERY_ROOT = Full $RecoveryPackage

Push-Location $ReleaseWork
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\DEPLOY_BUKLOD_WEB_CANONICAL.ps1'
  exit $LASTEXITCODE
} finally {
  Pop-Location
  Remove-Item Env:\BUKLOD_CANONICAL_RELEASE -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_WORKSPACE_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_R31_R40_RECOVERY_ROOT -ErrorAction SilentlyContinue
}
