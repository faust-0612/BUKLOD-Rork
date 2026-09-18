$ErrorActionPreference = 'Stop'

function Assert-ExternalCommand {
  param([string]$Label)
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

Write-Host ''
Write-Host '============================================================'
Write-Host ' BUKLOD RORK INTEGRATION QA'
Write-Host ' HOME + KINGDOM + 13 GAMES / NO DEPLOY'
Write-Host '============================================================'

$branch = (git branch --show-current).Trim()
if ($branch -ne 'feature/rork-home-kingdom-native-integration-r1') {
  throw "STOP: Expected integration branch but current branch is '$branch'."
}

$conflicts = @(git diff --name-only --diff-filter=U)
if ($conflicts.Count -gt 0) {
  throw "STOP: Unresolved merge conflicts detected: $($conflicts -join ', ')"
}

Write-Host ''
Write-Host '1/6 Static integration scope gate...'
node scripts/rork-integration-static-gate.mjs
Assert-ExternalCommand 'Static integration scope gate'

Write-Host ''
Write-Host '2/6 Canonical Kingdom/game contract...'
npm run game:contract
Assert-ExternalCommand 'Canonical Kingdom/game contract'

Write-Host ''
Write-Host '3/6 TypeScript compile QA...'
npx tsc --noEmit
Assert-ExternalCommand 'TypeScript compile QA'

Write-Host ''
Write-Host '4/6 Targeted Rork media contract test...'
node scripts/rork-media-contract-test.mjs
Assert-ExternalCommand 'Rork media contract test'

$qaBase = Join-Path (Get-Location) '.rork-qa'
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$qaRoot = Join-Path $qaBase $runStamp
$webOut = Join-Path $qaRoot 'web'
$androidOut = Join-Path $qaRoot 'android'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
Write-Host "QA artifact run: $qaRoot"

Write-Host ''
Write-Host '5/6 Web export + compiled Kingdom route contract...'
$env:BUKLOD_WEB_OUTPUT = 'single'
npx expo export --platform web --output-dir $webOut
Assert-ExternalCommand 'Web export'
node scripts/game-kingdom-release-contract.mjs --dist $webOut --web-output single
Assert-ExternalCommand 'Compiled single-output Kingdom contract'

Write-Host ''
Write-Host '6/6 Android JS/native-module bundle smoke...'
npx expo export --platform android --output-dir $androidOut
Assert-ExternalCommand 'Android bundle smoke'

Write-Host ''
Write-Host '============================================================'
Write-Host ' AUTOMATED QA PASS'
Write-Host '============================================================'
Write-Host "Web artifact    : $webOut"
Write-Host "Android artifact: $androidOut"
Write-Host ''
Write-Host 'NO DEPLOY WAS PERFORMED.'
Write-Host 'Next boundary: visible Home/Kingdom/game inspection and physical Android smoke.'
