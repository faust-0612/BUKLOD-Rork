#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [string[]]$LegacyRoots = @(),
  [switch]$QuarantineSafeDuplicates
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$RecoveryRepo = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40_APPROVED'
$RecoveryPackage = Join-Path $RecoveryRepo 'recovery-import\r31-r40'
$ReleaseRoot = Join-Path $WorkspaceRoot 'RELEASE\WEB'
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$MarkerPath = Join-Path $SourceRoot '.buklod-local-canonical.json'
$QuarantineBase = Join-Path $WorkspaceRoot 'LEGACY_QUARANTINE'
$LogRoot = Join-Path $WorkspaceRoot 'LOGS'
$BackupRoot = Join-Path $WorkspaceRoot 'BACKUPS'
$ExportRoot = Join-Path $WorkspaceRoot 'EXPORTS'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function GitOut([string]$Repo, [string[]]$GitArgs) {
  $output = & git -C $Repo @GitArgs 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return (($output | Out-String).Trim())
}
function FindGitRepos([string]$Root, [int]$Depth = 0, [int]$MaxDepth = 3) {
  $found = New-Object System.Collections.Generic.List[string]
  if (!(Test-Path -LiteralPath $Root -PathType Container)) { return $found }
  foreach ($dir in @(Get-ChildItem -LiteralPath $Root -Directory -Force -ErrorAction SilentlyContinue)) {
    $full = Full $dir.FullName
    if ($full -eq (Full $WorkspaceRoot) -or $full.StartsWith((Full $WorkspaceRoot) + '\', [System.StringComparison]::OrdinalIgnoreCase)) { continue }
    if (Test-Path -LiteralPath (Join-Path $dir.FullName '.git')) {
      $found.Add($dir.FullName)
      continue
    }
    if ($Depth -lt $MaxDepth) {
      foreach ($nested in @(FindGitRepos -Root $dir.FullName -Depth ($Depth + 1) -MaxDepth $MaxDepth)) { $found.Add($nested) }
    }
  }
  return $found
}

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD MAIN — FINALIZE CANONICAL CENTRALIZATION' -ForegroundColor Cyan
Write-Host '=============================================================' -ForegroundColor Cyan

foreach ($dir in @($WorkspaceRoot,$ReleaseRoot,$RecoveryRepo,$QuarantineBase,$LogRoot,$BackupRoot,$ExportRoot)) { EnsureDir $dir }
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) { Fail "Canonical SOURCE missing: $SourceRoot" }

Write-Host '1/5 VERIFY + NORMALIZE CANONICAL SOURCE' -ForegroundColor Cyan
$origin = GitOut $SourceRoot @('remote','get-url','origin')
if ($origin -ne $ExpectedRepo) { Fail "Canonical SOURCE origin mismatch: $origin" }
$dirty = @(& git -C $SourceRoot status --porcelain)
if ($dirty.Count -gt 0) {
  & git -C $SourceRoot status --short
  Fail 'Canonical SOURCE has local changes. Nothing was discarded.'
}
& git -C $SourceRoot fetch origin --prune
if ($LASTEXITCODE -ne 0) { Fail 'Could not fetch canonical origin.' }
& git -C $SourceRoot switch main
if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
& git -C $SourceRoot pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { Fail 'Could not fast-forward canonical SOURCE main.' }
$canonicalHead = (& git -C $SourceRoot rev-parse HEAD).Trim()

Write-Host '2/5 WRITE WORKSPACE MANIFEST + LOCAL CANONICAL MARKER' -ForegroundColor Cyan
$manifest = [ordered]@{
  workspace_version = 3
  updated_at = (Get-Date).ToString('o')
  repository = $ExpectedRepo
  canonical_source = Full $SourceRoot
  canonical_branch = 'main'
  approved_recovery_branch = 'recovery/r31-r40-approved-local-20260910'
  recovery_r31_r40 = Full $RecoveryRepo
  recovery_package = Full $RecoveryPackage
  release_web = Full $ReleaseRoot
  backups = Full $BackupRoot
  logs = Full $LogRoot
  exports = Full $ExportRoot
  source_head = $canonicalHead
  rule = 'One app -> one canonical SOURCE -> main is integrated product source -> recovery/archive are reference only -> RELEASE staging is disposable.'
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$marker = [ordered]@{
  marker_version = 2
  app = 'BUKLOD MAIN'
  repository = $ExpectedRepo
  workspace_root = Full $WorkspaceRoot
  canonical_source = Full $SourceRoot
  canonical_branch = 'main'
  created_at = (Get-Date).ToString('o')
  source_head_at_mark = $canonicalHead
  rule = 'This is the single normal writable BUKLOD Main clone. Other matching clones are reference/recovery only.'
}
$marker | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $MarkerPath -Encoding UTF8
Write-Host "Manifest : $ManifestPath" -ForegroundColor Green
Write-Host "Marker   : $MarkerPath" -ForegroundColor Green

Write-Host '3/5 VERIFY CENTRALIZED RECOVERY LOCATION' -ForegroundColor Cyan
if (Test-Path -LiteralPath (Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json') -PathType Leaf) {
  $recoveryManifest = Get-Content -LiteralPath (Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json') -Raw | ConvertFrom-Json
  if ([int]$recoveryManifest.r40_named_asset_count -lt 168) { Fail 'Central approved recovery package is incomplete.' }
  Write-Host "Approved R31/R40 recovery present: $RecoveryPackage" -ForegroundColor Green
} else {
  Write-Host 'Approved recovery package is not cloned locally yet; canonical release launcher will refresh it from the protected recovery branch.' -ForegroundColor Yellow
}

if ($LegacyRoots.Count -eq 0) {
  $LegacyRoots = @((Join-Path $HOME 'Downloads'), (Join-Path $HOME 'Desktop'), (Join-Path $HOME 'Documents'))
}

Write-Host '4/5 INVENTORY OTHER BUKLOD MAIN CLONES' -ForegroundColor Cyan
$repoPaths = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
foreach ($root in $LegacyRoots) {
  foreach ($repo in @(FindGitRepos -Root $root -MaxDepth 3)) { [void]$repoPaths.Add((Full $repo)) }
}

$results = New-Object System.Collections.Generic.List[object]
$quarantineRoot = Join-Path $QuarantineBase (Get-Date -Format 'yyyyMMdd-HHmmss')
foreach ($repo in $repoPaths) {
  if ($repo -eq (Full $SourceRoot)) { continue }
  $candidateOrigin = GitOut $repo @('remote','get-url','origin')
  if ($candidateOrigin -ne $ExpectedRepo) { continue }
  $head = GitOut $repo @('rev-parse','HEAD')
  $branch = GitOut $repo @('symbolic-ref','--short','-q','HEAD')
  if (-not $branch) { $branch = '(detached)' }
  $candidateDirty = @(& git -C $repo status --porcelain 2>$null)
  & git -C $repo fetch origin main --quiet 2>$null
  $fetchOk = ($LASTEXITCODE -eq 0)
  $containedInMain = $false
  if ($fetchOk -and $head) {
    & git -C $repo merge-base --is-ancestor $head 'origin/main' 2>$null
    $containedInMain = ($LASTEXITCODE -eq 0)
  }
  $classification = if ($candidateDirty.Count -gt 0) { 'PRESERVE_DIRTY' } elseif (!$fetchOk) { 'PRESERVE_FETCH_UNVERIFIED' } elseif (!$containedInMain) { 'PRESERVE_UNIQUE_COMMITS' } else { 'SAFE_DUPLICATE' }
  $movedTo = $null
  if ($classification -eq 'SAFE_DUPLICATE' -and $QuarantineSafeDuplicates) {
    EnsureDir $quarantineRoot
    $safeName = ((Split-Path -Leaf $repo) -replace '[^A-Za-z0-9._-]', '_')
    $suffix = if ($head) { $head.Substring(0, [Math]::Min(8, $head.Length)) } else { 'unknown' }
    $dest = Join-Path $quarantineRoot ($safeName + '-' + $suffix)
    $n = 1
    while (Test-Path -LiteralPath $dest) { $dest = Join-Path $quarantineRoot ($safeName + '-' + $suffix + '-' + $n); $n++ }
    Move-Item -LiteralPath $repo -Destination $dest
    $movedTo = $dest
  }
  $results.Add([pscustomobject]@{ path=$repo; branch=$branch; head=$head; dirty=($candidateDirty.Count -gt 0); head_contained_in_origin_main=$containedInMain; classification=$classification; quarantined_to=$movedTo })
  Write-Host "$classification : $repo" -ForegroundColor $(if ($classification -eq 'SAFE_DUPLICATE') { 'Green' } else { 'Yellow' })
}

Write-Host '5/5 WRITE CENTRALIZATION REPORT + VERIFY CONTRACT' -ForegroundColor Cyan
$reportPath = Join-Path $LogRoot ('BUKLOD_CENTRALIZATION_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  canonical_source = Full $SourceRoot
  canonical_head = $canonicalHead
  repository = $ExpectedRepo
  canonical_branch = 'main'
  approved_recovery_branch = 'recovery/r31-r40-approved-local-20260910'
  duplicate_repositories = @($results)
  quarantine_enabled = [bool]$QuarantineSafeDuplicates
  safety_rule = 'Dirty, unverified, or unique-commit clones are preserved. Only clean clones already contained in origin/main may be quarantined automatically.'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8

$verifyScript = Join-Path $PSScriptRoot 'VERIFY_BUKLOD_CANONICAL_SOURCE.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyScript -WorkspaceRoot $WorkspaceRoot -RequireCurrentDirectory -RequireClean -RequireMain
if ($LASTEXITCODE -ne 0) { Fail 'Canonical source verification failed after finalization.' }

Write-Host ''
Write-Host 'BUKLOD CENTRALIZATION: COMPLETE' -ForegroundColor Green
Write-Host "Canonical SOURCE : $SourceRoot" -ForegroundColor Green
Write-Host "Canonical HEAD   : $canonicalHead" -ForegroundColor Green
Write-Host "Report           : $reportPath" -ForegroundColor Green
Write-Host 'No dirty or unique-work clone was deleted or overwritten.' -ForegroundColor Green
