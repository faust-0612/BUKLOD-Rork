#requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\\') }
function Read-Utf8([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "Character navigation repair target missing: $Path"
  }
  return [System.IO.File]::ReadAllText($Path)
}
function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText(
    $Path,
    $Text,
    (New-Object System.Text.UTF8Encoding($false))
  )
}

$ProjectRoot = Full $ProjectRoot
$customizePath = Join-Path $ProjectRoot 'src\components\points\BuklodCharacterCustomizeSheet.tsx'
$corePath = Join-Path $ProjectRoot 'src\components\points\BuklodProgressiveCharacterSelector.tsx'
$seriesOnePath = Join-Path $ProjectRoot 'src\components\points\BuklodSpecialSeriesOne.tsx'
$r40Path = Join-Path $ProjectRoot 'src\components\points\BuklodSpecialCharacterSeries.tsx'

Write-Host ''
Write-Host 'CHARACTER NAVIGATION SMOOTHNESS FORWARD REPAIR R24' -ForegroundColor Cyan
Write-Host 'Presentation/layout/art/rules are immutable in this step.' -ForegroundColor DarkGray

# 1) Main Character vertical sheet: enable Android nested scrolling so horizontal
# child rails can claim horizontal gestures without making the vertical sheet feel sticky.
$customize = Read-Utf8 $customizePath
if ($customize -notmatch '(?s)<ScrollView\s+[^>]*nestedScrollEnabled[^>]*style=\{\s*styles\.bodyScroll') {
  $pattern = '(?s)<ScrollView\s*\r?\n\s*style=\{\s*\r?\n\s*styles\.bodyScroll'
  $matches = [regex]::Matches($customize, $pattern)
  if ($matches.Count -ne 1) {
    Fail "Expected exactly one main Character body ScrollView; found $($matches.Count)."
  }
  $customize = [regex]::Replace(
    $customize,
    $pattern,
    "<ScrollView`r`n            nestedScrollEnabled`r`n            style={`r`n              styles.bodyScroll",
    1
  )
  Write-Utf8 $customizePath $customize
  Write-Host ' Main vertical Character ScrollView: nested scrolling enabled.' -ForegroundColor Green
} else {
  Write-Host ' Main vertical Character ScrollView: already navigation-safe.' -ForegroundColor DarkGray
}

# 2) R31 Core: preserve the exact cards/spacing/art. Only add nestedScrollEnabled
# to the three existing horizontal rails (character, levels, collectibles).
$core = Read-Utf8 $corePath
$corePattern = '(?m)^([ \t]*)horizontal\r?\n([ \t]*)(showsHorizontalScrollIndicator=\{false\})'
$coreMatches = [regex]::Matches($core, $corePattern)
if ($coreMatches.Count -gt 0) {
  if ($coreMatches.Count -ne 3) {
    Fail "Expected exactly 3 R31 horizontal rails needing navigation repair; found $($coreMatches.Count)."
  }
  $eol = if ($core.Contains("`r`n")) { "`r`n" } else { "`n" }
  $core = [regex]::Replace($core, $corePattern, {
    param($m)
    $indent1 = $m.Groups[1].Value
    $indent2 = $m.Groups[2].Value
    return $indent1 + 'horizontal' + $eol + $indent2 + 'nestedScrollEnabled' + $eol + $indent2 + $m.Groups[3].Value
  })
  Write-Utf8 $corePath $core
  Write-Host ' R31 Core horizontal rails: 3/3 nested-scroll safe.' -ForegroundColor Green
} elseif (([regex]::Matches($core, 'nestedScrollEnabled')).Count -lt 3) {
  Fail 'R31 Core navigation repair could not prove all three rails are nested-scroll safe.'
} else {
  Write-Host ' R31 Core horizontal rails: already navigation-safe.' -ForegroundColor DarkGray
}

# 3) R40 Series 1 passport rail: one horizontal rail sits inside the same
# vertical Character sheet. Add gesture arbitration only; modal layout is unchanged.
$seriesOne = Read-Utf8 $seriesOnePath
$seriesPattern = '(?m)^([ \t]*)horizontal\r?\n([ \t]*)(showsHorizontalScrollIndicator=\{false\})'
$seriesMatches = [regex]::Matches($seriesOne, $seriesPattern)
if ($seriesMatches.Count -gt 0) {
  if ($seriesMatches.Count -ne 1) {
    Fail "Expected exactly 1 Series 1 horizontal rail needing navigation repair; found $($seriesMatches.Count)."
  }
  $eol = if ($seriesOne.Contains("`r`n")) { "`r`n" } else { "`n" }
  $seriesOne = [regex]::Replace($seriesOne, $seriesPattern, {
    param($m)
    $indent1 = $m.Groups[1].Value
    $indent2 = $m.Groups[2].Value
    return $indent1 + 'horizontal' + $eol + $indent2 + 'nestedScrollEnabled' + $eol + $indent2 + $m.Groups[3].Value
  })
  Write-Utf8 $seriesOnePath $seriesOne
  Write-Host ' R40 Series 1 horizontal rail: nested-scroll safe.' -ForegroundColor Green
} elseif ($seriesOne -notmatch 'nestedScrollEnabled') {
  Fail 'R40 Series 1 navigation repair could not prove the rail is nested-scroll safe.'
} else {
  Write-Host ' R40 Series 1 horizontal rail: already navigation-safe.' -ForegroundColor DarkGray
}

# 4) R40 premium journey already has native nested rails + lazy detail loading.
# Do not rewrite it; assert those navigation/performance protections remain present.
$r40 = Read-Utf8 $r40Path
foreach ($token in @(
  'horizontal nestedScrollEnabled',
  'nativeDetailsOpen',
  'removeClippedSubviews={nativeLayout}'
)) {
  if (-not $r40.Contains($token)) {
    Fail "R40 navigation protection missing after overlay: $token"
  }
}
Write-Host ' R40 premium journey: existing native navigation protections preserved.' -ForegroundColor Green

# Final immutable-format guard: these markers prove we only repaired navigation
# behavior on the approved presentation family, not a replacement UI.
$customize = Read-Utf8 $customizePath
$core = Read-Utf8 $corePath
$seriesOne = Read-Utf8 $seriesOnePath
foreach ($check in @(
  @{ Text = $customize; Token = 'BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1' },
  @{ Text = $customize; Token = 'Live full-body preview' },
  @{ Text = $core; Token = 'BUKLOD_CHARACTER_R26B_PROGRESSIVE_SELECTOR' },
  @{ Text = $core; Token = 'LEVEL 1-20 PROGRESSION' },
  @{ Text = $seriesOne; Token = 'BUKLOD_CHARACTER_R37B_SPECIAL_SERIES1_PREVIEW' }
)) {
  if (-not $check.Text.Contains($check.Token)) {
    Fail "Locked Character presentation marker missing: $($check.Token)"
  }
}

# 5) Fullscreen zoom clarity: keep the exact locked presentation and approved art,
# but switch only the 500px fullscreen surfaces to a full-source no-downscaling decode.
$zoomRepairScript = Join-Path $ProjectRoot 'scripts\APPLY_CHARACTER_ZOOM_SHARP_R1.ps1'
if (!(Test-Path -LiteralPath $zoomRepairScript -PathType Leaf)) {
  Fail "Character zoom-quality repair script missing: $zoomRepairScript"
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $zoomRepairScript -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
  Fail 'Character fullscreen zoom-quality repair failed.'
}
Write-Host ' Character fullscreen zoom-quality repair: VERIFIED.' -ForegroundColor Green

Write-Host ''
Write-Host 'CHARACTER NAVIGATION SMOOTHNESS R24 + ZOOM QUALITY R25: PASS' -ForegroundColor Green
Write-Host 'Visible Character format: UNCHANGED / LOCKED' -ForegroundColor Green
