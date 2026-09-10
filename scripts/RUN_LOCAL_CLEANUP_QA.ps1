#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$ExpectedBranch = 'chore/safe-size-reduction-r1'
$RepoRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$ExportRoot = Join-Path $WorkspaceRoot 'EXPORTS'
$WebOut = Join-Path $ExportRoot 'safe-size-web'
$AndroidOut = Join-Path $ExportRoot 'safe-size-android'

function Fail([string]$Message) { throw $Message }
function Run-Step([string]$Name, [scriptblock]$Action) {
  Write-Host ''
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { Fail "$Name failed with exit code $LASTEXITCODE" }
  Write-Host "$Name: PASS" -ForegroundColor Green
}

if (!(Test-Path -LiteralPath $RepoRoot -PathType Container)) {
  Fail "Canonical repo missing: $RepoRoot"
}

$origin = (& git -C $RepoRoot remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -ne $ExpectedRepo) {
  Fail "Wrong canonical origin: $origin"
}

$branch = (& git -C $RepoRoot branch --show-current).Trim()
if ($branch -ne $ExpectedBranch) {
  Fail "Wrong branch for cleanup QA. Expected '$ExpectedBranch'; actual '$branch'."
}

$dirty = @(& git -C $RepoRoot status --porcelain)
if ($dirty.Count -gt 0) {
  & git -C $RepoRoot status --short
  Fail 'Canonical cleanup branch is dirty. Preserve/reconcile changes before QA.'
}

New-Item -ItemType Directory -Force -Path $ExportRoot | Out-Null
if (Test-Path -LiteralPath $WebOut) { Remove-Item -LiteralPath $WebOut -Recurse -Force }
if (Test-Path -LiteralPath $AndroidOut) { Remove-Item -LiteralPath $AndroidOut -Recurse -Force }

Push-Location $RepoRoot
try {
  Run-Step 'NPM CLEAN INSTALL' { & npm.cmd ci }

  $tsc = Join-Path $RepoRoot 'node_modules\.bin\tsc.cmd'
  if (!(Test-Path -LiteralPath $tsc -PathType Leaf)) { Fail "Local TypeScript compiler missing after npm ci: $tsc" }
  Run-Step 'TYPESCRIPT' { & $tsc --noEmit }

  Run-Step 'RELEASE GATE' { & npm.cmd run release:gate }

  $expo = Join-Path $RepoRoot 'node_modules\.bin\expo.cmd'
  if (!(Test-Path -LiteralPath $expo -PathType Leaf)) { Fail "Local Expo CLI missing after npm ci: $expo" }
  Run-Step 'WEB EXPORT' { & $expo export --platform web --output-dir $WebOut }
  Run-Step 'ANDROID EXPORT' { & $expo export --platform android --output-dir $AndroidOut }

  Write-Host ''
  Write-Host '===================================' -ForegroundColor Green
  Write-Host 'LOCAL CLEANUP QA: ALL PASSED' -ForegroundColor Green
  Write-Host '===================================' -ForegroundColor Green
  Write-Host "Branch      : $branch"
  Write-Host "Web export  : $WebOut"
  Write-Host "Android     : $AndroidOut"
} finally {
  Pop-Location
}
