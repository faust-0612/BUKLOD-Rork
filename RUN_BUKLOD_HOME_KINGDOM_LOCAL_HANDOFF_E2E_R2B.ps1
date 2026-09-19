$ErrorActionPreference = "Stop"

$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$Branch = "feature/home-kingdom-standalone-web-20260919"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM LOCAL HANDOFF E2E R2B" -ForegroundColor Cyan
Write-Host " MAIN READINESS + DIRECT-ROUTE PREFLIGHT / WEB ONLY / NO PROD DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "QA clone missing: $QaRoot" }
Set-Location $QaRoot

Write-Host ""
Write-Host "1/5 Syncing exact feature branch..." -ForegroundColor Yellow
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Fetch FAILED." }
git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "Reset FAILED." }

$Head = (git rev-parse HEAD).Trim()
Write-Host "HEAD=$Head"

if (-not (Test-Path ".\node_modules\expo\bin\cli")) {
  throw "Existing QA node_modules missing."
}

$env:BUKLOD_APP_TARGET = "main"
$env:EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL = "http://127.0.0.1:8081"

function Test-BuklodUrl([string]$Url, [int]$TimeoutSec = 4) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "2/5 Verifying Home + Kingdom local staging servers..." -ForegroundColor Yellow
foreach ($url in @("http://127.0.0.1:4173","http://127.0.0.1:4174")) {
  if (-not (Test-BuklodUrl $url 6)) {
    throw "$url is not running. Run R2 first or restart the standalone staging server."
  }
  Write-Host "PASS: $url" -ForegroundColor Green
}

Write-Host ""
Write-Host "3/5 Waiting for BUKLOD Main on 8081..." -ForegroundColor Yellow
if (-not (Test-BuklodUrl "http://127.0.0.1:8081" 3)) {
  Write-Host "Main is not ready yet. Starting exact QA Main..." -ForegroundColor DarkGray
  Start-Process -FilePath "node" -ArgumentList @(".\node_modules\expo\bin\cli","start","--web","--port","8081") -WorkingDirectory $QaRoot | Out-Null
}

$MainReady = $false
for ($i = 1; $i -le 30; $i++) {
  if (Test-BuklodUrl "http://127.0.0.1:8081" 3) {
    $MainReady = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $MainReady) {
  throw "BUKLOD Main did not become ready on http://127.0.0.1:8081. No handoff test should continue."
}
Write-Host "PASS: Main local web is ready on 8081." -ForegroundColor Green

Write-Host ""
Write-Host "4/5 Direct-route HTTP preflight..." -ForegroundColor Yellow
$Routes = @(
  "http://127.0.0.1:4173/",
  "http://127.0.0.1:4173/personal-home/recipe",
  "http://127.0.0.1:4173/personal-home/budget",
  "http://127.0.0.1:4174/",
  "http://127.0.0.1:4174/games/ace-rescue-grid",
  "http://127.0.0.1:4174/games/van-living-city-dispatch"
)
foreach ($route in $Routes) {
  if (-not (Test-BuklodUrl $route 6)) {
    throw "Direct-route preflight FAILED: $route"
  }
  Write-Host "PASS: $route" -ForegroundColor Green
}

Write-Host ""
Write-Host "5/5 Opening Main for authenticated handoff verification..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:8081"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " AUTOMATED R2B PREFLIGHT = PASS" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Now complete these browser checks:"
Write-Host "  1. Sign in to local BUKLOD Main."
Write-Host "  2. HOME door -> URL must become http://127.0.0.1:4173/ and token hash must disappear."
Write-Host "  3. Refresh Home -> same signed-in user, no white screen."
Write-Host "  4. Return to Main -> KINGDOM door -> http://127.0.0.1:4174/."
Write-Host "  5. Enter one Kingdom game, refresh, then Back -> no white screen."
Write-Host ""
Write-Host "NO PRODUCTION WEB DEPLOY WAS PERFORMED." -ForegroundColor Yellow
