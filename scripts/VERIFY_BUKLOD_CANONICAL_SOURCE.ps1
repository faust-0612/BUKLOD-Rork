#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [switch]$RequireCurrentDirectory,
  [switch]$RequireClean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$MarkerPath = Join-Path $SourceRoot '.buklod-local-canonical.json'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }

if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  Fail "Missing workspace manifest: $ManifestPath"
}
if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  Fail "Missing canonical source: $SourceRoot"
}
if (!(Test-Path -LiteralPath $MarkerPath -PathType Leaf)) {
  Fail "Missing canonical source marker: $MarkerPath. Run FINALIZE_BUKLOD_CENTRALIZATION.ps1."
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$marker = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json

if ($manifest.repository -ne $ExpectedRepo) { Fail "Manifest repository mismatch: $($manifest.repository)" }
if ($marker.repository -ne $ExpectedRepo) { Fail "Marker repository mismatch: $($marker.repository)" }
if ((Full ([string]$manifest.canonical_source)) -ne (Full $SourceRoot)) { Fail 'Manifest canonical_source mismatch.' }
if ((Full ([string]$marker.canonical_source)) -ne (Full $SourceRoot)) { Fail 'Marker canonical_source mismatch.' }
if ((Full ([string]$marker.workspace_root)) -ne (Full $WorkspaceRoot)) { Fail 'Marker workspace_root mismatch.' }

$origin = (& git -C $SourceRoot remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0) { Fail 'Could not read canonical source origin.' }
if ($origin -ne $ExpectedRepo) { Fail "Canonical source origin mismatch: $origin" }

if ($RequireCurrentDirectory) {
  if ((Full (Get-Location).Path) -ne (Full $SourceRoot)) {
    Fail "Wrong working directory. Expected canonical SOURCE: $SourceRoot"
  }
}

$branch = (& git -C $SourceRoot symbolic-ref --short -q HEAD).Trim()
if (-not $branch) { $branch = '(detached)' }
$status = @(& git -C $SourceRoot status --porcelain)
if ($RequireClean -and $status.Count -gt 0) {
  Fail 'Canonical source is dirty but a clean source is required.'
}

$head = (& git -C $SourceRoot rev-parse HEAD).Trim()

Write-Host 'BUKLOD_CANONICAL_SOURCE: PASS' -ForegroundColor Green
Write-Host "Workspace : $WorkspaceRoot"
Write-Host "Source    : $SourceRoot"
Write-Host "Origin    : $origin"
Write-Host "Branch    : $branch"
Write-Host "HEAD      : $head"
Write-Host "Dirty     : $($status.Count -gt 0)"
