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

$workspaceIdentity = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
if ($workspaceIdentity.repository -ne $RepoUrl) {
  Fail "Workspace manifest repository mismatch: $($workspaceIdentity.repository)"
}
if ([System.IO.Path]::GetFullPath([string]$workspaceIdentity.canonical_source).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd('\')) {
  Fail 'Workspace manifest canonical_source does not match the requested canonical SOURCE.'
}
if ([System.IO.Path]::GetFullPath([string]$workspaceIdentity.release_web).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($ReleaseRoot).TrimEnd('\')) {
  Fail 'Workspace manifest release_web does not match the requested RELEASE root.'
}

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
$env:BUKLOD_WORKSPACE_ROOT = [System.IO.Path]::GetFullPath($WorkspaceRoot)
Push-Location $ReleaseWork
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\DEPLOY_GAMES_WEB_DIRECT.ps1'
  exit $LASTEXITCODE
} finally {
  Pop-Location
  Remove-Item Env:\BUKLOD_CANONICAL_RELEASE -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_WORKSPACE_ROOT -ErrorAction SilentlyContinue
}
