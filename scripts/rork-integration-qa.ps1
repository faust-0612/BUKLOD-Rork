$ErrorActionPreference = 'Stop'

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

Write-Host ''
Write-Host '2/6 Canonical Kingdom/game contract...'
npm run game:contract

Write-Host ''
Write-Host '3/6 TypeScript compile QA...'
npx tsc --noEmit

Write-Host ''
Write-Host '4/6 Targeted Rork media contract test...'
node scripts/rork-media-contract-test.mjs

$qaRoot = Join-Path (Get-Location) '.rork-qa'
$webOut = Join-Path $qaRoot 'web'
$androidOut = Join-Path $qaRoot 'android'
if (Test-Path $qaRoot) {
  Remove-Item $qaRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null

Write-Host ''
Write-Host '5/6 Web export + compiled Kingdom route contract...'
npx expo export --platform web --output-dir $webOut
node scripts/game-kingdom-release-contract.mjs --dist $webOut

Write-Host ''
Write-Host '6/6 Android JS/native-module bundle smoke...'
npx expo export --platform android --output-dir $androidOut

Write-Host ''
Write-Host '============================================================'
Write-Host ' AUTOMATED QA PASS'
Write-Host '============================================================'
Write-Host "Web artifact    : $webOut"
Write-Host "Android artifact: $androidOut"
Write-Host ''
Write-Host 'NO DEPLOY WAS PERFORMED.'
Write-Host 'Next boundary: visible Home/Kingdom/game inspection and physical Android smoke.'
