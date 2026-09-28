param(
  [string]$Repo = "",
  [string]$OutputDir = "D:\Downloads\BUKLOD_BUILDS"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "BUKLOD PRE-APK V22 STOPPED: $Message" -ForegroundColor Red
  exit 1
}

function Run([string]$Label, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "=== $Label ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    Fail "$Label failed with exit code $LASTEXITCODE."
  }
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  $Repo = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$Repo = [System.IO.Path]::GetFullPath($Repo)
if (-not (Test-Path -LiteralPath (Join-Path $Repo ".git"))) {
  Fail "Not a Git repository: $Repo"
}

Set-Location -LiteralPath $Repo

$ExpectedBranch = "codex/pre-apk-economy-ads-v2-20260928"
$ExpectedVersion = "1.3.1"
$ExpectedVersionCode = 22

Write-Host "BUKLOD MAIN PRE-APK V22 LOCAL RELEASE" -ForegroundColor Green
Write-Host "Repository: $Repo"
Write-Host "No web deploy. No Play Store submit. No radio change."

Run "GIT FETCH RELEASE BRANCH" {
  git fetch origin $ExpectedBranch --prune
}

$DirtyBefore = git status --porcelain
if ($DirtyBefore) {
  Fail "Working tree is not clean. Commit/stash unrelated local changes first."
}

Run "CHECKOUT EXACT REMOTE RELEASE BRANCH" {
  git switch --detach "origin/$ExpectedBranch"
}

$SourceSha = (git rev-parse HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($SourceSha)) {
  Fail "Could not resolve source SHA."
}

Write-Host "SOURCE_SHA=$SourceSha" -ForegroundColor Yellow

$AppConfig = Get-Content -LiteralPath (Join-Path $Repo "app.config.js") -Raw
if ($AppConfig -notmatch "version:\s*'1\.3\.1'") {
  Fail "Expected app version $ExpectedVersion was not found."
}
if ($AppConfig -notmatch "versionCode:\s*isStaging\s*\?\s*undefined\s*:\s*22") {
  Fail "Expected Android versionCode $ExpectedVersionCode was not found."
}
if ($AppConfig -notmatch "org\.mzbministry\.buklod") {
  Fail "Production Android package identity is missing."
}

$Wall = Get-Content -LiteralPath (Join-Path $Repo "src\app\(tabs)\buklod.tsx") -Raw
foreach ($Token in @(
  "BUKLOD_COMMUNITY_FEED_MODES_ALL_R2",
  "BUKLOD_COMMUNITY_AUTHOR_FOLLOW_ALL_R2",
  "<BuklodCommunityContributionCard />"
)) {
  if ($Wall -notmatch [regex]::Escape($Token)) {
    Fail "Missing release anchor: $Token"
  }
}

$AndroidAd = Get-Content -LiteralPath (Join-Path $Repo "src\components\BuklodCommunityInlineAd.android.tsx") -Raw
foreach ($Token in @(
  "'public_wall_feed'",
  "'org_wall_feed'",
  "'cluster_wall_feed'"
)) {
  if ($AndroidAd -notmatch [regex]::Escape($Token)) {
    Fail "Missing Android ad attribution anchor: $Token"
  }
}

$EconomyClient = Get-Content -LiteralPath (Join-Path $Repo "src\lib\buklodCommunityContributionEconomy.ts") -Raw
if ($EconomyClient -notmatch "get_my_buklod_community_contribution_v2") {
  Fail "Community QMP v2 client contract is missing."
}

$Rewards = Get-Content -LiteralPath (Join-Path $Repo "src\lib\buklodRewards.ts") -Raw
if ($Rewards -notmatch "Legacy revenue split is read-only") {
  Fail "Legacy revenue split write lock is missing."
}

Run "NPM LOCKED INSTALL" {
  npm ci --ignore-scripts
}

Run "TYPESCRIPT" {
  npx tsc --noEmit
}

Run "BASE RELEASE GATE" {
  node scripts/release-gate.mjs
}

Run "COMMUNITY QMP CONTRACT" {
  node scripts/community-contribution-economy-release-contract.mjs
}

Run "UX / NO-SILENT-FAILURE GATE" {
  node scripts/buklod-main-ux-feedback-gate.mjs
}

Run "MAIN SELF-HEAL CONTRACT" {
  npm run health:contract
}

Run "FINAL MAIN SOURCE GATE" {
  node scripts/buklod-main-final-release-gate.mjs
}

Run "NATIVE CAPABILITY GATE" {
  node scripts/buklod-main-final-native-gate.mjs
}

$TempExport = Join-Path $env:TEMP ("buklod-pre-apk-v22-" + $SourceSha.Substring(0, 12))
if (Test-Path -LiteralPath $TempExport) {
  Remove-Item -LiteralPath $TempExport -Recurse -Force
}

$env:EXPO_PUBLIC_APP_ENV = "production"
$env:APP_VARIANT = "production"
$env:BUKLOD_APP_TARGET = "main"

Run "ANDROID JS EXPORT" {
  npx expo export --platform android --output-dir $TempExport --clear
}

if (-not (Test-Path -LiteralPath $TempExport)) {
  Fail "Android export output was not created."
}
if (-not (Get-ChildItem -LiteralPath $TempExport -Recurse -File | Select-Object -First 1)) {
  Fail "Android export output is empty."
}

Run "EAS AUTH CHECK" {
  npx --yes eas-cli@latest whoami --non-interactive
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$SafeSha = $SourceSha.Substring(0, 12)
$BuildJson = Join-Path $OutputDir "BUKLOD-1.3.1-v22-$SafeSha-eas.json"
$BuildLog = Join-Path $OutputDir "BUKLOD-1.3.1-v22-$SafeSha-eas.log"
$ApkPath = Join-Path $OutputDir "BUKLOD-1.3.1-v22-$SafeSha.apk"
$ResultPath = Join-Path $OutputDir "BUKLOD-1.3.1-v22-$SafeSha-result.json"

Write-Host ""
Write-Host "=== EAS PRODUCTION APK BUILD ===" -ForegroundColor Cyan
Write-Host "This may take several minutes. Do not close this PowerShell window."

$BuildOutput = & npx --yes eas-cli@latest build --platform android --profile production-apk --non-interactive --wait --json 2> $BuildLog
$BuildExit = $LASTEXITCODE
$BuildOutput | Set-Content -LiteralPath $BuildJson -Encoding UTF8

if ($BuildExit -ne 0) {
  if (Test-Path -LiteralPath $BuildLog) {
    Get-Content -LiteralPath $BuildLog -Tail 120
  }
  Fail "EAS production APK build failed. Log: $BuildLog"
}

if (-not (Test-Path -LiteralPath $BuildJson)) {
  Fail "EAS build did not produce JSON output."
}

$RawBuild = Get-Content -LiteralPath $BuildJson -Raw
try {
  $ParsedBuild = $RawBuild | ConvertFrom-Json
} catch {
  Get-Content -LiteralPath $BuildJson -Tail 80
  Fail "Could not parse EAS build JSON."
}

$Build = if ($ParsedBuild -is [System.Array]) { $ParsedBuild[0] } else { $ParsedBuild }
$ApkUrl = $null

if ($Build.artifacts -and $Build.artifacts.buildUrl) {
  $ApkUrl = [string]$Build.artifacts.buildUrl
} elseif ($Build.artifacts -and $Build.artifacts.applicationArchiveUrl) {
  $ApkUrl = [string]$Build.artifacts.applicationArchiveUrl
}

if ([string]::IsNullOrWhiteSpace($ApkUrl)) {
  Fail "EAS build succeeded but APK URL was not returned."
}

Write-Host ""
Write-Host "=== DOWNLOAD APK ===" -ForegroundColor Cyan
Write-Host $ApkUrl

Invoke-WebRequest -Uri $ApkUrl -OutFile $ApkPath -UseBasicParsing

if (-not (Test-Path -LiteralPath $ApkPath)) {
  Fail "APK download failed."
}

$ApkInfo = Get-Item -LiteralPath $ApkPath
if ($ApkInfo.Length -lt 10MB) {
  Fail "Downloaded APK is unexpectedly small: $($ApkInfo.Length) bytes."
}

$Hash = (Get-FileHash -LiteralPath $ApkPath -Algorithm SHA256).Hash

$Result = [ordered]@{
  status = "SUCCEEDED"
  source_sha = $SourceSha
  version = $ExpectedVersion
  version_code = $ExpectedVersionCode
  eas_build_id = [string]$Build.id
  eas_status = [string]$Build.status
  apk_url = $ApkUrl
  apk_path = $ApkPath
  apk_bytes = $ApkInfo.Length
  apk_sha256 = $Hash
  built_at = (Get-Date).ToString("o")
  web_deployed = $false
  play_store_submitted = $false
  financial_finalization_activated = $false
}

$Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN APK READY" -ForegroundColor Green
Write-Host " Version: $ExpectedVersion" -ForegroundColor Green
Write-Host " VersionCode: $ExpectedVersionCode" -ForegroundColor Green
Write-Host " Source SHA: $SourceSha" -ForegroundColor Green
Write-Host " APK: $ApkPath" -ForegroundColor Green
Write-Host " SHA256: $Hash" -ForegroundColor Green
Write-Host " Result: $ResultPath" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
