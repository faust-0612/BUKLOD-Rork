param(
  [string]$Repo = "D:\Downloads\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$RcBranch = "release/buklod-main-final-rc-20260923",
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
Write-Host " BUKLOD MAIN FINAL RELEASE - PHASE 2" -ForegroundColor Green
Write-Host " SUPPORT HEALTH -> WEB LIVE VERIFY -> SAME-SHA AAB" -ForegroundColor Green
Write-Host " SAME FROZEN SHA ONLY / NO PIECEMEAL RELEASE" -ForegroundColor Green
Write-Host " C: READ-ONLY / ALL ACTIVE WRITES ON D:" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $Repo)) { throw "Canonical D: repo not found: $Repo" }
if (-not $Repo.StartsWith("D:\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Active release repo must be on D:. C: is read-only."
}
Set-Location -LiteralPath $Repo
$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'faust-0612/BUKLOD-Rork') { throw "Wrong repository remote: $remote" }

$sourceRoot = Split-Path -LiteralPath $Repo -Parent
$workspaceRoot = Split-Path -LiteralPath $sourceRoot -Parent
$qaBase = Join-Path $workspaceRoot "QA"
$cacheRoot = Join-Path $workspaceRoot "CACHE"
$tempRoot = Join-Path $workspaceRoot "TEMP"
New-Item -ItemType Directory -Force -Path $qaBase,$cacheRoot,$tempRoot | Out-Null
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:npm_config_cache = Join-Path $cacheRoot "npm"
$env:GRADLE_USER_HOME = Join-Path $cacheRoot "gradle"
New-Item -ItemType Directory -Force -Path $env:npm_config_cache,$env:GRADLE_USER_HOME | Out-Null

git fetch origin main $RcBranch --prune
Assert-NativeSuccess "remote refresh"

$rcSha = (git rev-parse "origin/$RcBranch").Trim()
$mainNow = (git rev-parse origin/main).Trim()
if ($rcSha -ne $ExpectedRcSha) { throw "RC SHA mismatch. Expected $ExpectedRcSha, current remote RC is $rcSha" }

$short = $rcSha.Substring(0, 12)
$qaRoot = Join-Path $qaBase "BUKLOD_MAIN_FINAL_$short"
$handoffPath = Join-Path $qaRoot "buklod-support-backend-handoff.json"
$aabPath = Join-Path $qaRoot "eas-aab-build.json"
if (-not (Test-Path -LiteralPath $handoffPath)) { throw "Phase 1 backend handoff proof missing: $handoffPath" }

$handoff = Get-Content -LiteralPath $handoffPath -Raw | ConvertFrom-Json
if ([string]$handoff.source_sha -ne $rcSha) { throw "Handoff source SHA does not match current RC." }
if ([string]$handoff.main_before -ne $mainNow) { throw "origin/main changed since Phase 1. Release must be re-evaluated." }
if ([string]$handoff.support_schema -ne "BSOC_USER_FEEDBACK_COMPAT_V1") { throw "Unexpected support schema handoff." }
if ([string]$handoff.support_function -ne "buklod-support-v1") { throw "Unexpected support function handoff." }
if ([string]$handoff.required_release_order -ne "WEB_LIVE_VERIFY_THEN_SAME_SHA_AAB") { throw "Unexpected release order handoff." }

$qaHead = (git -C $qaRoot rev-parse HEAD).Trim()
if ($qaHead -ne $rcSha) { throw "Source-locked QA worktree no longer matches exact RC." }

Write-Host ""
Write-Host "=== 1/5 VERIFY CENTRAL SUPPORT BACKEND HEALTH ===" -ForegroundColor Cyan
$envPath = Join-Path $qaRoot ".env.support-release"
Remove-Item -LiteralPath $envPath -Force -ErrorAction SilentlyContinue
Set-Location -LiteralPath $qaRoot
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
if ([string]$health.schema -ne "BSOC_USER_FEEDBACK_COMPAT_V1") { throw "Unexpected support schema revision." }
if (-not [bool]$health.prelogin) { throw "Pre-login support health contract failed." }
Write-Host "PASS: Help backend + live BSOC compatibility healthy." -ForegroundColor Green

Write-Host ""
Write-Host "=== 2/5 RE-FREEZE EXACT RC + MAIN ===" -ForegroundColor Cyan
Set-Location -LiteralPath $Repo
git fetch origin main $RcBranch
Assert-NativeSuccess "pre-release remote refresh"
$mainFinal = (git rev-parse origin/main).Trim()
$rcFinal = (git rev-parse "origin/$RcBranch").Trim()
if ($mainFinal -ne [string]$handoff.main_before) { throw "origin/main changed after Phase 1. Release aborted." }
if ($rcFinal -ne $rcSha) { throw "RC branch changed after backend activation. Release aborted." }
git merge-base --is-ancestor $mainFinal $rcSha
Assert-NativeSuccess "fast-forward safety check"

Write-Host ""
Write-Host "=== 3/5 FINAL WEB PRODUCTION DEPLOY + LIVE VERIFY ===" -ForegroundColor Cyan
Set-Location -LiteralPath $qaRoot
if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "QA worktree SHA drifted before Web deployment." }
$env:NODE_ENV = "production"
$env:EXPO_PUBLIC_APP_ENV = "production"
$env:APP_VARIANT = "production"
$env:BUKLOD_APP_TARGET = "main"
npx.cmd --yes eas-cli@latest deploy --prod --environment production --non-interactive
Assert-NativeSuccess "production web deploy"

1..5 | ForEach-Object {
  $response = Invoke-WebRequest -Uri "https://buklod.expo.app/" -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400 -or -not $response.Content) {
    throw "Live web verification failed on attempt $_."
  }
  if ($response.Content -notmatch "_expo|BUKLOD|<html") {
    throw "Live web response does not resemble the expected BUKLOD web artifact."
  }
}
Write-Host "PASS: production Web is live from exact RC $rcSha" -ForegroundColor Green

Write-Host ""
Write-Host "=== 4/5 ATOMIC FAST-FORWARD EXACT LIVE-WEB RC TO MAIN ===" -ForegroundColor Cyan
Set-Location -LiteralPath $Repo
git fetch origin main $RcBranch
Assert-NativeSuccess "post-Web remote refresh"
$mainAfterWeb = (git rev-parse origin/main).Trim()
$rcAfterWeb = (git rev-parse "origin/$RcBranch").Trim()
if ($mainAfterWeb -ne [string]$handoff.main_before) { throw "origin/main changed during Web deployment. Stop before Main cutover." }
if ($rcAfterWeb -ne $rcSha) { throw "RC branch changed during Web deployment. Stop before Main cutover." }
git merge-base --is-ancestor $mainAfterWeb $rcSha
Assert-NativeSuccess "post-Web fast-forward safety check"
$refspec = $rcSha + ":refs/heads/main"
git push origin $refspec
Assert-NativeSuccess "verified RC push to main"

Write-Host ""
Write-Host "=== 5/5 BUILD FINAL PRODUCTION AAB FROM SAME LIVE-WEB SHA ===" -ForegroundColor Cyan
Set-Location -LiteralPath $qaRoot
if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "AAB source SHA drifted." }
Remove-Item -LiteralPath $aabPath -Force -ErrorAction SilentlyContinue
npx.cmd --yes eas-cli@latest build --platform android --profile production --non-interactive --wait --json |
  Tee-Object -FilePath $aabPath
Assert-NativeSuccess "production AAB build"
if (-not (Test-Path -LiteralPath $aabPath)) { throw "AAB build record missing." }
if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "Source SHA changed after AAB build." }

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RELEASE CUTOVER COMPLETE" -ForegroundColor Green
Write-Host " FINAL_RC_SHA=$rcSha" -ForegroundColor Green
Write-Host " WEB_DEPLOYED_SHA=$rcSha" -ForegroundColor Green
Write-Host " AAB_SOURCE_SHA=$rcSha" -ForegroundColor Green
Write-Host " WEB_DEPLOYED_SHA == AAB_SOURCE_SHA : PASS" -ForegroundColor Green
Write-Host " SUPPORT_BACKEND=HEALTHY" -ForegroundColor Green
Write-Host " WEB=https://buklod.expo.app" -ForegroundColor Green
Write-Host " AAB_BUILD_RECORD=$aabPath" -ForegroundColor Green
Write-Host " PLAY_STORE_SUBMISSION=NOT_PERFORMED" -ForegroundColor Yellow
Write-Host " PHYSICAL DEVICE NATIVE QA STILL REQUIRED BEFORE PLAY SUBMISSION" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
