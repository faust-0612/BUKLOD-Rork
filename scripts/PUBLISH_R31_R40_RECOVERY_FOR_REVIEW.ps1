#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [string]$RecoverySource = "$HOME\Downloads\BUKLOD-Rork-current-20260905_131136",
  [string]$ReviewBranch = "recovery/r31-r40-approved-local-20260910"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$CanonicalRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$WorktreeRoot = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40_REVIEW_WORKTREE'
$ImportRootRel = 'recovery-import/r31-r40'

function Fail([string]$Message) { throw $Message }
function EnsureFile([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { Fail "Missing required recovery file: $Path" }
}
function EnsureDir([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Container)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}
function Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD R31/R40 — PUBLISH APPROVED LOCAL RECOVERY FOR REVIEW' -ForegroundColor Cyan
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host 'This does NOT overwrite canonical source or current V2 files.' -ForegroundColor Yellow

if (!(Test-Path -LiteralPath $CanonicalRoot -PathType Container)) { Fail "Canonical source missing: $CanonicalRoot" }
if (!(Test-Path -LiteralPath $RecoverySource -PathType Container)) { Fail "Recovery source missing: $RecoverySource" }

$origin = (& git -C $CanonicalRoot remote get-url origin).Trim()
if ($origin -ne $RepoUrl) { Fail "Canonical origin mismatch: $origin" }
$dirty = @(& git -C $CanonicalRoot status --porcelain)
if ($dirty.Count -gt 0) {
  & git -C $CanonicalRoot status --short
  Fail 'Canonical source is dirty. Preserve/reconcile local changes first.'
}
$branch = (& git -C $CanonicalRoot symbolic-ref --short -q HEAD).Trim()
if ($branch -ne 'chore/safe-size-reduction-r1') {
  Fail "Expected canonical source to be on chore/safe-size-reduction-r1; actual: $branch"
}

$ExpectedCoreHashes = [ordered]@{
  'assets\images\characters\phan_r26.jpg'='1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB'
  'assets\images\characters\quin_r26.jpg'='769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892'
  'assets\images\characters\van_r26.jpg'='B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66'
  'assets\images\characters\christian_r26.jpg'='1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739'
  'assets\images\characters\lhen_r26.jpg'='17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB'
}

$SourceFiles = @(
  'src\components\points\BuklodProfileCharacterCard.tsx',
  'src\components\points\BuklodCharacterCustomizeSheet.tsx',
  'src\components\points\BuklodProgressiveCharacterSelector.tsx',
  'src\components\points\BuklodProgressiveCharacterArt.tsx',
  'src\lib\buklodProgressiveCharacter.ts',
  'src\components\points\BuklodSpecialCharacterSeries.tsx',
  'src\components\points\BuklodSpecialSeriesOne.tsx',
  'src\components\points\BuklodCollectibleDetail.tsx',
  'src\lib\buklodSpecialCharacterAssets.ts',
  'src\lib\buklodSpecialCharacterServer.ts',
  'src\lib\buklodSpecialCharacters.ts'
)

foreach ($rel in $SourceFiles) { EnsureFile (Join-Path $RecoverySource $rel) }
foreach ($entry in $ExpectedCoreHashes.GetEnumerator()) {
  $path = Join-Path $RecoverySource $entry.Key
  EnsureFile $path
  $actual = Sha256 $path
  if ($actual -ne $entry.Value) { Fail "Immutable R31 hash mismatch: $($entry.Key)" }
}

$SpecialRoot = Join-Path $RecoverySource 'assets\images\characters\special\batch1'
if (!(Test-Path -LiteralPath $SpecialRoot -PathType Container)) { Fail 'Missing R40 special asset folder.' }
$SpecialIds = @('ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
$ExpectedSpecial = New-Object System.Collections.Generic.List[string]
foreach ($id in $SpecialIds) {
  $ExpectedSpecial.Add("${id}_hero.jpg")
  1..20 | ForEach-Object { $ExpectedSpecial.Add(('{0}_level_{1:D2}.jpg' -f $id, $_)) }
}
foreach ($name in $ExpectedSpecial) { EnsureFile (Join-Path $SpecialRoot $name) }
Write-Host "Validated R40 named assets: $($ExpectedSpecial.Count)" -ForegroundColor Green

& git -C $CanonicalRoot fetch origin --prune
if ($LASTEXITCODE -ne 0) { Fail 'git fetch failed.' }
$remoteExists = (& git -C $CanonicalRoot ls-remote --heads origin $ReviewBranch | Out-String).Trim()
if ($remoteExists) { Fail "Review branch already exists remotely: $ReviewBranch. Refusing overwrite." }

if (Test-Path -LiteralPath $WorktreeRoot) {
  & git -C $CanonicalRoot worktree remove --force $WorktreeRoot 2>$null
  if (Test-Path -LiteralPath $WorktreeRoot) { Remove-Item -LiteralPath $WorktreeRoot -Recurse -Force }
}
EnsureDir (Split-Path -Parent $WorktreeRoot)
& git -C $CanonicalRoot worktree add -b $ReviewBranch $WorktreeRoot HEAD
if ($LASTEXITCODE -ne 0) { Fail 'Could not create isolated recovery review worktree.' }

try {
  $ImportRoot = Join-Path $WorktreeRoot $ImportRootRel
  EnsureDir $ImportRoot

  foreach ($rel in $SourceFiles) {
    $src = Join-Path $RecoverySource $rel
    $dst = Join-Path $ImportRoot $rel
    EnsureDir (Split-Path -Parent $dst)
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }

  foreach ($entry in $ExpectedCoreHashes.GetEnumerator()) {
    $src = Join-Path $RecoverySource $entry.Key
    $dst = Join-Path $ImportRoot $entry.Key
    EnsureDir (Split-Path -Parent $dst)
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }

  $SpecialDst = Join-Path $ImportRoot 'assets\images\characters\special\batch1'
  EnsureDir $SpecialDst
  foreach ($name in $ExpectedSpecial) {
    Copy-Item -LiteralPath (Join-Path $SpecialRoot $name) -Destination (Join-Path $SpecialDst $name) -Force
  }

  $manifest = [ordered]@{
    schema_version = 1
    purpose = 'Approved local R31/R40 recovery package staged for remote review only; not runtime source.'
    source_snapshot_label = 'BUKLOD-Rork-current-20260905_131136'
    imported_at = (Get-Date).ToString('o')
    parent_branch = 'chore/safe-size-reduction-r1'
    source_files = $SourceFiles
    immutable_r31_sha256 = $ExpectedCoreHashes
    r40_named_asset_count = $ExpectedSpecial.Count
    safety = 'Do not merge this review branch directly to main. Forward-port reviewed files into the cleanup branch while preserving current V2.'
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $ImportRoot 'RECOVERY_MANIFEST.json') -Encoding UTF8

  & git -C $WorktreeRoot add -- $ImportRootRel
  if ($LASTEXITCODE -ne 0) { Fail 'git add recovery import failed.' }
  & git -C $WorktreeRoot commit -m 'recovery: stage approved local R31 R40 package for review'
  if ($LASTEXITCODE -ne 0) { Fail 'git commit recovery import failed.' }
  & git -C $WorktreeRoot push -u origin $ReviewBranch
  if ($LASTEXITCODE -ne 0) { Fail 'git push recovery review branch failed.' }

  $head = (& git -C $WorktreeRoot rev-parse HEAD).Trim()
  Write-Host ''
  Write-Host 'RECOVERY REVIEW PACKAGE PUBLISHED' -ForegroundColor Green
  Write-Host "Branch : $ReviewBranch" -ForegroundColor Green
  Write-Host "HEAD   : $head" -ForegroundColor Green
  Write-Host "Files  : $ImportRootRel" -ForegroundColor Green
  Write-Host 'Canonical source was not modified.' -ForegroundColor Green
}
finally {
  Push-Location $CanonicalRoot
  try {
    & git worktree remove --force $WorktreeRoot 2>$null
  } finally {
    Pop-Location
  }
}
