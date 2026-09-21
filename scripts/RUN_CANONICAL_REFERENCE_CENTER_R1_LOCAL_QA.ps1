param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$Branch = "feature/canonical-reference-center-r1-20260921"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-LastExit([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD CANONICAL REFERENCE CENTER R1 - LOCAL EXACT-BRANCH QA" -ForegroundColor Cyan
Write-Host " CONTRACT -> BOUNDARY -> TYPESCRIPT -> LOCAL SUPABASE -> PGTAP" -ForegroundColor Cyan
Write-Host " NO PRODUCTION DB APPLY / NO WEB DEPLOY / NO ANDROID BUILD" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $Repo)) {
  throw "Canonical BUKLOD Main repo not found: $Repo"
}

Set-Location $Repo

$origin = (git remote get-url origin).Trim()
Assert-LastExit "Read git origin"
if ($origin -notmatch "faust-0612/BUKLOD-Rork") {
  throw "Wrong repository origin: $origin"
}

Write-Host "`n1/10 Fetch exact Reference Center branch..." -ForegroundColor Yellow
git fetch origin $Branch --prune
Assert-LastExit "Fetch Reference Center branch"

$rcSha = (git rev-parse "origin/$Branch").Trim()
if (-not $rcSha) {
  throw "Could not resolve exact branch SHA."
}
Write-Host "REFERENCE_RC_SHA=$rcSha" -ForegroundColor Green

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$qaRoot = Join-Path $HOME "BUKLOD_WORKSPACE\QA\CANONICAL_REFERENCE_CENTER_R1_$stamp"

Write-Host "`n2/10 Create detached exact-SHA QA worktree..." -ForegroundColor Yellow
git worktree add --detach $qaRoot $rcSha
Assert-LastExit "Create QA worktree"

$startedSupabase = $false

try {
  Set-Location $qaRoot

  Write-Host "`n3/10 Install locked dependencies..." -ForegroundColor Yellow
  & npm.cmd ci --ignore-scripts --include=dev --no-audit --no-fund
  Assert-LastExit "& npm.cmd ci"

  Write-Host "`n4/10 Canonical Reference invariant contract..." -ForegroundColor Yellow
  & npm.cmd run reference:contract
  Assert-LastExit "Reference invariant contract"

  Write-Host "`n5/10 Preserve standalone app boundaries..." -ForegroundColor Yellow
  node scripts/verify-buklod-app-boundaries.cjs
  Assert-LastExit "App boundary guard"

  Write-Host "`n6/10 TypeScript..." -ForegroundColor Yellow
  & npx.cmd tsc --noEmit
  Assert-LastExit "TypeScript"

  Write-Host "`n7/10 Docker prerequisite for isolated local Supabase..." -ForegroundColor Yellow
  docker info *> $null
  Assert-LastExit "Docker availability"

  Write-Host "`n8/10 Start isolated local Supabase and rebuild from migrations..." -ForegroundColor Yellow
  & npx.cmd supabase start
  Assert-LastExit "Supabase start"
  $startedSupabase = $true

  & npx.cmd supabase db reset
  Assert-LastExit "Supabase db reset"

  Write-Host "`n9/10 Database lint + Canonical Reference pgTAP E2E..." -ForegroundColor Yellow
  & npx.cmd supabase db lint --level error
  Assert-LastExit "Supabase DB lint"

  & npx.cmd supabase test db supabase/tests/buklod_canonical_reference_center_r1_test.sql
  Assert-LastExit "Canonical Reference pgTAP"

  Write-Host "`n10/10 Exact source freeze..." -ForegroundColor Yellow
  $afterSha = (git rev-parse HEAD).Trim()
  if ($afterSha -ne $rcSha) {
    throw "Exact-source violation: HEAD changed from $rcSha to $afterSha"
  }

  $dirty = git status --porcelain
  Assert-LastExit "Git status"
  if ($dirty) {
    Write-Host $dirty -ForegroundColor Red
    throw "QA worktree became dirty. No exact RC can be declared."
  }

  Write-Host "`n====================================================================" -ForegroundColor Green
  Write-Host " CANONICAL REFERENCE CENTER R1 LOCAL QA PASS" -ForegroundColor Green
  Write-Host " EXACT_TESTED_SHA=$rcSha" -ForegroundColor Green
  Write-Host " PRODUCTION_DB_APPLY=NO" -ForegroundColor Yellow
  Write-Host " WEB_DEPLOY=NO" -ForegroundColor Yellow
  Write-Host " ANDROID_BUILD=NO" -ForegroundColor Yellow
  Write-Host "====================================================================" -ForegroundColor Green
}
finally {
  if ($startedSupabase) {
    Write-Host "`nStopping isolated local Supabase..." -ForegroundColor DarkGray
    & npx.cmd supabase stop --no-backup | Out-Host
  }

  Set-Location $Repo
  git worktree remove --force $qaRoot | Out-Host
}
