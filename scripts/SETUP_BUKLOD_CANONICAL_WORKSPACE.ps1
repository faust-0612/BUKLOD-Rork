#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [string]$LegacyRecoveryRoot = "$HOME\Downloads\BUKLOD-Rork-current-20260905_131136"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$RecoveryRoot = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40'
$ReleaseRoot = Join-Path $WorkspaceRoot 'RELEASE\WEB'
$BackupRoot = Join-Path $WorkspaceRoot 'BACKUPS'
$LogRoot = Join-Path $WorkspaceRoot 'LOGS'
$ExportRoot = Join-Path $WorkspaceRoot 'EXPORTS'
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$CanonicalMarkerPath = Join-Path $SourceRoot '.buklod-local-canonical.json'

function Fail([string]$Message) { throw $Message }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function Sha([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function CopyRecoveryFile([string]$Relative) {
  $src = Join-Path $LegacyRecoveryRoot $Relative
  if (!(Test-Path -LiteralPath $src -PathType Leaf)) {
    Write-Host " Recovery file not found, leaving for contract/recovery gate: $Relative" -ForegroundColor DarkYellow
    return
  }
  $dst = Join-Path $RecoveryRoot $Relative
  EnsureDir (Split-Path -Parent $dst)
  Copy-Item -LiteralPath $src -Destination $dst -Force
  Write-Host " Copied recovery: $Relative" -ForegroundColor Green
}

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD CENTRALIZED CANONICAL WORKSPACE SETUP' -ForegroundColor Cyan
Write-Host ' ONE SOURCE + ONE RECOVERY ARCHIVE + DISPOSABLE RELEASE STAGING' -ForegroundColor Cyan
Write-Host '====================================================================' -ForegroundColor Cyan

foreach ($dir in @($WorkspaceRoot,$RecoveryRoot,$ReleaseRoot,$BackupRoot,$LogRoot,$ExportRoot)) { EnsureDir $dir }

Write-Host '1/5 PREPARE CLEAN CANONICAL SOURCE' -ForegroundColor Cyan
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  EnsureDir (Split-Path -Parent $SourceRoot)
  & git clone $RepoUrl $SourceRoot
  if ($LASTEXITCODE -ne 0) { Fail 'Could not clone canonical BUKLOD source.' }
} else {
  Push-Location $SourceRoot
  try {
    $origin = (& git remote get-url origin).Trim()
    if ($origin -ne $RepoUrl) { Fail "Canonical source origin mismatch: $origin" }
    $dirty = @(& git status --porcelain)
    if ($dirty.Count -gt 0) {
      Fail "Canonical SOURCE has local changes. Preserve/reconcile them before setup continues: $SourceRoot"
    }
    & git switch main
    if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
    & git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { Fail 'Could not fast-forward canonical SOURCE main.' }
  } finally { Pop-Location }
}

Write-Host ''
Write-Host '2/5 BUILD CENTRAL R31/R40 RECOVERY ARCHIVE' -ForegroundColor Cyan
if (Test-Path -LiteralPath $LegacyRecoveryRoot -PathType Container) {
  $RecoveryFiles = @(
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
    'src\lib\buklodSpecialCharacters.ts',
    'assets\images\characters\phan_r26.jpg',
    'assets\images\characters\quin_r26.jpg',
    'assets\images\characters\van_r26.jpg',
    'assets\images\characters\christian_r26.jpg',
    'assets\images\characters\lhen_r26.jpg'
  )
  foreach ($relative in $RecoveryFiles) { CopyRecoveryFile $relative }

  $specialSource = Join-Path $LegacyRecoveryRoot 'assets\images\characters\special\batch1'
  $specialTarget = Join-Path $RecoveryRoot 'assets\images\characters\special\batch1'
  if (Test-Path -LiteralPath $specialSource -PathType Container) {
    EnsureDir $specialTarget
    Copy-Item -LiteralPath (Join-Path $specialSource '*') -Destination $specialTarget -Recurse -Force
    $specialCount = @(Get-ChildItem -LiteralPath $specialTarget -File -Filter '*.jpg' -ErrorAction SilentlyContinue).Count
    Write-Host " Special-character recovery assets: $specialCount JPG" -ForegroundColor Green
  } else {
    Write-Host ' R40 special asset folder was not found in legacy recovery root.' -ForegroundColor DarkYellow
  }
} else {
  Write-Host "Legacy recovery root not found: $LegacyRecoveryRoot" -ForegroundColor DarkYellow
  Write-Host 'Setup will continue; release gate will block until verified recovery files are supplied.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '3/5 VERIFY IMMUTABLE R31 CORE ART WHEN AVAILABLE' -ForegroundColor Cyan
$ExpectedR31 = [ordered]@{
  'assets\images\characters\phan_r26.jpg'='1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB'
  'assets\images\characters\quin_r26.jpg'='769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892'
  'assets\images\characters\van_r26.jpg'='B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66'
  'assets\images\characters\christian_r26.jpg'='1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739'
  'assets\images\characters\lhen_r26.jpg'='17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB'
}
foreach ($entry in $ExpectedR31.GetEnumerator()) {
  $path = Join-Path $RecoveryRoot $entry.Key
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
    Write-Host " Missing recovery anchor: $($entry.Key)" -ForegroundColor DarkYellow
    continue
  }
  $actual = Sha $path
  if ($actual -ne $entry.Value) { Fail "R31 recovery hash mismatch: $($entry.Key)" }
  Write-Host " Verified: $($entry.Key)" -ForegroundColor Green
}

Write-Host ''
Write-Host '4/5 WRITE WORKSPACE IDENTITY + LOCAL CANONICAL MARKER' -ForegroundColor Cyan
$sourceHead = (& git -C $SourceRoot rev-parse HEAD).Trim()
$manifest = [ordered]@{
  workspace_version = 1
  created_at = (Get-Date).ToString('o')
  repository = $RepoUrl
  canonical_source = Full $SourceRoot
  recovery_r31_r40 = Full $RecoveryRoot
  release_web = Full $ReleaseRoot
  backups = Full $BackupRoot
  logs = Full $LogRoot
  exports = Full $ExportRoot
  source_head = $sourceHead
  rule = 'Deploy only through RELEASE staging created from canonical SOURCE. Never deploy directly from Downloads snapshots.'
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
Write-Host " Workspace manifest: $ManifestPath" -ForegroundColor Green

$marker = [ordered]@{
  marker_version = 1
  app = 'BUKLOD MAIN'
  repository = $RepoUrl
  workspace_root = Full $WorkspaceRoot
  canonical_source = Full $SourceRoot
  created_at = (Get-Date).ToString('o')
  source_head_at_mark = $sourceHead
  rule = 'This is the single normal writable BUKLOD Main clone. Other matching clones are reference/recovery only.'
}
$marker | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $CanonicalMarkerPath -Encoding UTF8
Write-Host " Canonical marker: $CanonicalMarkerPath" -ForegroundColor Green

# The marker is intentionally gitignored. Confirm setup itself did not dirty the canonical source.
$dirtyAfterIdentity = @(& git -C $SourceRoot status --porcelain)
if ($dirtyAfterIdentity.Count -gt 0) {
  Fail 'Canonical SOURCE became dirty while writing workspace identity. Verify .gitignore protection for .buklod-local-canonical.json.'
}

Write-Host ''
Write-Host '5/5 FINAL STRUCTURE' -ForegroundColor Cyan
Write-Host " SOURCE   : $SourceRoot" -ForegroundColor Green
Write-Host " RECOVERY : $RecoveryRoot" -ForegroundColor Green
Write-Host " RELEASE  : $ReleaseRoot" -ForegroundColor Green
Write-Host " BACKUPS  : $BackupRoot" -ForegroundColor Green
Write-Host " LOGS     : $LogRoot" -ForegroundColor Green
Write-Host " EXPORTS  : $ExportRoot" -ForegroundColor Green
Write-Host " MARKER   : $CanonicalMarkerPath" -ForegroundColor Green
Write-Host ''
Write-Host 'CANONICAL WORKSPACE READY. NO DEPLOYMENT WAS PERFORMED.' -ForegroundColor Green
Write-Host "Next: cd `"$SourceRoot`" then run .\scripts\VERIFY_BUKLOD_CANONICAL_SOURCE.ps1 -RequireCurrentDirectory" -ForegroundColor Cyan
Write-Host 'Release only through .\scripts\RUN_CANONICAL_WEB_RELEASE.ps1 after required QA.' -ForegroundColor Cyan
