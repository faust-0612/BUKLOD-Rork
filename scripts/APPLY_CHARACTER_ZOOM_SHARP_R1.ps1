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
    Fail "Character zoom-quality repair target missing: $Path"
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
function Add-HighQualityToZoomCall([string]$Path, [string]$Marker, [string]$Label) {
  $text = Read-Utf8 $Path
  $markerIndex = $text.IndexOf($Marker, [System.StringComparison]::Ordinal)
  if ($markerIndex -lt 0) {
    Fail "$Label marker missing: $Marker"
  }

  $componentStart = $text.IndexOf('<BuklodProgressiveCharacterArt', $markerIndex, [System.StringComparison]::Ordinal)
  if ($componentStart -lt 0) {
    Fail "$Label progressive zoom renderer missing after marker."
  }

  $componentEnd = $text.IndexOf('/>', $componentStart, [System.StringComparison]::Ordinal)
  if ($componentEnd -lt 0) {
    Fail "$Label progressive zoom renderer is not self-closing as expected."
  }
  $componentEnd += 2

  $block = $text.Substring($componentStart, $componentEnd - $componentStart)
  if (-not $block.Contains('height={500}')) {
    Fail "$Label zoom renderer no longer uses the approved fullscreen height={500} contract."
  }

  if (-not $block.Contains('highQuality')) {
    $eol = if ($block.Contains("`r`n")) { "`r`n" } else { "`n" }
    $heightIndex = $block.IndexOf('height={500}', [System.StringComparison]::Ordinal)
    $lineStart = $block.LastIndexOf("`n", $heightIndex)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart += 1 }
    $indentLength = 0
    while (($lineStart + $indentLength) -lt $block.Length -and $block[$lineStart + $indentLength] -eq ' ') {
      $indentLength++
    }
    $indent = ' ' * $indentLength
    $block = $block.Replace('height={500}', 'height={500}' + $eol + $indent + 'highQuality')
    $text = $text.Substring(0, $componentStart) + $block + $text.Substring($componentEnd)
    Write-Utf8 $Path $text
    Write-Host " ${Label}: high-quality fullscreen decode enabled." -ForegroundColor Green
  } else {
    Write-Host " ${Label}: high-quality fullscreen decode already enabled." -ForegroundColor DarkGray
  }

  $verified = Read-Utf8 $Path
  $verifyMarker = $verified.IndexOf($Marker, [System.StringComparison]::Ordinal)
  $verifyStart = $verified.IndexOf('<BuklodProgressiveCharacterArt', $verifyMarker, [System.StringComparison]::Ordinal)
  $verifyEnd = $verified.IndexOf('/>', $verifyStart, [System.StringComparison]::Ordinal)
  if ($verifyStart -lt 0 -or $verifyEnd -lt 0) {
    Fail "$Label post-repair zoom block could not be re-read."
  }
  $verifyBlock = $verified.Substring($verifyStart, ($verifyEnd + 2) - $verifyStart)
  if (-not $verifyBlock.Contains('height={500}') -or -not $verifyBlock.Contains('highQuality')) {
    Fail "$Label zoom-quality proof failed."
  }
}

$ProjectRoot = Full $ProjectRoot
$rendererPath = Join-Path $ProjectRoot 'src\components\points\BuklodProgressiveCharacterArt.tsx'
$profilePath = Join-Path $ProjectRoot 'src\components\points\BuklodProfileCharacterCard.tsx'
$selectorPath = Join-Path $ProjectRoot 'src\components\points\BuklodProgressiveCharacterSelector.tsx'

Write-Host ''
Write-Host 'CHARACTER FULLSCREEN ZOOM QUALITY FORWARD REPAIR R25' -ForegroundColor Cyan
Write-Host 'Locked R31/R40 presentation stays unchanged; only fullscreen decode quality changes.' -ForegroundColor DarkGray

$renderer = Read-Utf8 $rendererPath

# Protect the exact approved sharp-art renderer family. The source assets themselves
# are hash-verified by RESTORE_CANONICAL_R31_R40.ps1 before this repair runs.
if (-not $renderer.Contains('BUKLOD_CHARACTER_R29_PIXEL_ALIGNED_RENDER')) {
  Fail 'Approved pixel-aligned R31 renderer marker is missing. Refusing guessed zoom rewrite.'
}
if (-not $renderer.Contains("assets/images/characters/phan_r26.jpg")) {
  Fail 'Approved R31 sharp row-asset wiring is missing. Refusing zoom rewrite.'
}

if (-not $renderer.Contains('BUKLOD_CHARACTER_R25_ZOOM_SHARP_FULL_SOURCE')) {
  $rnImportPattern = "(?s)import\s*\{\s*Image,\s*StyleSheet,\s*View,\s*\}\s*from\s*'react-native';"
  $rnMatches = [regex]::Matches($renderer, $rnImportPattern)
  if ($rnMatches.Count -ne 1) {
    Fail "Expected one approved React Native image import block; found $($rnMatches.Count)."
  }
  $replacementImport = @"
import {
  Image as NativeImage,
  StyleSheet,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
"@
  $renderer = [regex]::Replace($renderer, $rnImportPattern, $replacementImport.TrimEnd(), 1)

  $propAnchor = '  viewportWidth?: number;'
  if (-not $renderer.Contains($propAnchor)) {
    Fail 'R31 renderer viewportWidth prop anchor missing.'
  }
  $renderer = $renderer.Replace(
    $propAnchor,
    $propAnchor + "`n  highQuality?: boolean;"
  )

  $destructureAnchor = '  viewportWidth,'
  $destructureMatches = ([regex]::Matches($renderer, [regex]::Escape($destructureAnchor))).Count
  if ($destructureMatches -ne 1) {
    Fail "Expected one R31 renderer viewportWidth destructure anchor; found $destructureMatches."
  }
  $renderer = $renderer.Replace(
    $destructureAnchor,
    $destructureAnchor + "`n  highQuality = false,"
  )

  $imagePattern = '(?s)<Image\s+source=\{SHEETS\[characterId\]\}\s+resizeMode="contain"\s+fadeDuration=\{0\}\s+style=\{\{(?<style>.*?)\}\}\s*/>'
  $imageMatches = [regex]::Matches($renderer, $imagePattern)
  if ($imageMatches.Count -ne 1) {
    Fail "Expected one approved progressive sheet Image element; found $($imageMatches.Count)."
  }

  $renderer = [regex]::Replace($renderer, $imagePattern, {
    param($m)
    $styleBody = $m.Groups['style'].Value
    return @"
{highQuality ? (
          <ExpoImage
            source={SHEETS[characterId]}
            contentFit="contain"
            allowDownscaling={false}
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            style={{$styleBody}}
          />
        ) : (
          <NativeImage
            source={SHEETS[characterId]}
            resizeMode="contain"
            fadeDuration={0}
            style={{$styleBody}}
          />
        )}
"@
  }, 1)

  $renderer = $renderer.Replace(
    '/* BUKLOD_CHARACTER_R29_PIXEL_ALIGNED_RENDER */',
    "/* BUKLOD_CHARACTER_R29_PIXEL_ALIGNED_RENDER */`n/* BUKLOD_CHARACTER_R25_ZOOM_SHARP_FULL_SOURCE */"
  )

  Write-Utf8 $rendererPath $renderer
  Write-Host ' Progressive renderer: zoom-only full-source decode path installed.' -ForegroundColor Green
} else {
  Write-Host ' Progressive renderer: zoom-quality path already installed.' -ForegroundColor DarkGray
}

# Enable the high-quality path only for fullscreen surfaces. Normal cards, hero rails,
# and progression thumbnails retain the lightweight renderer path.
Add-HighQualityToZoomCall $profilePath 'BUKLOD_CHARACTER_R27C_PROFILE_ZOOM_MODAL' 'Profile fullscreen zoom'
Add-HighQualityToZoomCall $selectorPath 'BUKLOD_CHARACTER_R27B_FULLSCREEN' 'R31 level fullscreen zoom'

$renderer = Read-Utf8 $rendererPath
foreach ($token in @(
  'BUKLOD_CHARACTER_R25_ZOOM_SHARP_FULL_SOURCE',
  'Image as ExpoImage',
  'Image as NativeImage',
  'allowDownscaling={false}',
  'cachePolicy="memory-disk"',
  'priority="high"',
  'highQuality?: boolean;',
  'highQuality = false'
)) {
  if (-not $renderer.Contains($token)) {
    Fail "Character zoom-quality renderer token missing after repair: $token"
  }
}

$profile = Read-Utf8 $profilePath
$selector = Read-Utf8 $selectorPath
if (([regex]::Matches($profile, 'highQuality')).Count -lt 1) {
  Fail 'Profile fullscreen zoom did not retain highQuality.'
}
if (([regex]::Matches($selector, 'highQuality')).Count -lt 1) {
  Fail 'R31 level fullscreen zoom did not retain highQuality.'
}

Write-Host ''
Write-Host 'CHARACTER FULLSCREEN ZOOM QUALITY R25: PASS' -ForegroundColor Green
Write-Host 'Approved sharp assets: PRESERVED' -ForegroundColor Green
Write-Host 'Normal Character cards/rails: LIGHTWEIGHT PATH PRESERVED' -ForegroundColor Green
Write-Host 'Fullscreen Character zoom: FULL-SOURCE / NO DOWNSCALING' -ForegroundColor Green
Write-Host 'Visible Character format: UNCHANGED / LOCKED' -ForegroundColor Green
