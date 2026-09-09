#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$ReleaseRoot = Join-Path $WorkspaceRoot 'RELEASE\WEB'
$ReleaseWork = Join-Path $ReleaseRoot 'current'
$Manifest = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'

function Fail([string]$Message) { throw $Message }

if (!(Test-Path -LiteralPath $Manifest -PathType Leaf)) {
  Fail "Canonical workspace is not initialized. Run .\scripts\SETUP_BUKLOD_CANONICAL_WORKSPACE.ps1 first."
}
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) { Fail "Canonical SOURCE missing: $SourceRoot" }

Write-Host 'BUKLOD CANONICAL WEB RELEASE' -ForegroundColor Cyan
Write-Host "SOURCE  : $SourceRoot"
Write-Host "STAGING : $ReleaseWork"

Push-Location $SourceRoot
try {
  $origin = (& git remote get-url origin).Trim()
  if ($origin -ne $RepoUrl) { Fail "Canonical SOURCE origin mismatch: $origin" }
  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) { Fail 'Canonical SOURCE is dirty. Preserve/reconcile changes before release.' }
  & git switch main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }
  & git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not update canonical SOURCE main.' }
} finally { Pop-Location }

if (Test-Path -LiteralPath $ReleaseWork) {
  Remove-Item -LiteralPath $ReleaseWork -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

& git clone --branch main --single-branch $RepoUrl $ReleaseWork
if ($LASTEXITCODE -ne 0) { Fail 'Could not create disposable release staging clone.' }

$env:BUKLOD_CANONICAL_RELEASE = '1'
Push-Location $ReleaseWork
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\DEPLOY_GAMES_WEB_DIRECT.ps1'
  exit $LASTEXITCODE
} finally { Pop-Location }
