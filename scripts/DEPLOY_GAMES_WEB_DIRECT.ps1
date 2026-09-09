$ErrorActionPreference = 'Stop'

Write-Host 'BUKLOD Game Lab — Direct Expo Web Deploy' -ForegroundColor Cyan

$scriptPath = $PSCommandPath
$scriptHashBefore = $null
if ($scriptPath -and (Test-Path $scriptPath)) {
  $scriptHashBefore = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  throw "Expected branch 'main' after Game Lab merge. Current branch: $branch"
}

Write-Host 'Pulling canonical main...' -ForegroundColor Yellow
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'git pull failed. Deployment stopped.' }

if ($scriptPath -and (Test-Path $scriptPath) -and $scriptHashBefore) {
  $scriptHashAfter = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
  if ($scriptHashAfter -ne $scriptHashBefore) {
    Write-Host 'Deploy script updated during pull. Relaunching the latest copy...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path 'package.json')) { throw 'Run this script from the BUKLOD project root.' }
if (-not (Test-Path 'app.config.js')) { throw 'app.config.js not found.' }
if (-not (Test-Path 'eas.json')) { throw 'eas.json not found.' }
if (-not (Test-Path 'scripts\RESTORE_CANONICAL_R31_R40.ps1')) { throw 'Canonical R31/R40 recovery script is missing.' }
if (-not (Test-Path 'scripts\game-kingdom-release-contract.mjs')) { throw 'Kingdom game release contract is missing.' }

$env:APP_VARIANT = 'production'
$env:EXPO_PUBLIC_APP_ENV = 'production'
$env:BUKLOD_WEB_OUTPUT = 'single'

Write-Host 'Checking Expo authentication...' -ForegroundColor Yellow
npx eas-cli@latest whoami
if ($LASTEXITCODE -ne 0) {
  throw 'Expo authentication is required. Run: npx eas-cli@latest login'
}

Write-Host 'Pulling EAS production environment for the client bundle...' -ForegroundColor Yellow
npx eas-cli@latest env:pull --environment production --path .env.local --non-interactive
if ($LASTEXITCODE -ne 0) {
  throw 'Could not pull EAS production environment. Deployment stopped.'
}

if (-not (Test-Path '.env.local')) {
  throw '.env.local was not created by EAS env:pull. Deployment stopped.'
}

$envLines = Get-Content '.env.local'
$supabaseUrlLine = $envLines | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_URL=.+$' } | Select-Object -First 1
$supabaseKeyLine = $envLines | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.+$' } | Select-Object -First 1
if (-not $supabaseUrlLine -or -not $supabaseKeyLine) {
  Write-Host 'Required EAS production Supabase client variables are missing or unreadable.' -ForegroundColor Red
  Write-Host 'Required: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' -ForegroundColor Yellow
  throw 'Production environment preflight failed. Deployment stopped.'
}
Write-Host 'Production Supabase client environment verified.' -ForegroundColor Green

Write-Host 'Installing locked dependencies...' -ForegroundColor Yellow
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Host 'Forward-restoring canonical R31/R40 package from verified recovery roots...' -ForegroundColor Yellow
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\RESTORE_CANONICAL_R31_R40.ps1' -ProjectRoot (Get-Location).Path
if ($LASTEXITCODE -ne 0) {
  throw 'Canonical R31/R40 recovery failed. No deployment attempted.'
}

Write-Host 'Checking canonical R31/R40 character release lock...' -ForegroundColor Yellow
npm run character:contract
if ($LASTEXITCODE -ne 0) {
  throw 'R31/R40 character release lock failed. Deployment stopped before TypeScript/export.'
}

Write-Host 'Checking BUKLOD Kingdom game release lock...' -ForegroundColor Yellow
npm run game:contract
if ($LASTEXITCODE -ne 0) {
  throw 'BUKLOD Kingdom game release lock failed. Deployment stopped before TypeScript/export.'
}

Write-Host 'Running TypeScript QA...' -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript QA failed. Deployment stopped.' }

if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }

Write-Host 'Exporting proven single-page BUKLOD production bundle...' -ForegroundColor Yellow
npx expo export --platform web --output-dir dist
if ($LASTEXITCODE -ne 0) { throw 'Expo web export failed. Deployment stopped.' }

if (-not (Test-Path 'dist\index.html')) {
  throw 'dist\index.html is missing. Deployment stopped.'
}

Write-Host 'Checking R31/R40 contract inside compiled web bundle...' -ForegroundColor Yellow
npm run character:contract:dist
if ($LASTEXITCODE -ne 0) {
  throw 'Compiled web bundle failed the R31/R40 release lock. Deployment stopped.'
}

Write-Host 'Creating physical Game Lab SPA route shells...' -ForegroundColor Yellow
$gameRoutes = @(
  'games',
  'games\jawo-forest-trail',
  'games\trudice-playground-memory',
  'games\ace-rescue-grid',
  'games\mitch-restore-mural',
  'games\niel-mission-trail',
  'games\angel-kingdom-treasury',
  'games\vhen-farm-to-market',
  'games\elesur-village-builder',
  'games\phan-enterprise-builder',
  'games\van-living-city-dispatch',
  'games\christian-civic-leadership',
  'games\lhen-rhythm-journey',
  'games\quin-discovery-expedition'
)

foreach ($route in $gameRoutes) {
  $dir = Join-Path 'dist' $route
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Copy-Item 'dist\index.html' (Join-Path $dir 'index.html') -Force
}

$gameLabFile = 'dist\games\index.html'
if (-not (Test-Path $gameLabFile)) {
  throw 'Game Lab SPA shell verification failed. Deployment stopped.'
}

$routeShellCount = ($gameRoutes | Where-Object { Test-Path (Join-Path (Join-Path 'dist' $_) 'index.html') }).Count
if ($routeShellCount -ne $gameRoutes.Count) {
  throw "Expected $($gameRoutes.Count) Game Lab route shells but found $routeShellCount. Deployment stopped."
}

Write-Host "Verified Game Lab route shells: $routeShellCount/$($gameRoutes.Count)" -ForegroundColor Green
Write-Host 'Verified exported Game Lab route: dist\games\index.html' -ForegroundColor Green

Write-Host 'Checking Kingdom contract inside compiled web artifact...' -ForegroundColor Yellow
npm run game:contract:dist
if ($LASTEXITCODE -ne 0) {
  throw 'Compiled web artifact failed the BUKLOD Kingdom release lock. Deployment stopped.'
}

Write-Host 'Publishing to existing Expo Hosting production target...' -ForegroundColor Yellow
npx eas-cli@latest deploy --prod --environment production --non-interactive
if ($LASTEXITCODE -ne 0) { throw 'EAS web deployment failed.' }

Write-Host 'DEPLOY COMPLETE' -ForegroundColor Green
Write-Host 'Verify BUKLOD Main: https://buklod.expo.app' -ForegroundColor Green
Write-Host 'Verify BUKLOD Kingdom: https://buklod.expo.app/games' -ForegroundColor Green
