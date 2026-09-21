param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$Branch = "feature/buklod-smart-drawer-r1-20260921"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-LastExit([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD SMART DRAWER R1 - LOCAL EXACT-BRANCH QA" -ForegroundColor Cyan
Write-Host " CONTRACT -> BOUNDARY -> FOCUSED JEST -> TYPESCRIPT -> EXACT SHA" -ForegroundColor Cyan
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

Write-Host "`n1/7 Fetch exact Smart Drawer branch..." -ForegroundColor Yellow
git fetch origin $Branch --prune
Assert-LastExit "Fetch Smart Drawer branch"

$rcSha = (git rev-parse "origin/$Branch").Trim()
if (-not $rcSha) { throw "Could not resolve Smart Drawer branch SHA." }
Write-Host "SMART_DRAWER_RC_SHA=$rcSha" -ForegroundColor Green

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$qaRoot = Join-Path $HOME "BUKLOD_WORKSPACE\QA\SMART_DRAWER_R1_$stamp"

Write-Host "`n2/7 Create detached exact-SHA QA worktree..." -ForegroundColor Yellow
git worktree add --detach $qaRoot $rcSha
Assert-LastExit "Create Smart Drawer QA worktree"

try {
  Set-Location $qaRoot

  Write-Host "`n3/7 Install locked dependencies..." -ForegroundColor Yellow
  npm ci --ignore-scripts --include=dev --no-audit --no-fund
  Assert-LastExit "npm ci"

  Write-Host "`n4/7 Smart Drawer invariant contract..." -ForegroundColor Yellow
  npm run drawer:contract
  Assert-LastExit "Smart Drawer contract"

  Write-Host "`n5/7 Preserve BUKLOD app boundaries + focused unit tests..." -ForegroundColor Yellow
  node scripts/verify-buklod-app-boundaries.cjs
  Assert-LastExit "App boundary guard"
  npm test -- __tests__/smartDrawerClassification.test.ts
  Assert-LastExit "Smart Drawer focused Jest"

  Write-Host "`n6/7 TypeScript..." -ForegroundColor Yellow
  npx tsc --noEmit
  Assert-LastExit "TypeScript"

  Write-Host "`n7/7 Exact source freeze..." -ForegroundColor Yellow
  $afterSha = (git rev-parse HEAD).Trim()
  if ($afterSha -ne $rcSha) {
    throw "Exact-source violation: HEAD changed from $rcSha to $afterSha"
  }

  $dirty = git status --porcelain --untracked-files=all
  Assert-LastExit "Git status"
  if ($dirty) {
    Write-Host $dirty -ForegroundColor Red
    throw "QA worktree became dirty. Exact RC cannot be declared."
  }

  Write-Host "`n====================================================================" -ForegroundColor Green
  Write-Host " SMART DRAWER R1 SOURCE QA PASS" -ForegroundColor Green
  Write-Host " EXACT_TESTED_SHA=$rcSha" -ForegroundColor Green
  Write-Host " OCR_E2E=NOT_YET_VERIFIED" -ForegroundColor Yellow
  Write-Host " CLOUD_SYNC=LOCAL_ONLY_NOT_ENABLED" -ForegroundColor Yellow
  Write-Host " PHYSICAL_OFFLINE_NOTIFICATION_E2E=REQUIRED_BEFORE_RELEASE" -ForegroundColor Yellow
  Write-Host " PRODUCTION_DEPLOY=NO" -ForegroundColor Yellow
  Write-Host "====================================================================" -ForegroundColor Green
}
finally {
  Set-Location $Repo
  git worktree remove --force $qaRoot | Out-Host
}
