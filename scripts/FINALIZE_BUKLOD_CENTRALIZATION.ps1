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
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$MarkerPath = Join-Path $SourceRoot '.buklod-local-canonical.json'
$QuarantineRoot = Join-Path $WorkspaceRoot ('LEGACY_QUARANTINE\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$LogRoot = Join-Path $WorkspaceRoot 'LOGS'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function GitOut([string]$Repo, [string[]]$Args) {
  $output = & git -C $Repo @Args 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return (($output | Out-String).Trim())
}
function FindGitRepos([string]$Root, [int]$Depth = 0, [int]$MaxDepth = 3) {
  $found = New-Object System.Collections.Generic.List[string]
  if (!(Test-Path -LiteralPath $Root -PathType Container)) { return $found }
  foreach ($dir in @(Get-ChildItem -LiteralPath $Root -Directory -Force -ErrorAction SilentlyContinue)) {
    $full = Full $dir.FullName
    if ($full -eq (Full $WorkspaceRoot) -or $full.StartsWith((Full $WorkspaceRoot) + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      continue
    }
    $gitMarker = Join-Path $dir.FullName '.git'
    if (Test-Path -LiteralPath $gitMarker) {
      $found.Add($dir.FullName)
      continue
    }
    if ($Depth -lt $MaxDepth) {
      foreach ($nested in @(FindGitRepos -Root $dir.FullName -Depth ($Depth + 1) -MaxDepth $MaxDepth)) {
        $found.Add($nested)
      }
    }
  }
  return $found
}

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD MAIN — FINALIZE CANONICAL CENTRALIZATION' -ForegroundColor Cyan
Write-Host '=============================================================' -ForegroundColor Cyan

$setupScript = Join-Path $PSScriptRoot 'SETUP_BUKLOD_CANONICAL_WORKSPACE.ps1'
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container) -or !(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  if (!(Test-Path -LiteralPath $setupScript -PathType Leaf)) {
    Fail 'Canonical workspace is missing and setup script could not be found.'
  }
  Write-Host 'Canonical workspace is not initialized; running canonical setup first...' -ForegroundColor Yellow
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setupScript -WorkspaceRoot $WorkspaceRoot
  if ($LASTEXITCODE -ne 0) { Fail 'Canonical workspace setup failed.' }
}

Write-Host '1/4 VERIFY AND UPDATE CANONICAL SOURCE' -ForegroundColor Cyan
$origin = GitOut $SourceRoot @('remote','get-url','origin')
if ($origin -ne $ExpectedRepo) { Fail "Canonical SOURCE origin mismatch: $origin" }
$dirty = @(& git -C $SourceRoot status --porcelain)
if ($dirty.Count -gt 0) {
  Write-Host 'Canonical SOURCE has local changes:' -ForegroundColor Red
  & git -C $SourceRoot status --short
  Fail 'Preserve/reconcile canonical local changes before centralization can be finalized. Nothing was discarded.'
}
& git -C $SourceRoot switch main
if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
& git -C $SourceRoot pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { Fail 'Could not fast-forward canonical SOURCE main.' }
$canonicalHead = (& git -C $SourceRoot rev-parse HEAD).Trim()

Write-Host '2/4 WRITE LOCAL CANONICAL MARKER' -ForegroundColor Cyan
$marker = [ordered]@{
  marker_version = 1
  app = 'BUKLOD MAIN'
  repository = $ExpectedRepo
  workspace_root = Full $WorkspaceRoot
  canonical_source = Full $SourceRoot
  created_at = (Get-Date).ToString('o')
  source_head_at_mark = $canonicalHead
  rule = 'This is the single normal writable BUKLOD Main clone. Other matching clones are reference/recovery only.'
}
$marker | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $MarkerPath -Encoding UTF8
Write-Host "Canonical marker written: $MarkerPath" -ForegroundColor Green

if ($LegacyRoots.Count -eq 0) {
  $LegacyRoots = @(
    (Join-Path $HOME 'Downloads'),
    (Join-Path $HOME 'Desktop'),
    (Join-Path $HOME 'Documents')
  )
}

Write-Host '3/4 INVENTORY DUPLICATE BUKLOD MAIN GIT CLONES' -ForegroundColor Cyan
$repoPaths = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
foreach ($root in $LegacyRoots) {
  foreach ($repo in @(FindGitRepos -Root $root -MaxDepth 3)) {
    [void]$repoPaths.Add((Full $repo))
  }
}

$results = New-Object System.Collections.Generic.List[object]
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

  $classification = if ($candidateDirty.Count -gt 0) {
    'PRESERVE_DIRTY'
  } elseif (!$fetchOk) {
    'PRESERVE_FETCH_UNVERIFIED'
  } elseif (!$containedInMain) {
    'PRESERVE_UNIQUE_COMMITS'
  } else {
    'SAFE_DUPLICATE'
  }

  $movedTo = $null
  if ($classification -eq 'SAFE_DUPLICATE' -and $QuarantineSafeDuplicates) {
    EnsureDir $QuarantineRoot
    $safeName = ((Split-Path -Leaf $repo) -replace '[^A-Za-z0-9._-]', '_')
    $dest = Join-Path $QuarantineRoot ($safeName + '-' + $head.Substring(0, 8))
    $counter = 1
    while (Test-Path -LiteralPath $dest) {
      $dest = Join-Path $QuarantineRoot ($safeName + '-' + $head.Substring(0, 8) + '-' + $counter)
      $counter++
    }
    Move-Item -LiteralPath $repo -Destination $dest
    $movedTo = $dest
    Write-Host "Quarantined safe duplicate: $repo" -ForegroundColor Green
  } else {
    Write-Host "$classification : $repo" -ForegroundColor $(if ($classification -eq 'SAFE_DUPLICATE') { 'Green' } else { 'Yellow' })
  }

  $results.Add([pscustomobject]@{
    path = $repo
    origin = $candidateOrigin
    branch = $branch
    head = $head
    dirty = ($candidateDirty.Count -gt 0)
    fetch_ok = $fetchOk
    head_contained_in_origin_main = $containedInMain
    classification = $classification
    quarantined_to = $movedTo
  })
}

Write-Host '4/4 WRITE CENTRALIZATION REPORT' -ForegroundColor Cyan
EnsureDir $LogRoot
$reportPath = Join-Path $LogRoot ('BUKLOD_CENTRALIZATION_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  canonical_source = Full $SourceRoot
  canonical_head = $canonicalHead
  repository = $ExpectedRepo
  quarantine_enabled = [bool]$QuarantineSafeDuplicates
  quarantine_root = if ($QuarantineSafeDuplicates) { $QuarantineRoot } else { $null }
  duplicate_repositories = @($results)
  safety_rule = 'Only clean clones whose HEAD is already an ancestor of origin/main may be quarantined automatically. Dirty, unverified, or unique-commit clones are always preserved.'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host ''
Write-Host 'CENTRALIZATION LOCAL CONTRACT READY' -ForegroundColor Green
Write-Host "Canonical source : $SourceRoot" -ForegroundColor Green
Write-Host "Canonical HEAD   : $canonicalHead" -ForegroundColor Green
Write-Host "Report           : $reportPath" -ForegroundColor Green
if ($QuarantineSafeDuplicates) {
  Write-Host "Safe duplicates  : moved under $QuarantineRoot" -ForegroundColor Green
} else {
  Write-Host 'No folders were moved. Re-run with -QuarantineSafeDuplicates to quarantine only proven-safe duplicate clones.' -ForegroundColor Yellow
}
Write-Host 'No dirty or unique-work clone was deleted or overwritten.' -ForegroundColor Green
