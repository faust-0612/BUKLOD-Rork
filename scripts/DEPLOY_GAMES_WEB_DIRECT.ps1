$ErrorActionPreference = 'Stop'

Write-Host 'BUKLOD Game Lab — Protected Canonical Expo Web Deploy' -ForegroundColor Cyan

# Production deployment is intentionally impossible from random clones/snapshots.
# RUN_CANONICAL_WEB_RELEASE.ps1 creates a fresh disposable staging clone and sets
# these authorization variables after verifying the centralized workspace.
if ($env:BUKLOD_CANONICAL_RELEASE -ne '1') {
  throw 'Direct production deploy is blocked. Run SOURCE\BUKLOD-MAIN\scripts\RUN_CANONICAL_WEB_RELEASE.ps1 from the centralized BUKLOD_WORKSPACE.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_WORKSPACE_ROOT)) {
  throw 'BUKLOD_WORKSPACE_ROOT is missing. Canonical deployment authorization failed.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_R31_R40_RECOVERY_ROOT)) {
  throw 'BUKLOD_R31_R40_RECOVERY_ROOT is missing. Canonical R31/R40 recovery cannot be proven.'
}

$scriptPath = $PSCommandPath
$scriptHashBefore = $null
if ($scriptPath -and (Test-Path $scriptPath)) {
  $scriptHashBefore = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
}

$branch = (git symbolic-ref --short -q HEAD 2>$null)
if ($branch) { $branch = $branch.Trim() }
if (-not $branch) {
  throw 'Canonical disposable release clone is unexpectedly detached. Deployment stopped; no reset performed.'
}
if ($branch -ne 'main') {
  throw "Production web release requires branch main. Current branch: $branch"
}

Write-Host 'Refreshing canonical main inside disposable staging...' -ForegroundColor Yellow
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'git pull failed. Deployment stopped.' }

if ($scriptPath -and (Test-Path $scriptPath) -and $scriptHashBefore) {
  $scriptHashAfter = (Get-FileHash $scriptPath -Algorithm SHA256).Hash
  if ($scriptHashAfter -ne $scriptHashBefore) {
    Write-Host 'Deploy implementation updated during pull. Relaunching latest protected copy...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path 'package.json')) { throw 'package.json missing from canonical release staging.' }
if (-not (Test-Path 'package-lock.json')) { throw 'package-lock.json missing from canonical release staging.' }
if (-not (Test-Path 'app.config.js')) { throw 'app.config.js not found.' }
if (-not (Test-Path 'eas.json')) { throw 'eas.json not found.' }
if (-not (Test-Path 'scripts\RESTORE_CANONICAL_R31_R40.ps1')) { throw 'Canonical R31/R40 recovery script is missing.' }
if (-not (Test-Path 'scripts\game-kingdom-release-contract.mjs')) { throw 'Kingdom game release contract is missing.' }

$env:APP_VARIANT = 'production'
$env:EXPO_PUBLIC_APP_ENV = 'production'
$env:BUKLOD_WEB_OUTPUT = 'single'

# IMPORTANT: install first. EAS env:pull resolves app.config.js and config plugins,
# so a fresh disposable clone needs node_modules before env:pull can succeed.
# Include dev dependencies explicitly because TypeScript QA requires @types/jest.
Write-Host 'Installing locked dependencies before Expo config resolution...' -ForegroundColor Yellow
npm ci --ignore-scripts --include=dev
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

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

Write-Host 'Overlaying approved R31/R40 recovery package into disposable release staging...' -ForegroundColor Yellow
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\RESTORE_CANONICAL_R31_R40.ps1' `
  -ProjectRoot (Get-Location).Path `
  -RecoveryRoots @($env:BUKLOD_R31_R40_RECOVERY_ROOT)
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

Write-Host 'Creating physical BUKLOD Kingdom SPA route shells...' -ForegroundColor Yellow
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
  throw 'BUKLOD Kingdom SPA shell verification failed. Deployment stopped.'
}

$routeShellCount = ($gameRoutes | Where-Object { Test-Path (Join-Path (Join-Path 'dist' $_) 'index.html') }).Count
if ($routeShellCount -ne $gameRoutes.Count) {
  throw "Expected $($gameRoutes.Count) Kingdom route shells but found $routeShellCount. Deployment stopped."
}

Write-Host "Verified BUKLOD Kingdom route shells: $routeShellCount/$($gameRoutes.Count)" -ForegroundColor Green
Write-Host 'Verified exported Kingdom route: dist\games\index.html' -ForegroundColor Green

Write-Host 'Checking Kingdom contract inside compiled web artifact...' -ForegroundColor Yellow
npm run game:contract:dist
if ($LASTEXITCODE -ne 0) {
  throw 'Compiled web artifact failed the BUKLOD Kingdom release lock. Deployment stopped.'
}

Write-Host 'Publishing WEB ONLY to existing Expo Hosting production target...' -ForegroundColor Yellow
npx eas-cli@latest deploy --prod --environment production --non-interactive
if ($LASTEXITCODE -ne 0) { throw 'EAS web deployment failed.' }

Write-Host 'DEPLOY COMPLETE — WEB ONLY' -ForegroundColor Green
Write-Host 'Verify BUKLOD Main: https://buklod.expo.app' -ForegroundColor Green
Write-Host 'Verify BUKLOD Kingdom: https://buklod.expo.app/games' -ForegroundColor Green
