$ErrorActionPreference = "Stop"

$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$MainRoot = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN"
$Branch = "feature/home-kingdom-standalone-web-20260919"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM LOCAL HANDOFF E2E R2B - SELF HEAL" -ForegroundColor Cyan
Write-Host " AUTO-START HOME/KINGDOM/MAIN / WEB ONLY / NO PROD DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "QA clone missing: $QaRoot" }
Set-Location $QaRoot

Write-Host ""
Write-Host "1/6 Syncing exact feature branch..." -ForegroundColor Yellow
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Fetch FAILED." }
git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "Reset FAILED." }

$Head = (git rev-parse HEAD).Trim()
Write-Host "HEAD=$Head"

if (-not (Test-Path ".\node_modules\expo\bin\cli")) {
  throw "Existing QA node_modules missing. Run the earlier R1 install once."
}

if (Test-Path "$MainRoot\.env.local") {
  Copy-Item "$MainRoot\.env.local" ".\.env.local" -Force
}
if (Test-Path "$MainRoot\.env") {
  Copy-Item "$MainRoot\.env" ".\.env" -Force
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

function Wait-BuklodUrl([string]$Url, [int]$Attempts = 30) {
  for ($i = 1; $i -le $Attempts; $i++) {
    if (Test-BuklodUrl $Url 3) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Ensure-StandaloneServer(
  [string]$Name,
  [string]$Target,
  [string]$Dist,
  [int]$Port
) {
  $Url = "http://127.0.0.1:$Port"

  if (Test-BuklodUrl $Url 3) {
    Write-Host "PASS: $Name already running at $Url" -ForegroundColor Green
    return
  }

  if (-not (Test-Path ".\$Dist\index.html")) {
    Write-Host "$Name export missing. Rebuilding only $Name..." -ForegroundColor DarkGray
    node scripts/export-standalone-web.mjs $Target $Dist
    if ($LASTEXITCODE -ne 0) {
      throw "$Name standalone export FAILED."
    }
  } else {
    Write-Host "$Name export already exists; reusing $Dist." -ForegroundColor DarkGray
  }

  Write-Host "Starting $Name staging server on port $Port..." -ForegroundColor DarkGray
  Start-Process -FilePath "node" -ArgumentList @(
    "scripts/serve-standalone-static.mjs",
    $Dist,
    "$Port"
  ) -WorkingDirectory $QaRoot | Out-Null

  if (-not (Wait-BuklodUrl $Url 15)) {
    throw "$Name local server did not become ready at $Url."
  }

  Write-Host "PASS: $Name started at $Url" -ForegroundColor Green
}

Write-Host ""
Write-Host "2/6 Self-healing Home + Kingdom staging servers..." -ForegroundColor Yellow
Ensure-StandaloneServer "Home" "home" "dist-home-e2e" 4173
Ensure-StandaloneServer "Kingdom" "kingdom" "dist-kingdom-e2e" 4174

Write-Host ""
Write-Host "3/6 Verifying secure edge auth gate..." -ForegroundColor Yellow
$FunctionUrl = "https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-surface-main-entry-v1"
try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri $FunctionUrl -ContentType "application/json" -Body '{"target":"home"}' -TimeoutSec 10 | Out-Null
  throw "Edge auth gate unexpectedly accepted an unauthenticated request."
} catch {
  $status = $null
  try { $status = [int]$_.Exception.Response.StatusCode } catch {}
  if ($status -ne 401) {
    throw "Edge auth gate preflight expected HTTP 401 but got: $($_.Exception.Message)"
  }
}
Write-Host "PASS: edge function rejects unauthenticated entry (401)." -ForegroundColor Green

Write-Host ""
Write-Host "4/6 Self-healing BUKLOD Main on 8081..." -ForegroundColor Yellow
if (-not (Test-BuklodUrl "http://127.0.0.1:8081" 3)) {
  Write-Host "Starting exact QA Main..." -ForegroundColor DarkGray
  Start-Process -FilePath "node" -ArgumentList @(
    ".\node_modules\expo\bin\cli",
    "start",
    "--web",
    "--port",
    "8081"
  ) -WorkingDirectory $QaRoot | Out-Null
}

if (-not (Wait-BuklodUrl "http://127.0.0.1:8081" 30)) {
  throw "BUKLOD Main did not become ready on http://127.0.0.1:8081."
}
Write-Host "PASS: Main local web is ready on 8081." -ForegroundColor Green

Write-Host ""
Write-Host "5/6 Direct-route HTTP preflight..." -ForegroundColor Yellow
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
Write-Host "6/6 Opening Main for authenticated handoff verification..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:8081"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " AUTOMATED R2B SELF-HEAL PREFLIGHT = PASS" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Now complete these browser checks:"
Write-Host "  1. Sign in to local BUKLOD Main."
Write-Host "  2. HOME door -> http://127.0.0.1:4173/; token hash must disappear."
Write-Host "  3. Refresh Home -> same signed-in user; no white screen."
Write-Host "  4. Return to Main -> KINGDOM door -> http://127.0.0.1:4174/."
Write-Host "  5. Enter one Kingdom game, refresh, then Back -> no white screen."
Write-Host ""
Write-Host "NO PRODUCTION WEB DEPLOY WAS PERFORMED." -ForegroundColor Yellow
