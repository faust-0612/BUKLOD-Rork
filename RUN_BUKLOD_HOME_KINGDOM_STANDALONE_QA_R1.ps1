$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/faust-0612/BUKLOD-Rork.git"
$Branch  = "feature/home-kingdom-standalone-web-20260919"
$QaRoot  = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM STANDALONE WEB QA R1" -ForegroundColor Cyan
Write-Host " WEB ONLY / ISOLATED QA CLONE / NO MAIN DEPLOY / NO NATIVE BUILD" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (Test-Path $QaRoot) {
  Remove-Item $QaRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Split-Path $QaRoot) | Out-Null

Write-Host ""
Write-Host "1/7 Cloning exact feature branch..." -ForegroundColor Yellow
git clone --branch $Branch --single-branch $RepoUrl $QaRoot
if ($LASTEXITCODE -ne 0) { throw "Git clone FAILED." }

Set-Location $QaRoot
$Head = (git rev-parse HEAD).Trim()
Write-Host "HEAD=$Head"
Write-Host "BRANCH=$Branch"

Write-Host ""
Write-Host "2/7 Installing exact dependencies..." -ForegroundColor Yellow
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "npm ci FAILED." }

Write-Host ""
Write-Host "3/7 TypeScript..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED. No release." }

Write-Host ""
Write-Host "4/7 Verifying target isolation..." -ForegroundColor Yellow
@'
const assert = require('node:assert/strict');
const factory = require('./app.config.js');

const keys = [
  'BUKLOD_APP_TARGET',
  'APP_VARIANT',
  'EXPO_PUBLIC_APP_ENV',
  'EAS_PROJECT_ID',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
  'BUKLOD_HOME_EAS_PROJECT_ID',
  'BUKLOD_KINGDOM_EAS_PROJECT_ID',
  'CLASSROOM_GOOGLE_SERVICES_FILE',
];
for (const key of keys) delete process.env[key];

const main = factory({ config: { extra: {} } });
assert.equal(main.name, 'BUKLOD');
assert.equal(main.slug, 'buklod');
assert.equal(main.extra.appTarget, 'main');
assert.equal(main.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');

process.env.BUKLOD_APP_TARGET = 'home';
const home = factory({ config: { extra: {} } });
assert.equal(home.name, 'BUKLOD Home');
assert.equal(home.slug, 'buklod-home');
assert.equal(home.extra.appTarget, 'home');
assert.equal(home.extra.eas, undefined);
assert.equal(home.android.googleServicesFile, undefined);

process.env.BUKLOD_APP_TARGET = 'kingdom';
const kingdom = factory({ config: { extra: {} } });
assert.equal(kingdom.name, 'BUKLOD Kingdom');
assert.equal(kingdom.slug, 'buklod-kingdom');
assert.equal(kingdom.extra.appTarget, 'kingdom');
assert.equal(kingdom.extra.eas, undefined);
assert.equal(kingdom.android.googleServicesFile, undefined);

console.log('TARGET_ISOLATION=PASS');
'@ | node
if ($LASTEXITCODE -ne 0) { throw "Target isolation FAILED. No release." }

Write-Host ""
Write-Host "5/7 Exporting standalone Home..." -ForegroundColor Yellow
node scripts/export-standalone-web.mjs home dist-home-qa
if ($LASTEXITCODE -ne 0) { throw "Home export FAILED. No release." }
if (-not (Test-Path ".\dist-home-qa\index.html")) { throw "Home index.html missing." }

Write-Host ""
Write-Host "6/7 Exporting standalone Kingdom..." -ForegroundColor Yellow
node scripts/export-standalone-web.mjs kingdom dist-kingdom-qa
if ($LASTEXITCODE -ne 0) { throw "Kingdom export FAILED. No release." }
if (-not (Test-Path ".\dist-kingdom-qa\index.html")) { throw "Kingdom index.html missing." }

Write-Host ""
Write-Host "7/7 Verifying Main is launch-only on web..." -ForegroundColor Yellow
$homeBoundary = Get-Content ".\src\app\personal-home\_layout.web.tsx" -Raw
$kingdomBoundary = Get-Content ".\src\app\games\_layout.web.tsx" -Raw
$handoff = Get-Content ".\src\lib\buklodStandaloneEntry.ts" -Raw
$gate = Get-Content ".\src\components\standalone\BuklodStandaloneSessionGate.tsx" -Raw

if ($homeBoundary -notmatch 'target="home"') { throw "Home Main boundary missing." }
if ($kingdomBoundary -notmatch 'target="kingdom"') { throw "Kingdom Main boundary missing." }
if ($handoff -notmatch 'buklod-surface-main-entry-v1') { throw "Secure handoff bridge missing." }
if ($gate -notmatch 'buklod_surface_token_hash') { throw "Standalone token gate missing." }
if ($gate -notmatch 'verifyOtp') { throw "Standalone token exchange missing." }

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " HOME + KINGDOM STANDALONE WEB QA R1 = PASS" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "PASS: TypeScript"
Write-Host "PASS: Main target unchanged"
Write-Host "PASS: Home target isolated"
Write-Host "PASS: Kingdom target isolated"
Write-Host "PASS: Home standalone export"
Write-Host "PASS: Kingdom standalone export"
Write-Host "PASS: Main web launch-only boundary"
Write-Host ""
Write-Host "NO PRODUCTION DEPLOY WAS PERFORMED." -ForegroundColor Yellow
Write-Host "Next gate after this PASS: configure staging URLs + secure handoff E2E."
