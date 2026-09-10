#requires -Version 5.1
param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string[]]$RecoveryRoots = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function Sha([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Copy-VerifiedFile([string]$Source, [string]$Destination) {
  if (!(Test-Path -LiteralPath $Source -PathType Leaf)) { Fail "Recovery source missing: $Source" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}
function Repair-R40SpecialCharacterUi([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "R40 UI repair target missing: $Path"
  }

  $text = [System.IO.File]::ReadAllText($Path)
  $original = $text

  # The approved local R40 snapshot contains a duplicated native-details block
  # between LEVEL 1-20 JOURNEY and COLLECTIBLES. That duplicate opens an extra
  # fragment/conditional and leaves the root View unclosed, producing hundreds
  # of cascading TypeScript JSX errors from one structural defect.
  $toggleMarker = '      {nativeLayout ? ('
  $firstToggle = $text.IndexOf($toggleMarker, [System.StringComparison]::Ordinal)
  $secondToggle = if ($firstToggle -ge 0) {
    $text.IndexOf($toggleMarker, $firstToggle + $toggleMarker.Length, [System.StringComparison]::Ordinal)
  } else { -1 }

  if ($secondToggle -ge 0) {
    $collectibleSectionMarker = '      <View style={styles.sectionCard}>'
    $collectibleSection = $text.IndexOf(
      $collectibleSectionMarker,
      $secondToggle,
      [System.StringComparison]::Ordinal
    )
    if ($collectibleSection -lt 0) {
      Fail 'R40 forward repair found the duplicated details block but could not locate the collectibles section.'
    }
    $text = $text.Remove($secondToggle, $collectibleSection - $secondToggle)
    Write-Host ' Forward repair: removed duplicated malformed R40 native-details JSX block.' -ForegroundColor Green
  }

  # The recovered component also referenced old *_medium.webp files from a
  # special-series1 folder that is not part of the approved 168-asset package.
  # Remove that obsolete registry and use the verified R40 hero JPGs everywhere.
  $thumbStartMarker = '/* BUKLOD_SPECIAL_R40K_ANDROID_PERF_R1 */'
  $thumbStart = $text.IndexOf($thumbStartMarker, [System.StringComparison]::Ordinal)
  if ($thumbStart -ge 0) {
    $exportMarker = 'export default function BuklodSpecialCharacterSeries'
    $exportIndex = $text.IndexOf($exportMarker, $thumbStart, [System.StringComparison]::Ordinal)
    if ($exportIndex -lt 0) {
      Fail 'R40 forward repair could not locate component export after obsolete native thumb registry.'
    }
    $text = $text.Remove($thumbStart, $exportIndex - $thumbStart)
    Write-Host ' Forward repair: removed obsolete special-series1 medium WEBP registry.' -ForegroundColor Green
  }

  $text = $text.Replace(
    'source={nativeLayout ? NATIVE_SPECIAL_THUMB[character.id] : SPECIAL_CHARACTER_HERO[character.id]}',
    'source={SPECIAL_CHARACTER_HERO[character.id]}'
  )

  # Canonical display names. Internal IDs remain unchanged for compatibility.
  $text = $text.Replace("name: 'JAVVO'", "name: 'JAWO'")
  $text = $text.Replace("name: 'ELLUSUR'", "name: 'ELESUR'")

  $remainingToggleCount = ([regex]::Matches($text, [regex]::Escape($toggleMarker))).Count
  $detailsConditionMarker = '{(!nativeLayout || nativeDetailsOpen) ? ('
  $detailsConditionCount = ([regex]::Matches($text, [regex]::Escape($detailsConditionMarker))).Count
  if ($remainingToggleCount -ne 1) {
    Fail "R40 forward repair expected exactly 1 native details toggle; found $remainingToggleCount."
  }
  if ($detailsConditionCount -ne 1) {
    Fail "R40 forward repair expected exactly 1 details conditional; found $detailsConditionCount."
  }
  if ($text.Contains('NATIVE_SPECIAL_THUMB') -or $text.Contains('special-series1/')) {
    Fail 'R40 forward repair did not fully remove obsolete native thumbnail dependencies.'
  }

  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding($false)))
  }
}

$ProjectRoot = Full $ProjectRoot
$WorkspaceRecoveryRepo = Join-Path $HOME 'BUKLOD_WORKSPACE\RECOVERY\R31_R40_APPROVED'
$WorkspaceRecoveryPackage = Join-Path $WorkspaceRecoveryRepo 'recovery-import\r31-r40'

$CandidateRoots = @()
if (-not [string]::IsNullOrWhiteSpace($env:BUKLOD_R31_R40_RECOVERY_ROOT)) {
  $CandidateRoots += $env:BUKLOD_R31_R40_RECOVERY_ROOT
}
$CandidateRoots += $RecoveryRoots
$CandidateRoots += $WorkspaceRecoveryPackage
$CandidateRoots = @(
  $CandidateRoots |
    Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } |
    ForEach-Object { Full $_ } |
    Select-Object -Unique
)

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD CANONICAL CHARACTER RECOVERY — R31 CORE + R40 SPECIAL' -ForegroundColor Cyan
Write-Host ' APPROVED MANIFEST + VERIFIED FORWARD REPAIR / DISPOSABLE OVERLAY' -ForegroundColor Cyan
Write-Host '====================================================================' -ForegroundColor Cyan

if (!(Test-Path -LiteralPath $ProjectRoot -PathType Container)) { Fail "Project root missing: $ProjectRoot" }
if ($CandidateRoots.Count -lt 1) {
  Fail 'No centralized approved R31/R40 recovery package is available.'
}

$RecoveryRoot = $null
$RecoveryManifest = $null
foreach ($candidate in $CandidateRoots) {
  $manifestPath = Join-Path $candidate 'RECOVERY_MANIFEST.json'
  if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }
  try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  } catch {
    continue
  }
  if ([int]$manifest.r40_named_asset_count -lt 168) { continue }
  if (@($manifest.source_files).Count -lt 11) { continue }
  $RecoveryRoot = $candidate
  $RecoveryManifest = $manifest
  break
}

if (-not $RecoveryRoot -or -not $RecoveryManifest) {
  Fail 'No recovery root passed the approved RECOVERY_MANIFEST contract.'
}

Write-Host "Approved recovery package: $RecoveryRoot" -ForegroundColor Green
Write-Host "Snapshot label          : $($RecoveryManifest.source_snapshot_label)"
Write-Host "R40 asset count         : $($RecoveryManifest.r40_named_asset_count)"

$ExpectedCoreAssets = [ordered]@{
  'assets\images\characters\phan_r26.jpg' = '1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB'
  'assets\images\characters\quin_r26.jpg' = '769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892'
  'assets\images\characters\van_r26.jpg' = 'B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66'
  'assets\images\characters\christian_r26.jpg' = '1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739'
  'assets\images\characters\lhen_r26.jpg' = '17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB'
}

Write-Host ''
Write-Host '1/6 VERIFY APPROVED R31 CORE ART' -ForegroundColor Cyan
foreach ($entry in $ExpectedCoreAssets.GetEnumerator()) {
  $source = Join-Path $RecoveryRoot $entry.Key
  $actual = Sha $source
  if ($actual -ne $entry.Value) {
    Fail "Approved R31 asset hash mismatch: $($entry.Key) expected=$($entry.Value) actual=$actual"
  }
  Write-Host " Verified: $($entry.Key)" -ForegroundColor Green
}

Write-Host ''
Write-Host '2/6 VERIFY APPROVED R40 ASSET FAMILY' -ForegroundColor Cyan
$specialSourceRoot = Join-Path $RecoveryRoot 'assets\images\characters\special\batch1'
if (!(Test-Path -LiteralPath $specialSourceRoot -PathType Container)) {
  Fail "Approved R40 asset folder missing: $specialSourceRoot"
}
$specialIds = @('ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
$expectedSpecial = New-Object System.Collections.Generic.List[string]
foreach ($id in $specialIds) {
  $expectedSpecial.Add("${id}_hero.jpg")
  for ($level = 1; $level -le 20; $level++) {
    $expectedSpecial.Add(("{0}_level_{1}.jpg" -f $id, $level.ToString('00')))
  }
}
foreach ($name in $expectedSpecial) {
  if (!(Test-Path -LiteralPath (Join-Path $specialSourceRoot $name) -PathType Leaf)) {
    Fail "Approved R40 asset missing: $name"
  }
}
if ($expectedSpecial.Count -ne 168) { Fail "Internal R40 expectation error: $($expectedSpecial.Count)" }
Write-Host ' Verified complete R40 asset family: 168/168' -ForegroundColor Green

Write-Host ''
Write-Host '3/6 OVERLAY APPROVED R31/R40 SOURCE FAMILY' -ForegroundColor Cyan
foreach ($relativeRaw in @($RecoveryManifest.source_files)) {
  $relative = ([string]$relativeRaw) -replace '/', '\'
  $source = Join-Path $RecoveryRoot $relative
  $destination = Join-Path $ProjectRoot $relative
  Copy-VerifiedFile $source $destination
  Write-Host " Restored source: $relative" -ForegroundColor Green
}

Write-Host ''
Write-Host '4/6 APPLY REVIEWED R40 FORWARD REPAIR' -ForegroundColor Cyan
$specialUiDestination = Join-Path $ProjectRoot 'src\components\points\BuklodSpecialCharacterSeries.tsx'
Repair-R40SpecialCharacterUi $specialUiDestination
Write-Host ' R40 UI structural repair: VERIFIED' -ForegroundColor Green

Write-Host ''
Write-Host '5/6 OVERLAY IMMUTABLE CORE + SPECIAL ASSETS' -ForegroundColor Cyan
foreach ($entry in $ExpectedCoreAssets.GetEnumerator()) {
  $source = Join-Path $RecoveryRoot $entry.Key
  $destination = Join-Path $ProjectRoot $entry.Key
  Copy-VerifiedFile $source $destination
  if ((Sha $destination) -ne $entry.Value) {
    Fail "R31 destination hash verification failed: $($entry.Key)"
  }
}

$specialDestinationRoot = Join-Path $ProjectRoot 'assets\images\characters\special\batch1'
New-Item -ItemType Directory -Force -Path $specialDestinationRoot | Out-Null
foreach ($name in $expectedSpecial) {
  Copy-VerifiedFile (Join-Path $specialSourceRoot $name) (Join-Path $specialDestinationRoot $name)
}
$destinationSpecialCount = @(
  Get-ChildItem -LiteralPath $specialDestinationRoot -File -Filter '*.jpg' -ErrorAction Stop
).Count
if ($destinationSpecialCount -lt 168) {
  Fail "R40 destination asset family incomplete: $destinationSpecialCount/168"
}
Write-Host " Restored R40 assets: $destinationSpecialCount" -ForegroundColor Green

Write-Host ''
Write-Host '6/6 RUN CANONICAL CHARACTER RELEASE CONTRACT' -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
  & npm.cmd run character:contract
  $contractExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($contractExit -ne 0) {
  Fail 'Canonical R31/R40 release contract failed after approved recovery overlay.'
}

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Green
Write-Host ' R31 + R40 APPROVED RELEASE OVERLAY + FORWARD REPAIR: PASS' -ForegroundColor Green
Write-Host '====================================================================' -ForegroundColor Green
Write-Host 'No Git reset, no source-branch overwrite, and no deployment was performed by this recovery step.'
