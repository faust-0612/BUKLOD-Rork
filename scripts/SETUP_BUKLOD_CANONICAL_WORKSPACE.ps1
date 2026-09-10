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
$BackupRoot = Join-Path $WorkspaceRoot 'BACKUPS'
$LogRoot = Join-Path $WorkspaceRoot 'LOGS'
$ExportRoot = Join-Path $WorkspaceRoot 'EXPORTS'
$QuarantineRoot = Join-Path $WorkspaceRoot 'LEGACY_QUARANTINE'
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$MarkerPath = Join-Path $SourceRoot '.buklod-local-canonical.json'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD CENTRALIZED CANONICAL WORKSPACE SETUP' -ForegroundColor Cyan
Write-Host ' ONE SOURCE + APPROVED RECOVERY + DISPOSABLE RELEASE STAGING' -ForegroundColor Cyan
Write-Host '====================================================================' -ForegroundColor Cyan

foreach ($dir in @($WorkspaceRoot,$ReleaseRoot,$BackupRoot,$LogRoot,$ExportRoot,$QuarantineRoot,(Split-Path -Parent $SourceRoot),(Split-Path -Parent $RecoveryRepo))) { EnsureDir $dir }

Write-Host '1/4 PREPARE CANONICAL SOURCE' -ForegroundColor Cyan
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  & git clone $RepoUrl $SourceRoot
  if ($LASTEXITCODE -ne 0) { Fail 'Could not clone canonical BUKLOD source.' }
} else {
  $origin = (& git -C $SourceRoot remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or $origin -ne $RepoUrl) { Fail "Canonical source origin mismatch: $origin" }
  $dirty = @(& git -C $SourceRoot status --porcelain)
  if ($dirty.Count -gt 0) {
    & git -C $SourceRoot status --short
    Fail 'Canonical SOURCE has local changes. No reset/discard performed.'
  }
}
& git -C $SourceRoot switch main
if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
& git -C $SourceRoot pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { Fail 'Could not fast-forward canonical SOURCE main.' }
$sourceHead = (& git -C $SourceRoot rev-parse HEAD).Trim()

Write-Host '2/4 PREPARE APPROVED R31/R40 RECOVERY REFERENCE' -ForegroundColor Cyan
if (!(Test-Path -LiteralPath $RecoveryRepo -PathType Container)) {
  & git clone --depth 1 --branch $RecoveryBranch --single-branch $RepoUrl $RecoveryRepo
  if ($LASTEXITCODE -ne 0) { Fail 'Could not clone approved R31/R40 recovery branch.' }
} else {
  $recoveryOrigin = (& git -C $RecoveryRepo remote get-url origin 2>$null).Trim()
  if ($recoveryOrigin -ne $RepoUrl) { Fail "Recovery repository origin mismatch: $recoveryOrigin" }
}
$recoveryManifestPath = Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json'
if (Test-Path -LiteralPath $recoveryManifestPath -PathType Leaf) {
  $recoveryManifest = Get-Content -LiteralPath $recoveryManifestPath -Raw | ConvertFrom-Json
  if ([int]$recoveryManifest.r40_named_asset_count -lt 168) { Fail 'Approved recovery package is incomplete.' }
  Write-Host 'Approved R31/R40 recovery manifest: VERIFIED' -ForegroundColor Green
} else {
  Write-Host 'Recovery clone exists but package manifest is unavailable; canonical release will refresh it before any deploy.' -ForegroundColor Yellow
}

Write-Host '3/4 WRITE WORKSPACE IDENTITY' -ForegroundColor Cyan
$manifest = [ordered]@{
  workspace_version = 3
  created_at = (Get-Date).ToString('o')
  repository = $RepoUrl
  canonical_source = Full $SourceRoot
  canonical_branch = 'main'
  approved_recovery_branch = $RecoveryBranch
  recovery_r31_r40 = Full $RecoveryRepo
  recovery_package = Full $RecoveryPackage
  release_web = Full $ReleaseRoot
  backups = Full $BackupRoot
  logs = Full $LogRoot
  exports = Full $ExportRoot
  source_head = $sourceHead
  rule = 'One app -> one canonical SOURCE -> main is integrated product source -> recovery/archive are reference only -> RELEASE staging is disposable.'
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$marker = [ordered]@{
  marker_version = 2
  app = 'BUKLOD MAIN'
  repository = $RepoUrl
  workspace_root = Full $WorkspaceRoot
  canonical_source = Full $SourceRoot
  canonical_branch = 'main'
  created_at = (Get-Date).ToString('o')
  source_head_at_mark = $sourceHead
  rule = 'This is the single normal writable BUKLOD Main clone.'
}
$marker | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $MarkerPath -Encoding UTF8

Write-Host '4/4 FINAL STRUCTURE' -ForegroundColor Cyan
Write-Host " SOURCE          : $SourceRoot" -ForegroundColor Green
Write-Host " RECOVERY        : $RecoveryRepo" -ForegroundColor Green
Write-Host " RELEASE         : $ReleaseRoot" -ForegroundColor Green
Write-Host " WORKSPACE ID    : $ManifestPath" -ForegroundColor Green
Write-Host " LOCAL MARKER    : $MarkerPath" -ForegroundColor Green
Write-Host ''
Write-Host 'CANONICAL WORKSPACE READY. NO DEPLOYMENT WAS PERFORMED.' -ForegroundColor Green
Write-Host 'Run scripts\FINALIZE_BUKLOD_CENTRALIZATION.ps1 to inventory old clones safely.' -ForegroundColor Cyan
