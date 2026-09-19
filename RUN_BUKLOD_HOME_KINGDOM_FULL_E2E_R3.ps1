$ErrorActionPreference = "Stop"

$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$MainRoot = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN"
$Branch = "feature/home-kingdom-standalone-web-20260919"
$HomeDist = "dist-home-r3"
$KingdomDist = "dist-kingdom-r3"

$GameIds = @(
  "ace-rescue-grid",
  "angel-kingdom-treasury",
  "christian-civic-leadership",
  "elesur-village-builder",
  "jawo-forest-trail",
  "lhen-rhythm-journey",
  "mitch-restore-mural",
  "niel-mission-trail",
  "phan-enterprise-builder",
  "quin-discovery-expedition",
  "trudice-playground-memory",
  "van-living-city-dispatch",
  "vhen-farm-to-market"
)
$HomeTools = @("budget","media","recipe","reminders")

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM FULL E2E R3 - AUTOMATED GATE" -ForegroundColor Cyan
Write-Host " ALL ROUTES + SOURCE CONTRACT + EXACT EXPORTS / WEB ONLY / NO DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "QA clone missing: $QaRoot" }
Set-Location $QaRoot

function Test-BuklodUrl([string]$Url, [int]$TimeoutSec = 5) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  } catch { return $false }
}

function Wait-BuklodUrl([string]$Url, [int]$Attempts = 30) {
  for ($i=1; $i -le $Attempts; $i++) {
    if (Test-BuklodUrl $Url 3) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Stop-BuklodNodePort([int]$Port) {
  $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $pidToStop = [int]$listener.OwningProcess
    if ($pidToStop -le 0) { continue }
    $proc = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    if ($proc.ProcessName -notmatch "^(node|nodejs)$") {
      throw "Port $Port is occupied by non-Node process $($proc.ProcessName) PID $pidToStop. Refusing to kill it."
    }
    Stop-Process -Id $pidToStop -Force
    Start-Sleep -Milliseconds 350
  }
}

Write-Host ""
Write-Host "1/8 Sync exact feature branch..." -ForegroundColor Yellow
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Fetch FAILED." }
git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "Reset FAILED." }
$Head = (git rev-parse HEAD).Trim()
Write-Host "HEAD=$Head"
if (-not (Test-Path ".\node_modules\expo\bin\cli")) { throw "Existing QA node_modules missing." }

if (Test-Path "$MainRoot\.env.local") { Copy-Item "$MainRoot\.env.local" ".\.env.local" -Force }
if (Test-Path "$MainRoot\.env") { Copy-Item "$MainRoot\.env" ".\.env" -Force }
$env:EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL = "http://127.0.0.1:8081"

Write-Host ""
Write-Host "2/8 TypeScript..." -ForegroundColor Yellow
node ".\node_modules\typescript\bin\tsc" --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED. R3 STOPPED." }
Write-Host "PASS: TypeScript clean." -ForegroundColor Green

Write-Host ""
Write-Host "3/8 Exhaustive source/backend-wiring contract..." -ForegroundColor Yellow
node scripts/home-kingdom-standalone-e2e-contract.mjs
if ($LASTEXITCODE -ne 0) { throw "R3 source contract FAILED. R3 STOPPED." }

Write-Host ""
Write-Host "4/8 Exact standalone exports..." -ForegroundColor Yellow
if (Test-Path ".\$HomeDist") { Remove-Item ".\$HomeDist" -Recurse -Force }
if (Test-Path ".\$KingdomDist") { Remove-Item ".\$KingdomDist" -Recurse -Force }
node scripts/export-standalone-web.mjs home $HomeDist
if ($LASTEXITCODE -ne 0) { throw "Home R3 export FAILED." }
node scripts/export-standalone-web.mjs kingdom $KingdomDist
if ($LASTEXITCODE -ne 0) { throw "Kingdom R3 export FAILED." }
if (-not (Test-Path ".\$HomeDist\index.html")) { throw "Home R3 index missing." }
if (-not (Test-Path ".\$KingdomDist\index.html")) { throw "Kingdom R3 index missing." }
Write-Host "PASS: both exact R3 exports exist." -ForegroundColor Green

Write-Host ""
Write-Host "5/8 Restart exact R3 local servers..." -ForegroundColor Yellow
foreach ($port in @(4173,4174,8081)) { Stop-BuklodNodePort $port }
Start-Process -FilePath "node" -ArgumentList @("scripts/serve-standalone-static.mjs",$HomeDist,"4173") -WorkingDirectory $QaRoot | Out-Null
Start-Process -FilePath "node" -ArgumentList @("scripts/serve-standalone-static.mjs",$KingdomDist,"4174") -WorkingDirectory $QaRoot | Out-Null
if (-not (Wait-BuklodUrl "http://127.0.0.1:4173" 15)) { throw "Home R3 server failed." }
if (-not (Wait-BuklodUrl "http://127.0.0.1:4174" 15)) { throw "Kingdom R3 server failed." }
Write-Host "PASS: exact Home/Kingdom R3 servers ready." -ForegroundColor Green

Write-Host ""
Write-Host "6/8 Every standalone direct route..." -ForegroundColor Yellow
$HomeRoutes = @("http://127.0.0.1:4173/") + ($HomeTools | ForEach-Object { "http://127.0.0.1:4173/personal-home/$_" })
$KingdomRoutes = @("http://127.0.0.1:4174/") + ($GameIds | ForEach-Object { "http://127.0.0.1:4174/games/$_" })
foreach ($url in @($HomeRoutes + $KingdomRoutes)) {
  if (-not (Test-BuklodUrl $url 8)) { throw "Direct route FAILED: $url" }
  Write-Host "PASS: $url" -ForegroundColor Green
}

Write-Host ""
Write-Host "7/8 Secure handoff guard + exact Main..." -ForegroundColor Yellow
$FunctionUrl = "https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-surface-main-entry-v1"
try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri $FunctionUrl -ContentType "application/json" -Body '{"target":"home"}' -TimeoutSec 10 | Out-Null
  throw "Edge auth gate unexpectedly accepted unauthenticated request."
} catch {
  $status = $null
  try { $status = [int]$_.Exception.Response.StatusCode } catch {}
  if ($status -ne 401) { throw "Expected handoff HTTP 401, got: $($_.Exception.Message)" }
}
Write-Host "PASS: unauthenticated handoff rejected (401)." -ForegroundColor Green

$env:BUKLOD_APP_TARGET = "main"
Start-Process -FilePath "node" -ArgumentList @(".\node_modules\expo\bin\cli","start","--web","--port","8081") -WorkingDirectory $QaRoot | Out-Null
if (-not (Wait-BuklodUrl "http://127.0.0.1:8081" 30)) { throw "Exact R3 Main did not become ready." }
Write-Host "PASS: exact R3 Main ready at http://127.0.0.1:8081" -ForegroundColor Green

Write-Host ""
Write-Host "8/8 Freeze automated evidence..." -ForegroundColor Yellow
$Evidence = @(
  "BUKLOD HOME + KINGDOM R3 AUTOMATED = PASS",
  "HEAD=$Head",
  "HOME_ROUTES=$($HomeRoutes.Count)",
  "KINGDOM_ROUTES=$($KingdomRoutes.Count)",
  "NO_PRODUCTION_DEPLOY=TRUE",
  "FINAL_DONE=FALSE",
  "REASON=Authenticated browser all-button E2E finalizer still required"
)
$EvidencePath = "$HOME\Downloads\BUKLOD_HOME_KINGDOM_R3_AUTOMATED_PASS.txt"
$Evidence | Set-Content $EvidencePath
Write-Host "Evidence: $EvidencePath" -ForegroundColor DarkGray
Start-Process "http://127.0.0.1:8081"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " R3 AUTOMATED GATE = PASS" -ForegroundColor Green
Write-Host " FINAL DONE = NO" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Next: authenticated browser all-button finalizer on this exact HEAD."
Write-Host "NO PRODUCTION WEB DEPLOY WAS PERFORMED." -ForegroundColor Yellow
