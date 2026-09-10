#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [string]$Branch = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$RecoveryRoot = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40_APPROVED\recovery-import\r31-r40'
$PreviewParent = Join-Path $WorkspaceRoot 'PREVIEW\KINGDOM'
$PreviewRoot = Join-Path $PreviewParent 'current'
$ArchiveRoot = Join-Path $PreviewParent '_previous'

function Fail([string]$Message) { throw $Message }
function Rotate-Folder([string]$Path, [string]$ArchiveParent) {
  if (!(Test-Path -LiteralPath $Path -PathType Container)) { return }
  New-Item -ItemType Directory -Force -Path $ArchiveParent | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $target = Join-Path $ArchiveParent "kingdom_$stamp"
  Move-Item -LiteralPath $Path -Destination $target
  Write-Host "Previous localhost preview rotated to: $target" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host ' BUKLOD KINGDOM — VERIFIED LOCALHOST PREVIEW' -ForegroundColor Cyan
Write-Host ' NO EAS DEPLOY / NO PRODUCTION PROMOTION' -ForegroundColor Yellow
Write-Host '=============================================================' -ForegroundColor Cyan

if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) { Fail "Canonical SOURCE missing: $SourceRoot" }
if (!(Test-Path -LiteralPath $RecoveryRoot -PathType Container)) { Fail "Approved R31/R40 recovery missing: $RecoveryRoot" }

Push-Location $SourceRoot
try {
  $origin = (& git remote get-url origin).Trim()
  if ($origin -ne $RepoUrl) { Fail "Canonical SOURCE origin mismatch: $origin" }

  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) {
    git status --short
    Fail 'Canonical SOURCE is dirty. No reset/discard was attempted.'
  }

  if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (& git branch --show-current).Trim()
  }
  if ([string]::IsNullOrWhiteSpace($Branch)) { Fail 'Could not determine preview branch.' }

  & git fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { Fail "Could not fetch origin/$Branch" }

  $sourceHead = (& git rev-parse HEAD).Trim()
  Write-Host "Canonical source : $SourceRoot"
  Write-Host "Preview branch   : $Branch"
  Write-Host "Source HEAD       : $sourceHead"
} finally {
  Pop-Location
}

Rotate-Folder $PreviewRoot $ArchiveRoot
New-Item -ItemType Directory -Force -Path $PreviewParent | Out-Null

Write-Host ''
Write-Host '1/6 CREATE FRESH DISPOSABLE PREVIEW CLONE' -ForegroundColor Cyan
& git clone --branch $Branch --single-branch $RepoUrl $PreviewRoot
if ($LASTEXITCODE -ne 0) { Fail 'Could not create localhost preview clone.' }

$sourceEnv = Join-Path $SourceRoot '.env.local'
$previewEnv = Join-Path $PreviewRoot '.env.local'
if (Test-Path -LiteralPath $sourceEnv -PathType Leaf) {
  Copy-Item -LiteralPath $sourceEnv -Destination $previewEnv -Force
  Write-Host 'Local environment copied into disposable preview without printing secrets.' -ForegroundColor Green
} else {
  Write-Host 'WARN: canonical .env.local was not found. Public/auth-backed screens may require local environment values.' -ForegroundColor Yellow
}

Push-Location $PreviewRoot
try {
  Write-Host ''
  Write-Host '2/6 INSTALL LOCKED DEPENDENCIES' -ForegroundColor Cyan
  npm.cmd ci --ignore-scripts --include=dev
  if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }

  Write-Host ''
  Write-Host '3/6 OVERLAY + VERIFY APPROVED R31/R40' -ForegroundColor Cyan
  $env:BUKLOD_R31_R40_RECOVERY_ROOT = $RecoveryRoot
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\RESTORE_CANONICAL_R31_R40.ps1' `
    -ProjectRoot $PreviewRoot `
    -RecoveryRoots @($RecoveryRoot)
  if ($LASTEXITCODE -ne 0) { Fail 'R31/R40 preview overlay failed.' }

  Write-Host ''
  Write-Host '4/6 RUN KINGDOM + NATIVE READINESS CONTRACTS' -ForegroundColor Cyan
  npm.cmd run character:contract
  if ($LASTEXITCODE -ne 0) { Fail 'Character contract failed.' }
  npm.cmd run game:contract
  if ($LASTEXITCODE -ne 0) { Fail 'Kingdom game contract failed.' }
  node .\scripts\kingdom-native-readiness.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'Kingdom native readiness failed.' }

  Write-Host ''
  Write-Host '5/6 RUN TYPESCRIPT QA' -ForegroundColor Cyan
  npx.cmd tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Fail 'TypeScript QA failed.' }

  Write-Host ''
  Write-Host '6/6 START LOCALHOST — VISUAL QA REQUIRED' -ForegroundColor Green
  Write-Host 'Open the localhost URL printed by Expo, then verify:' -ForegroundColor Green
  Write-Host 'Home -> BUKLOD KINGDOM -> Map -> 13 stations -> game -> EN/TL -> sound -> result -> map.'
  Write-Host 'System Admin: verify the QA shield is visible. Normal user: verify the QA shield is absent.'
  Write-Host ''
  Write-Host 'PRODUCTION DEPLOYMENT: NOT PERFORMED' -ForegroundColor Yellow

  $env:APP_VARIANT = 'development'
  $env:EXPO_PUBLIC_APP_ENV = 'development'
  npx.cmd expo start --web --host localhost --clear
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:\BUKLOD_R31_R40_RECOVERY_ROOT -ErrorAction SilentlyContinue
  Pop-Location
}
