# IGPAT_MANUAL_TS_QA_R15
$ErrorActionPreference = 'Stop'
$ExpectedChanged = @(
  'src/app/(tabs)/buklod.tsx',
  'src/components/BuklodExclusiveScopeCommunity.tsx'
)

$trackedDirtyBefore = @(& git status --porcelain --untracked-files=no)
if ($trackedDirtyBefore.Count -gt 0) {
  & git status --short
  throw 'Tracked source is already dirty before IGPAT R15 cleanup.'
}

node scripts/run-igpat-community-ts-cleanup-r15.cjs
if ($LASTEXITCODE -ne 0) { throw 'IGPAT publish cleanup patch failed.' }

& git diff --check
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed after IGPAT cleanup.' }

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
  throw 'IGPAT R15 cleanup touched an unexpected tracked-file set.'
}

Write-Host 'IGPAT R15 diff boundary: PASS' -ForegroundColor Green
& git diff --stat -- $ExpectedChanged

npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript QA failed after IGPAT cleanup.' }

if (Test-Path 'dist-igpat-qa-r15') { Remove-Item 'dist-igpat-qa-r15' -Recurse -Force }
npx expo export --platform web --clear --output-dir dist-igpat-qa-r15
if ($LASTEXITCODE -ne 0) { throw 'Expo web export failed after IGPAT cleanup.' }
if (-not (Test-Path 'dist-igpat-qa-r15/index.html')) { throw 'Expo export completed without index.html.' }

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host 'IGPAT R15 MANUAL QA: PASS' -ForegroundColor Green
Write-Host 'EXPECTED TRACKED DIFF: 2 Community publish files only' -ForegroundColor Green
Write-Host 'NO WEB DEPLOY / NO OTA / NO NATIVE BUILD PERFORMED' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
