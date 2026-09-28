$ErrorActionPreference = "Stop"

$Branch = "feature/home-kingdom-standalone-web-20260919"
$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$MainRoot = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM LOCAL HANDOFF E2E R2" -ForegroundColor Cyan
Write-Host " MAIN 8081 / HOME 4173 / KINGDOM 4174 / WEB ONLY / NO PROD WEB DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "QA clone missing: $QaRoot" }
Set-Location $QaRoot

Write-Host ""
Write-Host "1/6 Sync exact feature branch..." -ForegroundColor Yellow
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Fetch FAILED." }
git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "Reset FAILED." }
$Head = (git rev-parse HEAD).Trim()
Write-Host "HEAD=$Head"

if (-not (Test-Path ".\node_modules\expo\bin\cli")) {
  throw "QA node_modules missing. Run the prior R1/R1B QA install first."
}

Write-Host ""
Write-Host "2/6 Reusing local environment only..." -ForegroundColor Yellow
$EnvCandidates = @(
  "$MainRoot\.env",
  "$MainRoot\.env.local"
)
$Copied = $false
foreach ($candidate in $EnvCandidates) {
  if (Test-Path $candidate) {
    $leaf = Split-Path $candidate -Leaf
    Copy-Item $candidate ".\$leaf" -Force
    Write-Host "Copied local $leaf into isolated QA clone (gitignored)." -ForegroundColor DarkGray
    $Copied = $true
  }
}
if (-not $Copied) {
  Write-Host "No .env/.env.local copied. Existing shell environment will be used." -ForegroundColor Yellow
}

$env:EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL = "http://127.0.0.1:8081"
$env:BUKLOD_APP_TARGET = "main"

Write-Host ""
Write-Host "3/6 TypeScript + standalone exports..." -ForegroundColor Yellow
node ".\node_modules\typescript\bin\tsc" --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED." }

if (Test-Path ".\dist-home-e2e") { Remove-Item ".\dist-home-e2e" -Recurse -Force }
if (Test-Path ".\dist-kingdom-e2e") { Remove-Item ".\dist-kingdom-e2e" -Recurse -Force }

node scripts/export-standalone-web.mjs home dist-home-e2e
if ($LASTEXITCODE -ne 0) { throw "Home E2E export FAILED." }

node scripts/export-standalone-web.mjs kingdom dist-kingdom-e2e
if ($LASTEXITCODE -ne 0) { throw "Kingdom E2E export FAILED." }

Write-Host ""
Write-Host "4/6 Verifying edge auth + starting standalone staging servers..." -ForegroundColor Yellow
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
  Write-Host "PASS: edge function rejects unauthenticated entry (401)." -ForegroundColor Green
}

Start-Process -FilePath "node" -ArgumentList @("scripts/serve-standalone-static.mjs","dist-home-e2e","4173") -WorkingDirectory $QaRoot | Out-Null
Start-Process -FilePath "node" -ArgumentList @("scripts/serve-standalone-static.mjs","dist-kingdom-e2e","4174") -WorkingDirectory $QaRoot | Out-Null
Start-Sleep -Seconds 2

foreach ($url in @("http://127.0.0.1:4173","http://127.0.0.1:4174")) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 8
    if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
    Write-Host "PASS: $url" -ForegroundColor Green
  } catch {
    throw "Standalone staging server failed: $url :: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "5/6 Starting BUKLOD Main local web..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList @(".\node_modules\expo\bin\cli","start","--web","--port","8081") -WorkingDirectory $QaRoot | Out-Null

Write-Host ""
Write-Host "6/6 MANUAL E2E CHECK" -ForegroundColor Yellow
Write-Host "Open: http://127.0.0.1:8081"
Write-Host ""
Write-Host "A. Sign in to BUKLOD Main locally."
Write-Host "B. Open HOME door -> must land at http://127.0.0.1:4173 with the same authenticated user."
Write-Host "C. Confirm URL token hash disappears after exchange."
Write-Host "D. Refresh Home -> must stay authenticated; no white screen."
Write-Host "E. Return to Main, open KINGDOM -> must land at http://127.0.0.1:4174."
Write-Host "F. Refresh Kingdom and enter a game -> no white screen; Back returns correctly."
Write-Host "G. Paste a Home/Kingdom route directly in its local origin -> SPA must render or route safely."
Write-Host ""
Write-Host "Keep the three local server processes running until checks are complete." -ForegroundColor Yellow
Write-Host "NO PRODUCTION WEB DEPLOY WAS PERFORMED." -ForegroundColor Green
