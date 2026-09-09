$ErrorActionPreference = 'Stop'

Write-Host 'BUKLOD Game Lab — Direct Expo Web Deploy' -ForegroundColor Cyan

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  throw "Expected branch 'main' after Game Lab merge. Current branch: $branch"
}

Write-Host 'Pulling canonical main...' -ForegroundColor Yellow
git pull --ff-only origin main

if (-not (Test-Path 'package.json')) { throw 'Run this script from the BUKLOD project root.' }
if (-not (Test-Path 'app.config.js')) { throw 'app.config.js not found.' }
if (-not (Test-Path 'eas.json')) { throw 'eas.json not found.' }

$env:APP_VARIANT = 'production'
$env:EXPO_PUBLIC_APP_ENV = 'production'
$env:BUKLOD_WEB_OUTPUT = 'static'

Write-Host 'Checking Expo authentication...' -ForegroundColor Yellow
npx eas-cli@latest whoami
if ($LASTEXITCODE -ne 0) {
  throw 'Expo authentication is required. Run: npx eas-cli@latest login'
}

Write-Host 'Installing locked dependencies...' -ForegroundColor Yellow
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Running TypeScript QA...' -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript QA failed. Deployment stopped.' }

if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }

Write-Host 'Exporting Expo web production bundle with static route output...' -ForegroundColor Yellow
npx expo export --platform web --output-dir dist
if ($LASTEXITCODE -ne 0) { throw 'Expo web export failed. Deployment stopped.' }

$gameLabCandidates = @(
  'dist\games.html',
  'dist\games\index.html'
)
$gameLabFile = $gameLabCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $gameLabFile) {
  Write-Host 'Game Lab route was NOT emitted by Expo export.' -ForegroundColor Red
  Write-Host 'Deployment blocked to prevent another successful upload with /games missing.' -ForegroundColor Red
  Write-Host 'Top-level dist entries:' -ForegroundColor Yellow
  Get-ChildItem 'dist' | Select-Object Name, Mode
  throw 'Static /games route verification failed.'
}

Write-Host "Verified exported Game Lab route: $gameLabFile" -ForegroundColor Green

Write-Host 'Publishing to existing Expo Hosting production target...' -ForegroundColor Yellow
npx eas-cli@latest deploy --prod --non-interactive
if ($LASTEXITCODE -ne 0) { throw 'EAS web deployment failed.' }

Write-Host 'DEPLOY COMPLETE' -ForegroundColor Green
Write-Host 'Verify Game Lab: https://buklod.expo.app/games' -ForegroundColor Green
