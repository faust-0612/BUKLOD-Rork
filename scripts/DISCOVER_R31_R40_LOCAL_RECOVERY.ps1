#requires -Version 5.1
param(
  [string[]]$Roots = @(
    'C:\BUKLOD-Rork',
    (Join-Path $HOME 'Downloads'),
    (Join-Path $HOME 'Desktop'),
    (Join-Path $HOME 'Documents')
  ),
  [int]$MaxDepth = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$WorkspaceRoot = Join-Path $HOME 'BUKLOD_WORKSPACE'
$CanonicalSource = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$LogRoot = Join-Path $WorkspaceRoot 'LOGS'

$SkipDirectoryNames = @(
  '.git','node_modules','android','ios','dist','build','.expo','.cxx','.gradle',
  'Pods','tmp','.tmp','coverage','.next','out','RELEASE','EXPORTS'
)

$RequiredSourceFiles = @(
  'src\components\points\BuklodProgressiveCharacterSelector.tsx',
  'src\lib\buklodProgressiveCharacter.ts',
  'src\components\points\BuklodProgressiveCharacterArt.tsx',
  'src\components\points\BuklodProfileCharacterCard.tsx',
  'src\components\points\BuklodCharacterCustomizeSheet.tsx',
  'src\components\points\BuklodSpecialCharacterSeries.tsx',
  'src\lib\buklodSpecialCharacterAssets.ts'
)

$CoreHashes = [ordered]@{
  'assets\images\characters\phan_r26.jpg'      = '1598EF159BFC4AB784A681BEF7BC53FF839DBEA92CB729EE03A15BAA4F31CCDB'
  'assets\images\characters\quin_r26.jpg'      = '769BCF6F61DEB70E1D52E7515AF9C69CC6562545E86D2DD390355770E5C33892'
  'assets\images\characters\van_r26.jpg'       = 'B52B6B7E3562B2D884CC677D67C67CC71898273BF5BF5068A077B10B5DC87C66'
  'assets\images\characters\christian_r26.jpg' = '1AE9C03466876CEFC443FF55641D7EAD516DF82FF340A632EE852D7DD8B07739'
  'assets\images\characters\lhen_r26.jpg'      = '17A2FDB2FB18252AB494589E689E5044C27B86065A988D70094997971D9D66EB'
}

$SpecialIds = @('ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')

function Full([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-SamePath([string]$A, [string]$B) {
  return (Full $A).Equals((Full $B), [System.StringComparison]::OrdinalIgnoreCase)
}

function Read-TextSafe([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
  try { return Get-Content -LiteralPath $Path -Raw -ErrorAction Stop } catch { return '' }
}

function Has-AllTokens([string]$Path, [string[]]$Tokens) {
  $text = Read-TextSafe $Path
  if (-not $text) { return $false }
  foreach ($token in $Tokens) {
    if (-not $text.Contains($token)) { return $false }
  }
  return $true
}

function Find-BuklodProjectRoots([string]$Root) {
  $results = New-Object System.Collections.Generic.List[string]
  if (!(Test-Path -LiteralPath $Root -PathType Container)) { return $results }

  $queue = New-Object System.Collections.Queue
  $queue.Enqueue([pscustomobject]@{ Path = (Full $Root); Depth = 0 })

  while ($queue.Count -gt 0) {
    $item = $queue.Dequeue()
    $path = [string]$item.Path
    $depth = [int]$item.Depth

    if (Test-SamePath $path $CanonicalSource) { continue }

    $points = Join-Path $path 'src\components\points'
    $lib = Join-Path $path 'src\lib'
    if ((Test-Path -LiteralPath $points -PathType Container) -and
        (Test-Path -LiteralPath $lib -PathType Container)) {
      $results.Add($path)
      continue
    }

    if ($depth -ge $MaxDepth) { continue }

    foreach ($dir in @(Get-ChildItem -LiteralPath $path -Directory -Force -ErrorAction SilentlyContinue)) {
      if ($SkipDirectoryNames -contains $dir.Name) { continue }
      if ($dir.FullName.StartsWith((Full $WorkspaceRoot) + '\', [System.StringComparison]::OrdinalIgnoreCase)) { continue }
      $queue.Enqueue([pscustomobject]@{ Path = $dir.FullName; Depth = ($depth + 1) })
    }
  }

  return $results
}

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD R31/R40 — READ-ONLY LOCAL RECOVERY DISCOVERY' -ForegroundColor Cyan
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host 'Nothing will be copied, moved, deleted, or edited.' -ForegroundColor Green

$candidateSet = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
foreach ($root in $Roots) {
  Write-Host "Scanning: $root" -ForegroundColor DarkCyan
  foreach ($candidate in @(Find-BuklodProjectRoots -Root $root)) {
    [void]$candidateSet.Add((Full $candidate))
  }
}

$results = New-Object System.Collections.Generic.List[object]
foreach ($candidate in $candidateSet) {
  $sourcePresent = 0
  foreach ($rel in $RequiredSourceFiles) {
    if (Test-Path -LiteralPath (Join-Path $candidate $rel) -PathType Leaf) { $sourcePresent++ }
  }

  $selectorOk = Has-AllTokens (Join-Path $candidate 'src\components\points\BuklodProgressiveCharacterSelector.tsx') @(
    'Browse all 20 levels','Use This Character'
  )
  $progressiveOk = Has-AllTokens (Join-Path $candidate 'src\lib\buklodProgressiveCharacter.ts') @(
    'PROGRESSIVE_LEVEL_THRESHOLDS','collectibleNames','loadProgressiveCharacter','saveProgressiveCharacter',
    'ProgressiveCharacterId','loadProgressiveShowcase','subscribeProgressiveShowcase'
  )
  $customizeOk = Has-AllTokens (Join-Path $candidate 'src\components\points\BuklodCharacterCustomizeSheet.tsx') @(
    'BuklodProgressiveCharacterSelector','BuklodSpecialCharacterSeries'
  )
  $specialSeriesPath = Join-Path $candidate 'src\components\points\BuklodSpecialCharacterSeries.tsx'
  $specialSeriesText = Read-TextSafe $specialSeriesPath
  $specialSeriesOk = $false
  if ($specialSeriesText) {
    $baseTokens = @(
      'Special Character Journey','get_my_buklod_special_collectibles_v2',
      'set_my_buklod_special_character_pursuit_v1','ACE','MITCH','NIEL','ANGEL','VHEN','TRUDICE'
    )
    $specialSeriesOk = $true
    foreach ($token in $baseTokens) {
      if (-not $specialSeriesText.Contains($token)) { $specialSeriesOk = $false; break }
    }
    if ($specialSeriesOk -and
        -not ($specialSeriesText.Contains('JAVVO') -or $specialSeriesText.Contains('JAWO') -or $specialSeriesText.Contains('Jawo'))) {
      $specialSeriesOk = $false
    }
    if ($specialSeriesOk -and
        -not ($specialSeriesText.Contains('ELLUSUR') -or $specialSeriesText.Contains('ELESUR'))) {
      $specialSeriesOk = $false
    }
  }

  $registryPath = Join-Path $candidate 'src\lib\buklodSpecialCharacterAssets.ts'
  $registryText = Read-TextSafe $registryPath
  $registryOk = $false
  if ($registryText) {
    $registryOk = $true
    foreach ($id in $SpecialIds) {
      if (-not $registryText.Contains("${id}_hero.jpg")) { $registryOk = $false; break }
      for ($level = 1; $level -le 20; $level++) {
        $suffix = $level.ToString('00')
        if (-not $registryText.Contains("${id}_level_${suffix}.jpg")) { $registryOk = $false; break }
      }
      if (-not $registryOk) { break }
    }
  }

  $corePresent = 0
  $coreHashPass = 0
  foreach ($entry in $CoreHashes.GetEnumerator()) {
    $asset = Join-Path $candidate $entry.Key
    if (Test-Path -LiteralPath $asset -PathType Leaf) {
      $corePresent++
      try {
        $actual = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($actual -eq $entry.Value) { $coreHashPass++ }
      } catch {}
    }
  }

  $specialRoot = Join-Path $candidate 'assets\images\characters\special\batch1'
  $specialJpgCount = 0
  $specialNamedPass = 0
  $specialNamedExpected = 168
  if (Test-Path -LiteralPath $specialRoot -PathType Container) {
    $specialJpgCount = @(Get-ChildItem -LiteralPath $specialRoot -File -Filter '*.jpg' -ErrorAction SilentlyContinue).Count
    foreach ($id in $SpecialIds) {
      if (Test-Path -LiteralPath (Join-Path $specialRoot "${id}_hero.jpg") -PathType Leaf) { $specialNamedPass++ }
      for ($level = 1; $level -le 20; $level++) {
        $suffix = $level.ToString('00')
        if (Test-Path -LiteralPath (Join-Path $specialRoot "${id}_level_${suffix}.jpg") -PathType Leaf) { $specialNamedPass++ }
      }
    }
  }

  $tokenPassCount = @($selectorOk,$progressiveOk,$customizeOk,$specialSeriesOk,$registryOk | Where-Object { $_ }).Count
  $ready = (
    $sourcePresent -eq $RequiredSourceFiles.Count -and
    $selectorOk -and $progressiveOk -and $customizeOk -and $specialSeriesOk -and $registryOk -and
    $coreHashPass -eq $CoreHashes.Count -and
    $specialNamedPass -eq $specialNamedExpected
  )

  $score = ($sourcePresent * 10) + ($tokenPassCount * 20) + ($coreHashPass * 25) + [Math]::Min($specialNamedPass, $specialNamedExpected)

  $results.Add([pscustomobject]@{
    path = $candidate
    score = $score
    source_files = "$sourcePresent/$($RequiredSourceFiles.Count)"
    token_groups = "$tokenPassCount/5"
    r31_core_present = "$corePresent/$($CoreHashes.Count)"
    r31_core_hash_pass = "$coreHashPass/$($CoreHashes.Count)"
    r40_named_assets = "$specialNamedPass/$specialNamedExpected"
    r40_jpg_count = $specialJpgCount
    full_contract_candidate = $ready
  })
}

$ordered = @($results | Sort-Object -Property @{Expression='full_contract_candidate';Descending=$true}, @{Expression='score';Descending=$true}, path)

Write-Host ''
if ($ordered.Count -eq 0) {
  Write-Host 'NO BUKLOD PROJECT CANDIDATES FOUND IN THE SELECTED ROOTS.' -ForegroundColor Yellow
  Write-Host 'No files were changed.' -ForegroundColor Green
} else {
  $ordered | Format-Table -AutoSize
  Write-Host ''
  $full = @($ordered | Where-Object { $_.full_contract_candidate })
  if ($full.Count -gt 0) {
    Write-Host 'FULL R31/R40 RECOVERY CANDIDATE FOUND.' -ForegroundColor Green
    foreach ($item in $full) { Write-Host "  $($item.path)" -ForegroundColor Green }
  } else {
    Write-Host 'No full-contract candidate found yet. Highest-scoring partial candidates are preserved for review.' -ForegroundColor Yellow
  }
}

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$reportPath = Join-Path $LogRoot ('R31_R40_RECOVERY_DISCOVERY_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  roots_scanned = $Roots
  max_depth = $MaxDepth
  read_only = $true
  candidates = $ordered
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host "Report: $reportPath" -ForegroundColor Cyan
Write-Host 'READ-ONLY DISCOVERY COMPLETE. No source or legacy files were modified.' -ForegroundColor Green
