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
$PreviousReleaseRoot = Join-Path $ReleaseRoot '_previous'
$Manifest = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$Marker = Join-Path $SourceRoot '.buklod-local-canonical.json'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Rotate-Directory([string]$Path, [string]$ArchiveRoot, [string]$Prefix) {
  if (!(Test-Path -LiteralPath $Path -PathType Container)) { return $null }
  EnsureDir $ArchiveRoot
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
  $target = Join-Path $ArchiveRoot ("${Prefix}_${stamp}_${suffix}")
  try {
    [System.IO.Directory]::Move((Full $Path), (Full $target))
  } catch {
    Fail "Could not rotate disposable release staging. Source=$Path Error=$($_.Exception.Message)"
  }
  Write-Host "Previous disposable staging rotated to: $target" -ForegroundColor DarkGray
  return $target
}

if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) { Fail "Canonical SOURCE missing: $SourceRoot" }
if (!(Test-Path -LiteralPath $Manifest -PathType Leaf)) { Fail "Canonical workspace manifest missing. Run scripts\FINALIZE_BUKLOD_CENTRALIZATION.ps1 first: $Manifest" }
if (!(Test-Path -LiteralPath $Marker -PathType Leaf)) { Fail "Canonical local source marker missing. Run scripts\FINALIZE_BUKLOD_CENTRALIZATION.ps1 first: $Marker" }

Write-Host 'BUKLOD CANONICAL WEB RELEASE' -ForegroundColor Cyan
Write-Host "SOURCE   : $SourceRoot"
Write-Host "RECOVERY : $RecoveryPackage"
Write-Host "STAGING  : $ReleaseWork"
Write-Host ''

# 1. Normalize only the canonical SOURCE to current main. No reset/discard.
Push-Location $SourceRoot
try {
  $origin = (& git remote get-url origin).Trim()
  if ($origin -ne $RepoUrl) { Fail "Canonical SOURCE origin mismatch: $origin" }
  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) {
    git status --short
    Fail 'Canonical SOURCE is dirty. No reset/discard was attempted.'
  }
  & git fetch origin --prune
  if ($LASTEXITCODE -ne 0) { Fail 'Could not refresh canonical SOURCE.' }
  & git switch main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
  & git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not update canonical SOURCE main.' }
  $sourceSha = (& git rev-parse HEAD).Trim()
  Write-Host "Canonical source HEAD: $sourceSha" -ForegroundColor Green

  $verifyScript = Join-Path $SourceRoot 'scripts\VERIFY_BUKLOD_CANONICAL_SOURCE.ps1'
  if (!(Test-Path -LiteralPath $verifyScript -PathType Leaf)) { Fail 'Canonical source verification script is missing.' }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyScript -WorkspaceRoot $WorkspaceRoot -RequireCurrentDirectory -RequireClean -RequireMain
  if ($LASTEXITCODE -ne 0) { Fail 'Canonical source verification failed. Deployment stopped.' }
} finally {
  Pop-Location
}

# 2. Refresh approved R31/R40 recovery reference. Never merge this branch wholesale into main.
if (Test-Path -LiteralPath $RecoveryRepo) {
  Remove-Item -LiteralPath $RecoveryRepo -Recurse -Force
}
EnsureDir (Split-Path -Parent $RecoveryRepo)
& git clone --depth 1 --branch $RecoveryBranch --single-branch $RepoUrl $RecoveryRepo
if ($LASTEXITCODE -ne 0) { Fail 'Could not clone approved R31/R40 recovery branch.' }

$RecoveryManifest = Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json'
if (!(Test-Path -LiteralPath $RecoveryManifest -PathType Leaf)) { Fail "Approved recovery manifest missing: $RecoveryManifest" }
$recoveryIdentity = Get-Content -LiteralPath $RecoveryManifest -Raw | ConvertFrom-Json
if ([int]$recoveryIdentity.r40_named_asset_count -lt 168) { Fail "Approved recovery manifest reports incomplete R40 assets: $($recoveryIdentity.r40_named_asset_count)" }
if (@($recoveryIdentity.source_files).Count -lt 11) { Fail 'Approved recovery manifest does not contain the complete R31/R40 source family.' }
Write-Host 'Approved R31/R40 recovery package: VERIFIED' -ForegroundColor Green

# 3. Fresh disposable release staging. Rotate instead of recursively deleting node_modules.
$null = Rotate-Directory $ReleaseWork $PreviousReleaseRoot 'web'
EnsureDir $ReleaseRoot
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
