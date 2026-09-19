param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$Branch = "release/buklod-main-final-20260920"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Checked {
  param(
    [Parameter(Mandatory=$true)][string]$File,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs
  )

  Write-Host "> $File $($CommandArgs -join ' ')" -ForegroundColor DarkGray
  & $File @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $File $($CommandArgs -join ' ')"
  }
}

function Import-DotEnv {
  param([Parameter(Mandatory=$true)][string]$Path)

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      continue
    }

    $name = $matches[1]
    $value = $matches[2].Trim()

    if (
      $value.Length -ge 2 -and
      (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD MAIN FINAL RC VERIFY" -ForegroundColor Cyan
Write-Host " EXACT RELEASE BRANCH / QA ONLY / NO DEPLOY / NO OTA / NO APK PUSH" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $Repo)) {
  throw "Canonical repo not found: $Repo"
}

Set-Location -LiteralPath $Repo
Invoke-Checked git fetch origin $Branch

$sourceSha = (git rev-parse "origin/$Branch").Trim()
if (-not $sourceSha) {
  throw "Could not resolve origin/$Branch."
}

$shortSha = $sourceSha.Substring(0, 12)
$qaRoot = "$HOME\BUKLOD_WORKSPACE\QA\BUKLOD_MAIN_FINAL_RC_$shortSha"

Write-Host "SOURCE SHA: $sourceSha" -ForegroundColor Yellow
Write-Host "QA DIR:     $qaRoot" -ForegroundColor Yellow

if (Test-Path -LiteralPath $qaRoot) {
  try {
    Invoke-Checked git worktree remove --force $qaRoot
  } catch {
    Remove-Item -LiteralPath $qaRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Invoke-Checked git worktree add --detach $qaRoot $sourceSha
Set-Location -LiteralPath $qaRoot

if ((git rev-parse HEAD).Trim() -ne $sourceSha) {
  throw "QA worktree is not at the frozen RC SHA."
}

Write-Host ""
Write-Host "=== 1/10 LOCKED DEPENDENCIES ===" -ForegroundColor Yellow
Invoke-Checked npm.cmd ci --ignore-scripts

Write-Host ""
Write-Host "=== 2/10 FINAL STATIC RELEASE CONTRACT ===" -ForegroundColor Yellow
Invoke-Checked node scripts/buklod-main-final-release-gate.mjs
Invoke-Checked node scripts/auth-canonical-login-contract.mjs

Write-Host ""
Write-Host "=== 3/10 JEST REGRESSION SUITE ===" -ForegroundColor Yellow
Invoke-Checked npm.cmd test

Write-Host ""
Write-Host "=== 4/10 TYPESCRIPT RELEASE QA ===" -ForegroundColor Yellow
Invoke-Checked npx.cmd tsc --noEmit

Write-Host ""
Write-Host "=== 5/10 MIGRATION PACKAGE MANIFEST ===" -ForegroundColor Yellow
Invoke-Checked node scripts/verify-production-migrations.mjs
node scripts/verify-production-migrations.mjs | Set-Content -LiteralPath "final-migration-manifest.json" -Encoding UTF8
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath "final-migration-manifest.json")) {
  throw "Migration manifest generation failed."
}

Write-Host ""
Write-Host "=== 6/10 EXPO / DEPENDENCY DOCTOR ===" -ForegroundColor Yellow
Invoke-Checked npx.cmd --yes expo-doctor@latest

Write-Host ""
Write-Host "=== 7/10 PRODUCTION ENVIRONMENT PREFLIGHT ===" -ForegroundColor Yellow
$env:EXPO_PUBLIC_APP_ENV = "production"
$env:APP_VARIANT = "production"
$env:BUKLOD_APP_TARGET = "main"
$env:EAS_PROJECT_ID = "23dad7d0-389a-406e-8dec-08965dab85d8"

Invoke-Checked npx.cmd --yes eas-cli@latest whoami --non-interactive

if (Test-Path -LiteralPath ".env.local") {
  Remove-Item -LiteralPath ".env.local" -Force
}

Invoke-Checked npx.cmd --yes eas-cli@latest env:pull --environment production --path .env.local --non-interactive

if (-not (Test-Path -LiteralPath ".env.local")) {
  throw "Production .env.local was not pulled."
}

Import-DotEnv -Path ".env.local"

if ($env:EXPO_PUBLIC_SUPABASE_URL -ne "https://yhanxndaqbmuzbdqlblu.supabase.co") {
  throw "Wrong production Supabase project: $($env:EXPO_PUBLIC_SUPABASE_URL)"
}

Invoke-Checked npm.cmd run production:preflight

Write-Host ""
Write-Host "=== 8/10 FRESH PRODUCTION WEB EXPORT ===" -ForegroundColor Yellow
if (Test-Path -LiteralPath "dist") {
  Remove-Item -LiteralPath "dist" -Recurse -Force
}
$env:NODE_ENV = "production"
Invoke-Checked npx.cmd expo export --platform web --output-dir dist --clear

if (-not (Test-Path -LiteralPath "dist\index.html")) {
  throw "Web export did not produce dist\index.html."
}

$webBundles = Get-ChildItem -LiteralPath "dist\_expo\static\js\web" -Filter "*.js" -File -Recurse -ErrorAction SilentlyContinue
if (-not $webBundles) {
  throw "No production web JS bundles were produced."
}

$prodUrlFound = $false
$devEndpointFound = $false
foreach ($bundle in $webBundles) {
  $raw = Get-Content -LiteralPath $bundle.FullName -Raw
  if ($raw.Contains("yhanxndaqbmuzbdqlblu.supabase.co")) {
    $prodUrlFound = $true
  }
  if (
    $raw -match 'localhost' -or
    $raw -match '127\.0\.0\.1' -or
    $raw -match 'supabase\.local'
  ) {
    $devEndpointFound = $true
  }
}

if (-not $prodUrlFound) {
  throw "Production Supabase URL was not found in the web bundle."
}
if ($devEndpointFound) {
  throw "Development endpoint detected in the production web bundle."
}

Write-Host ""
Write-Host "=== 9/10 ANDROID JS / ASSET EXPORT ===" -ForegroundColor Yellow
if (Test-Path -LiteralPath "dist-android") {
  Remove-Item -LiteralPath "dist-android" -Recurse -Force
}
Invoke-Checked npx.cmd expo export --platform android --output-dir dist-android --clear

$androidFiles = Get-ChildItem -LiteralPath "dist-android" -File -Recurse -ErrorAction SilentlyContinue
if (-not $androidFiles) {
  throw "Android export produced no files."
}

Write-Host ""
Write-Host "=== 10/10 SOURCE + RC IDENTITY RECHECK ===" -ForegroundColor Yellow
if ((git rev-parse HEAD).Trim() -ne $sourceSha) {
  throw "HEAD moved during verification."
}

$trackedDiff = git status --short --untracked-files=no
if ($LASTEXITCODE -ne 0) {
  throw "git status failed."
}
if ($trackedDiff) {
  Write-Host $trackedDiff -ForegroundColor Red
  throw "Tracked source changed during verification."
}

Set-Location -LiteralPath $Repo
Invoke-Checked git fetch origin $Branch
$latestSha = (git rev-parse "origin/$Branch").Trim()
if ($latestSha -ne $sourceSha) {
  throw "Release branch moved during QA. Re-run this verifier against the new SHA."
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RC VERIFIED" -ForegroundColor Green
Write-Host " SOURCE SHA: $sourceSha" -ForegroundColor Green
Write-Host " WEB EXPORT: PASS" -ForegroundColor Green
Write-Host " ANDROID EXPORT: PASS" -ForegroundColor Green
Write-Host " TESTS / TSC / DOCTOR / PREFLIGHT: PASS" -ForegroundColor Green
Write-Host " NO PRODUCTION DEPLOYMENT WAS PERFORMED" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
