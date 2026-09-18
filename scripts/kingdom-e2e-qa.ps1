$ErrorActionPreference = 'Stop'

function Assert-ExternalCommand {
  param([string]$Label)
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

Write-Host ''
Write-Host '============================================================'
Write-Host ' BUKLOD KINGDOM E2E QA R1'
Write-Host ' 13 REGIONS + 20 LEVELS + EN/TL + SERVER PROGRESSION'
Write-Host ' NO MERGE / NO DEPLOY'
Write-Host '============================================================'

$branch = (git branch --show-current).Trim()
if ($branch -ne 'feature/kingdom-e2e-r1') {
  throw "STOP: Expected feature/kingdom-e2e-r1 but current branch is '$branch'."
}

$conflicts = @(git diff --name-only --diff-filter=U)
if ($conflicts.Count -gt 0) {
  throw "STOP: Unresolved merge conflicts detected: $($conflicts -join ', ')"
}

Write-Host ''
Write-Host '1/8 Kingdom E2E source contract...'
node scripts/kingdom-e2e-contract.mjs
Assert-ExternalCommand 'Kingdom E2E source contract'

Write-Host ''
Write-Host '2/8 Full 13-game EN/TL coverage gate...'
node scripts/game-translation-coverage.mjs
Assert-ExternalCommand '13-game EN/TL coverage gate'

Write-Host ''
Write-Host '3/8 Canonical Character regression contract...'
npm run character:contract
Assert-ExternalCommand 'Character regression contract'

Write-Host ''
Write-Host '4/8 TypeScript compile QA...'
npx tsc --noEmit
Assert-ExternalCommand 'TypeScript compile QA'

Write-Host ''
Write-Host '5/8 Rork media/fallback contract...'
node scripts/rork-media-contract-test.mjs
Assert-ExternalCommand 'Rork media contract'

$qaBase = Join-Path (Get-Location) '.kingdom-e2e-qa'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$qaRoot = Join-Path $qaBase $runStamp
$webOut = Join-Path $qaRoot 'web'
$androidOut = Join-Path $qaRoot 'android'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
Write-Host "QA artifact run: $qaRoot"

Write-Host ''
Write-Host '6/8 Web single-output export...'
$env:BUKLOD_WEB_OUTPUT = 'single'
npx expo export --platform web --output-dir $webOut
Assert-ExternalCommand 'Web export'

Write-Host ''
Write-Host '7/8 Compiled Kingdom E2E contract...'
node scripts/kingdom-e2e-contract.mjs --dist $webOut
Assert-ExternalCommand 'Compiled Kingdom E2E contract'

Write-Host ''
Write-Host '8/8 Android JS/native-module bundle smoke...'
npx expo export --platform android --output-dir $androidOut
Assert-ExternalCommand 'Android bundle smoke'

Write-Host ''
Write-Host '============================================================'
Write-Host ' KINGDOM E2E AUTOMATED QA 8/8 PASS'
Write-Host '============================================================'
Write-Host "Web artifact    : $webOut"
Write-Host "Android artifact: $androidOut"
Write-Host ''
Write-Host 'NO MERGE OR DEPLOY WAS PERFORMED.'
Write-Host 'Next boundary: localhost visible 13-game + Kingdom smoke and physical Android smoke.'
