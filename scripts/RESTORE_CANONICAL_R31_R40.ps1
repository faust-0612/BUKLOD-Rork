#requires -Version 5.1
param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string[]]$RecoveryRoots = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$SafetyBackup = Join-Path $ProjectRoot ".buklod-backups\canonical_r31_r40_restore_$Stamp"
$BackupRoot = Join-Path $ProjectRoot '.buklod-backups'

$DefaultLegacyRoot = Join-Path $HOME 'Downloads\BUKLOD-Rork-current-20260905_131136'
$DefaultLatestRoot = Join-Path $HOME 'Downloads\BUKLOD-Rork-LATEST'
$ResolvedRecoveryRoots = @(
  $BackupRoot,
  $ProjectRoot,
  (Join-Path $DefaultLegacyRoot '.buklod-backups'),
  $DefaultLegacyRoot,
  (Join-Path $DefaultLatestRoot '.buklod-backups'),
  $DefaultLatestRoot
) + $RecoveryRoots
$ResolvedRecoveryRoots = @(
  $ResolvedRecoveryRoots |
    Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } |
    Select-Object -Unique
)

function Fail([string]$Message) { throw $Message }
function Sha([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Backup-Current([string]$Relative) {
  $src = Join-Path $ProjectRoot $Relative
  if (!(Test-Path -LiteralPath $src -PathType Leaf)) { return }
  $dst = Join-Path $SafetyBackup $Relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
function CandidateFiles([string]$Name) {
  $seen = @{}
  foreach ($root in $ResolvedRecoveryRoots) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Filter $Name -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\dist(?:-|\\)' -and
        $_.FullName -notmatch '\\.git\\'
      } |
      ForEach-Object {
        if (!$seen.ContainsKey($_.FullName)) {
          $seen[$_.FullName] = $true
          $_
        }
      }
  }
}
function Find-ExactHash([string]$ExpectedHash, [string]$Name) {
  foreach ($file in @(CandidateFiles $Name)) {
    if ((Sha $file.FullName) -eq $ExpectedHash) { return $file.FullName }
  }
  return $null
}
function Find-TextContract([string]$Name, [string[]]$Required, [string[][]]$AnyGroups = @()) {
  foreach ($file in @(CandidateFiles $Name)) {
    try { $text = [IO.File]::ReadAllText($file.FullName) } catch { continue }
    $ok = $true
    foreach ($token in $Required) {
      if (!$text.Contains($token)) { $ok = $false; break }
    }
    if (!$ok) { continue }
    foreach ($group in $AnyGroups) {
      $groupOk = $false
      foreach ($token in $group) {
        if ($text.Contains($token)) { $groupOk = $true; break }
      }
      if (!$groupOk) { $ok = $false; break }
    }
    if ($ok) { return $file.FullName }
  }
  return $null
}
function Restore-File([string]$Relative, [string]$Source) {
  if (!$Source) { Fail "No verified recovery source found for $Relative" }
  Backup-Current $Relative
  $dst = Join-Path $ProjectRoot $Relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $dst -Force
  Write-Host " Restored: $Relative" -ForegroundColor Green
  Write-Host "   from: $Source" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD CANONICAL CHARACTER RECOVERY — R31 CORE + R40 SPECIAL' -ForegroundColor Cyan
Write-Host ' EXACT VERIFIED R31 HASHES + R40 CONTRACT ONLY / NO WHOLE APP ROLLBACK' -ForegroundColor Cyan
Write-Host '====================================================================' -ForegroundColor Cyan

if (!(Test-Path -LiteralPath $ProjectRoot -PathType Container)) { Fail 'Project root missing.' }
New-Item -ItemType Directory -Force -Path $SafetyBackup | Out-Null

Write-Host 'Verified recovery roots:' -ForegroundColor Yellow
$ResolvedRecoveryRoots | ForEach-Object { Write-Host " - $_" }
if ($ResolvedRecoveryRoots.Count -lt 1) { Fail 'No verified recovery roots are available.' }

# Preferred latest R31-compatible source family used before R40 integration.
$R31Source = [ordered]@{
  'src\components\points\BuklodProfileCharacterCard.tsx' = '346AC998D09606702309B7B710152B7441767C364620AA0AF993596AEC661C76'
  'src\components\points\BuklodProgressiveCharacterSelector.tsx' = 'F12E9AEB14EA2E07BA79EC2BD58830169A89F570C41BD92FEE7750564BD544C5'
  'src\components\points\BuklodProgressiveCharacterArt.tsx' = 'D8F05E3ED555538BFBFE091F1743A68D46EC4D2C5EC20C165765EB86ABFD77FC'
  'src\lib\buklodProgressiveCharacter.ts' = 'E06F6787F3AFD45207D2723B59F11C3B0D9C22D8670D6FD075C3DD923CE48EB4'
}

$R31Assets = [ordered]@{
  'assets\images\characters\phan_r26.jpg' = '1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB'
  'assets\images\characters\quin_r26.jpg' = '769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892'
  'assets\images\characters\van_r26.jpg' = 'B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66'
  'assets\images\characters\christian_r26.jpg' = '1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739'
  'assets\images\characters\lhen_r26.jpg' = '17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB'
}

Write-Host '1/5 RESTORE EXACT R31 SOURCE FAMILY' -ForegroundColor Cyan
foreach ($entry in $R31Source.GetEnumerator()) {
  $dst = Join-Path $ProjectRoot $entry.Key
  if ((Sha $dst) -eq $entry.Value) {
    Write-Host " Already exact: $($entry.Key)" -ForegroundColor Green
    continue
  }
  $src = Find-ExactHash $entry.Value ([IO.Path]::GetFileName($entry.Key))
  Restore-File $entry.Key $src
  if ((Sha (Join-Path $ProjectRoot $entry.Key)) -ne $entry.Value) { Fail "R31 source hash verification failed: $($entry.Key)" }
}

Write-Host ''
Write-Host '2/5 RESTORE EXACT FIVE R31 ART STRIPS' -ForegroundColor Cyan
foreach ($entry in $R31Assets.GetEnumerator()) {
  $dst = Join-Path $ProjectRoot $entry.Key
  if ((Sha $dst) -eq $entry.Value) {
    Write-Host " Already exact: $($entry.Key)" -ForegroundColor Green
    continue
  }
  $src = Find-ExactHash $entry.Value ([IO.Path]::GetFileName($entry.Key))
  Restore-File $entry.Key $src
  if ((Sha (Join-Path $ProjectRoot $entry.Key)) -ne $entry.Value) { Fail "R31 asset hash verification failed: $($entry.Key)" }
}

Write-Host ''
Write-Host '3/5 RESTORE R40 PREMIUM SPECIAL SOURCE + R31/R40 CUSTOMIZE WIRING' -ForegroundColor Cyan
$specialRel = 'src\components\points\BuklodSpecialCharacterSeries.tsx'
$specialSource = Find-TextContract 'BuklodSpecialCharacterSeries.tsx' @(
  'Special Character Journey',
  'get_my_buklod_special_collectibles_v2',
  'set_my_buklod_special_character_pursuit_v1',
  'ACE','MITCH','NIEL','ANGEL','VHEN','TRUDICE'
) @(
  @('JAVVO','JAWO','Jawo'),
  @('ELLUSUR','ELESUR')
)
Restore-File $specialRel $specialSource

$registryRel = 'src\lib\buklodSpecialCharacterAssets.ts'
$registryRequired = @('ace_hero.jpg','trudice_hero.jpg','mitch_hero.jpg','niel_hero.jpg','angel_hero.jpg','vhen_hero.jpg','jawo_hero.jpg','ellusur_hero.jpg')
$registrySource = Find-TextContract 'buklodSpecialCharacterAssets.ts' $registryRequired
Restore-File $registryRel $registrySource

$customizeRel = 'src\components\points\BuklodCharacterCustomizeSheet.tsx'
$customizeSource = Find-TextContract 'BuklodCharacterCustomizeSheet.tsx' @(
  'BuklodProgressiveCharacterSelector',
  'BuklodSpecialCharacterSeries'
)
Restore-File $customizeRel $customizeSource

Write-Host ''
Write-Host '4/5 RESTORE R40 168-ASSET FAMILY BY EXACT FILE NAME' -ForegroundColor Cyan
$specialIds = @('ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
$specialRoot = Join-Path $ProjectRoot 'assets\images\characters\special\batch1'
New-Item -ItemType Directory -Force -Path $specialRoot | Out-Null

$expectedFiles = New-Object System.Collections.Generic.List[string]
foreach ($id in $specialIds) {
  $expectedFiles.Add("${id}_hero.jpg")
  for ($level = 1; $level -le 20; $level++) {
    $expectedFiles.Add(("{0}_level_{1}.jpg" -f $id, $level.ToString('00')))
  }
}

foreach ($name in $expectedFiles) {
  $dst = Join-Path $specialRoot $name
  if (Test-Path -LiteralPath $dst -PathType Leaf) { continue }
  $src = $null
  foreach ($file in @(CandidateFiles $name)) {
    if ($file.FullName -ne $dst) { $src = $file.FullName; break }
  }
  if (!$src) { Fail "Missing R40 asset recovery source: $name" }
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

$count = @(Get-ChildItem -LiteralPath $specialRoot -File -Filter '*.jpg' -ErrorAction Stop).Count
if ($count -lt 168) { Fail "R40 special asset recovery incomplete: $count/168" }
Write-Host " R40 special assets present: $count" -ForegroundColor Green

Write-Host ''
Write-Host '5/5 RUN CANONICAL RELEASE CONTRACT' -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
  & npm.cmd run character:contract
  $contractExit = $LASTEXITCODE
} finally { Pop-Location }
if ($contractExit -ne 0) { Fail 'Canonical R31/R40 release contract still fails after recovery.' }

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Green
Write-Host ' CANONICAL R31 + R40 RECOVERY COMPLETE — NO DEPLOY PERFORMED' -ForegroundColor Green
Write-Host '====================================================================' -ForegroundColor Green
Write-Host "Safety backup: $SafetyBackup"
Write-Host 'Next release may proceed only through a gated deployment script.'
