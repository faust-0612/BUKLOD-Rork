param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$RcBranch = "release/buklod-main-final-20260920",
  [Parameter(Mandatory=$true)]
  [string]$ExpectedRcSha
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-NativeSuccess([string]$Context) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Context FAILED with exit code $LASTEXITCODE"
  }
}

function Load-DotEnv([string]$Path) {
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $pair = $line.Split("=", 2)
    $name = $pair[0].Trim()
    $value = $pair[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RELEASE - PHASE 2 RESUME" -ForegroundColor Green
Write-Host " SUPPORT BACKEND HEALTH -> EXACT RC -> MAIN -> WEB" -ForegroundColor Green
Write-Host " SAME FROZEN SHA ONLY / NO PIECEMEAL RELEASE" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $Repo)) { throw "Canonical repo not found: $Repo" }
Set-Location -LiteralPath $Repo
$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'faust-0612/BUKLOD-Rork') { throw "Wrong repository remote: $remote" }

git fetch origin main $RcBranch --prune
Assert-NativeSuccess "remote refresh"

$rcSha = (git rev-parse "origin/$RcBranch").Trim()
$mainNow = (git rev-parse origin/main).Trim()
if ($rcSha -ne $ExpectedRcSha) { throw "RC SHA mismatch. Expected $ExpectedRcSha, current remote RC is $rcSha" }

$short = $rcSha.Substring(0, 12)
$qaRoot = "$HOME\BUKLOD_WORKSPACE\QA\BUKLOD_MAIN_FINAL_$short"
$handoffPath = "$qaRoot\buklod-support-backend-handoff.json"
$aabPath = "$qaRoot\eas-aab-build.json"
if (-not (Test-Path -LiteralPath $handoffPath)) { throw "Phase 1 backend handoff proof missing: $handoffPath" }
if (-not (Test-Path -LiteralPath $aabPath)) { throw "Exact-RC AAB record missing: $aabPath" }

$handoff = Get-Content -LiteralPath $handoffPath -Raw | ConvertFrom-Json
if ([string]$handoff.source_sha -ne $rcSha) { throw "Handoff source SHA does not match current RC." }
if ([string]$handoff.main_before -ne $mainNow) { throw "origin/main changed since Phase 1. Release must be re-evaluated." }
if ([string]$handoff.support_schema -ne "BUKLOD_CENTRAL_SUPPORT_V1") { throw "Unexpected support schema handoff." }
if ([string]$handoff.support_function -ne "buklod-support-v1") { throw "Unexpected support function handoff." }

$qaHead = (git -C $qaRoot rev-parse HEAD).Trim()
if ($qaHead -ne $rcSha) { throw "Source-locked QA worktree no longer matches exact RC." }

Write-Host ""
Write-Host "=== 1/4 VERIFY CENTRAL SUPPORT BACKEND HEALTH ===" -ForegroundColor Cyan
$envPath = "$qaRoot\.env.support-release"
Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue
npx.cmd --yes eas-cli@latest env:pull --environment production --path $envPath --non-interactive
Assert-NativeSuccess "production environment pull"
Load-DotEnv $envPath
Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue

$supabaseUrl = [string]$env:EXPO_PUBLIC_SUPABASE_URL
$publishableKey = [string]$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if ($supabaseUrl -ne "https://yhanxndaqbmuzbdqlblu.supabase.co") { throw "Wrong production Supabase URL." }
if (-not $publishableKey) { throw "Production Supabase publishable key missing." }

$healthUri = "$supabaseUrl/functions/v1/buklod-support-v1"
$healthHeaders = @{
  "apikey" = $publishableKey
  "Content-Type" = "application/json"
  "x-buklod-client" = "release-health"
}
$healthBody = @{ action = "health" } | ConvertTo-Json -Compress
$health = Invoke-RestMethod -Method Post -Uri $healthUri -Headers $healthHeaders -Body $healthBody -TimeoutSec 20
if (-not $health.ok) { throw "Central support backend health probe returned not-ready." }
if ([string]$health.service -ne "BUKLOD_SUPPORT_V1") { throw "Unexpected support function revision." }
if ([string]$health.schema -ne "BUKLOD_CENTRAL_SUPPORT_V1") { throw "Unexpected support schema revision." }
if (-not [bool]$health.prelogin) { throw "Pre-login support health contract failed." }
Write-Host "PASS: central Help backend + pre-login contract healthy." -ForegroundColor Green

Write-Host ""
Write-Host "=== 2/4 RE-FREEZE EXACT RC + MAIN ===" -ForegroundColor Cyan
git fetch origin main $RcBranch
Assert-NativeSuccess "pre-cutover remote refresh"
$mainFinal = (git rev-parse origin/main).Trim()
$rcFinal = (git rev-parse "origin/$RcBranch").Trim()
if ($mainFinal -ne [string]$handoff.main_before) { throw "origin/main changed after backend activation. Release aborted." }
if ($rcFinal -ne $rcSha) { throw "RC branch changed after backend activation. Release aborted." }
git merge-base --is-ancestor $mainFinal $rcSha
Assert-NativeSuccess "fast-forward safety check"

Write-Host ""
Write-Host "=== 3/4 ATOMIC FAST-FORWARD VERIFIED RC TO MAIN ===" -ForegroundColor Cyan
$refspec = $rcSha + ":refs/heads/main"
git push origin $refspec
Assert-NativeSuccess "verified RC push to main"

Write-Host ""
Write-Host "=== 4/4 FINAL WEB PRODUCTION PUSH + LIVE VERIFY ===" -ForegroundColor Cyan
Set-Location -LiteralPath $qaRoot
if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "QA worktree SHA drifted before Web deployment." }
$env:NODE_ENV = "production"
npx.cmd --yes eas-cli@latest deploy --prod --environment production --non-interactive
Assert-NativeSuccess "production web deploy"
1..5 | ForEach-Object {
  $response = Invoke-WebRequest -Uri "https://buklod.expo.app/" -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400 -or -not $response.Content) {
    throw "Live web verification failed on attempt $_."
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL CUTOVER COMPLETE" -ForegroundColor Green
Write-Host " SOURCE SHA: $rcSha" -ForegroundColor Green
Write-Host " SUPPORT BACKEND: HEALTHY" -ForegroundColor Green
Write-Host " MAIN: FAST-FORWARDED TO EXACT VERIFIED RC" -ForegroundColor Green
Write-Host " WEB: https://buklod.expo.app" -ForegroundColor Green
Write-Host " AAB BUILD RECORD: $aabPath" -ForegroundColor Green
Write-Host " PHYSICAL DEVICE NATIVE QA STILL REQUIRED BEFORE PLAY SUBMISSION" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
