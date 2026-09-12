# IGPAT_MANUAL_TS_QA_R16
$ErrorActionPreference = 'Stop'
$ExpectedChanged = @(
  'src/app/(tabs)/buklod.tsx',
  'src/components/BuklodExclusiveScopeCommunity.tsx'
)

$trackedDirtyBefore = @(& git status --porcelain --untracked-files=no)
if ($trackedDirtyBefore.Count -gt 0) {
  & git status --short
  throw 'Tracked source is already dirty before IGPAT R16 cleanup.'
}

node scripts/fix-igpat-community-ts-r16.cjs
if ($LASTEXITCODE -ne 0) { throw 'IGPAT R16 minimal TypeScript patch failed.' }

& git diff --check
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed after IGPAT R16 patch.' }

$changed = @(& git diff --name-only)
$unexpected = @($changed | Where-Object { $_ -notin $ExpectedChanged })
$missing = @($ExpectedChanged | Where-Object { $_ -notin $changed })
if ($unexpected.Count -gt 0 -or $missing.Count -gt 0) {
  Write-Host 'Changed files:' -ForegroundColor Yellow
  $changed | ForEach-Object { Write-Host " - $_" }
  if ($unexpected.Count -gt 0) {
    Write-Host 'Unexpected changes:' -ForegroundColor Red
    $unexpected | ForEach-Object { Write-Host " - $_" }
  }
  if ($missing.Count -gt 0) {
    Write-Host 'Expected changes missing:' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host " - $_" }
  }
  throw 'IGPAT R16 patch touched an unexpected tracked-file set.'
}

Write-Host 'IGPAT R16 diff boundary: PASS' -ForegroundColor Green
& git diff --stat -- $ExpectedChanged

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript QA failed after IGPAT R16 patch.' }

if (Test-Path 'dist-igpat-qa-r16') { Remove-Item 'dist-igpat-qa-r16' -Recurse -Force }
npx expo export --platform web --clear --output-dir dist-igpat-qa-r16
if ($LASTEXITCODE -ne 0) { throw 'Expo web export failed after IGPAT R16 patch.' }
if (-not (Test-Path 'dist-igpat-qa-r16/index.html')) { throw 'Expo export completed without index.html.' }

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host 'IGPAT R16 MANUAL QA: PASS' -ForegroundColor Green
Write-Host 'EXPECTED TRACKED DIFF: 2 Community files only' -ForegroundColor Green
Write-Host 'NO WEB DEPLOY / NO OTA / NO NATIVE BUILD PERFORMED' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
