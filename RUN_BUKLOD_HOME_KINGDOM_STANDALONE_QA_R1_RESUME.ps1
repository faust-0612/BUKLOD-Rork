$ErrorActionPreference = "Stop"

$Branch = "feature/home-kingdom-standalone-web-20260919"
$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$PassedHead = "285b9966a5c8969a4c90b8d2df445383d9df31aa"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM STANDALONE WEB QA R1B - RESUME" -ForegroundColor Cyan
Write-Host " RESUME AFTER WINDOWS npx.cmd EINVAL / NO NPM CI / NO DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "Existing QA clone not found: $QaRoot" }
Set-Location $QaRoot

$CurrentHead = (git rev-parse HEAD).Trim()
Write-Host "LOCAL_HEAD=$CurrentHead"
if ($CurrentHead -ne $PassedHead) {
  throw "Unexpected QA baseline. Expected $PassedHead but found $CurrentHead. Do not resume over an unknown checkout."
}

Write-Host ""
Write-Host "1/5 Fetching Windows launcher fix only..." -ForegroundColor Yellow
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Fetch FAILED." }
$RemoteHead = (git rev-parse "origin/$Branch").Trim()
Write-Host "REMOTE_HEAD=$RemoteHead"

$Changed = @(git diff --name-only "$PassedHead..$RemoteHead")
$Allowed = @(
  "scripts/export-standalone-web.mjs",
  "scripts/start-standalone-web.mjs",
  "RUN_BUKLOD_HOME_KINGDOM_STANDALONE_QA_R1_RESUME.ps1"
)
$Unexpected = @($Changed | Where-Object { $_ -notin $Allowed })
if ($Unexpected.Count -gt 0) {
  Write-Host "Unexpected files since passed baseline:" -ForegroundColor Red
  $Unexpected | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  throw "Resume scope guard FAILED."
}
Write-Host "PASS: only Windows launcher/resume files changed." -ForegroundColor Green

git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "Reset to fixed branch FAILED." }

$ExpoCli = ".\node_modules\expo\bin\cli"
if (-not (Test-Path $ExpoCli)) {
  throw "Existing node_modules is missing Expo CLI. Inspect the QA folder before reinstalling dependencies."
}
Write-Host "PASS: existing node_modules reused." -ForegroundColor Green

Write-Host ""
Write-Host "2/5 Exporting standalone Home..." -ForegroundColor Yellow
if (Test-Path ".\dist-home-qa") { Remove-Item ".\dist-home-qa" -Recurse -Force }
node scripts/export-standalone-web.mjs home dist-home-qa
if ($LASTEXITCODE -ne 0) { throw "Home export FAILED. No release." }
if (-not (Test-Path ".\dist-home-qa\index.html")) { throw "Home index.html missing." }
$HomeJs = @(Get-ChildItem ".\dist-home-qa\_expo\static\js" -Recurse -Filter "*.js" -ErrorAction SilentlyContinue)
if ($HomeJs.Count -lt 1) { throw "Home JS bundle missing." }
Write-Host "PASS: Home standalone export." -ForegroundColor Green

Write-Host ""
Write-Host "3/5 Exporting standalone Kingdom..." -ForegroundColor Yellow
if (Test-Path ".\dist-kingdom-qa") { Remove-Item ".\dist-kingdom-qa" -Recurse -Force }
node scripts/export-standalone-web.mjs kingdom dist-kingdom-qa
if ($LASTEXITCODE -ne 0) { throw "Kingdom export FAILED. No release." }
if (-not (Test-Path ".\dist-kingdom-qa\index.html")) { throw "Kingdom index.html missing." }
$KingdomJs = @(Get-ChildItem ".\dist-kingdom-qa\_expo\static\js" -Recurse -Filter "*.js" -ErrorAction SilentlyContinue)
if ($KingdomJs.Count -lt 1) { throw "Kingdom JS bundle missing." }
Write-Host "PASS: Kingdom standalone export." -ForegroundColor Green

Write-Host ""
Write-Host "4/5 Rechecking Main launch-only boundary..." -ForegroundColor Yellow
$homeBoundary = Get-Content ".\src\app\personal-home\_layout.web.tsx" -Raw
$kingdomBoundary = Get-Content ".\src\app\games\_layout.web.tsx" -Raw
$handoff = Get-Content ".\src\lib\buklodStandaloneEntry.ts" -Raw
$gate = Get-Content ".\src\components\standalone\BuklodStandaloneSessionGate.tsx" -Raw
if ($homeBoundary -notmatch 'target="home"') { throw "Home Main boundary missing." }
if ($kingdomBoundary -notmatch 'target="kingdom"') { throw "Kingdom Main boundary missing." }
if ($handoff -notmatch 'buklod-surface-main-entry-v1') { throw "Secure handoff bridge missing." }
if ($gate -notmatch 'buklod_surface_token_hash') { throw "Standalone token gate missing." }
if ($gate -notmatch 'verifyOtp') { throw "Standalone token exchange missing." }
Write-Host "PASS: Main web remains launch-only." -ForegroundColor Green

Write-Host ""
Write-Host "5/5 Final exact-head verification..." -ForegroundColor Yellow
$FinalHead = (git rev-parse HEAD).Trim()
$FinalStatus = @(git status --short --untracked-files=all | Where-Object { $_ -notmatch 'dist-home-qa|dist-kingdom-qa' })
Write-Host "FINAL_HEAD=$FinalHead"
if ($FinalHead -ne $RemoteHead) { throw "Final HEAD mismatch." }
if ($FinalStatus.Count -gt 0) {
  Write-Host ($FinalStatus -join [Environment]::NewLine)
  throw "Unexpected source changes in QA clone."
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " HOME + KINGDOM STANDALONE WEB QA R1B = PASS" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "PASS: TypeScript was already clean at protected baseline $PassedHead"
Write-Host "PASS: Windows Expo launcher fixed without source feature changes"
Write-Host "PASS: Home standalone export"
Write-Host "PASS: Kingdom standalone export"
Write-Host "PASS: Main web launch-only boundary"
Write-Host "NO PRODUCTION DEPLOY WAS PERFORMED." -ForegroundColor Yellow
Write-Host "Next gate: staging URLs + secure Main-to-Home/Main-to-Kingdom handoff E2E."
