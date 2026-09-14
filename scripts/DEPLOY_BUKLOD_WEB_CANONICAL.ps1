#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function Ensure-Utf8Bom([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "PowerShell compatibility target missing: $Path"
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $utf8Bom = New-Object System.Text.UTF8Encoding($true)
  $text = [System.IO.File]::ReadAllText($Path, $utf8NoBom)
  [System.IO.File]::WriteAllText($Path, $text, $utf8Bom)
}

if ($env:BUKLOD_CANONICAL_RELEASE -ne '1') {
  Fail 'Canonical release authorization is missing. Start web release only through scripts\RUN_CANONICAL_WEB_RELEASE.ps1.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_WORKSPACE_ROOT)) {
  Fail 'BUKLOD_WORKSPACE_ROOT is missing. Direct deploy invocation is not allowed.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_R31_R40_RECOVERY_ROOT)) {
  Fail 'Approved R31/R40 recovery root is missing. Deployment blocked.'
}
if ([string]::IsNullOrWhiteSpace($env:BUKLOD_RELEASE_SOURCE_SHA)) {
  Fail 'BUKLOD_RELEASE_SOURCE_SHA is missing. Exact release identity cannot be proven.'
}

$WorkspaceRoot = Full $env:BUKLOD_WORKSPACE_ROOT
$ManifestPath = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$ExpectedReleaseWork = Full (Join-Path $WorkspaceRoot 'RELEASE\WEB\current')
$CurrentRoot = Full (Get-Location).Path
$RecoveryRoot = Full $env:BUKLOD_R31_R40_RECOVERY_ROOT
$ExpectedSourceSha = $env:BUKLOD_RELEASE_SOURCE_SHA.Trim()

if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  Fail "Canonical workspace manifest missing: $ManifestPath"
}
if (!(Test-Path -LiteralPath $RecoveryRoot -PathType Container)) {
  Fail "Approved R31/R40 recovery root missing: $RecoveryRoot"
}
if (!(Test-Path -LiteralPath (Join-Path $RecoveryRoot 'RECOVERY_MANIFEST.json') -PathType Leaf)) {
  Fail 'Approved R31/R40 recovery manifest missing.'
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.repository -ne $ExpectedRepo) {
  Fail "Workspace manifest repository mismatch: $($manifest.repository)"
}
if ((Full ([string]$manifest.release_web)) -ne (Full (Join-Path $WorkspaceRoot 'RELEASE\WEB'))) {
  Fail 'Workspace release_web identity mismatch.'
}
if ($CurrentRoot -ne $ExpectedReleaseWork) {
  Fail "Wrong deployment root. Expected disposable canonical release staging: $ExpectedReleaseWork; actual: $CurrentRoot"
}

$origin = (& git remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -ne $ExpectedRepo) {
  Fail "Release staging origin mismatch: $origin"
}
$branch = (& git symbolic-ref --short -q HEAD).Trim()
if ($branch -ne 'main') {
  Fail "Production web release requires branch main; actual: $branch"
}
$headSha = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $headSha -ne $ExpectedSourceSha) {
  Fail "Release staging SHA drift detected before deployment. Expected=$ExpectedSourceSha actual=$headSha"
}
$dirty = @(& git status --porcelain)
if ($dirty.Count -gt 0) {
  Fail 'Disposable release staging is dirty before deployment.'
}

$sourceGuard = Join-Path $CurrentRoot 'scripts\assert-production-source.cjs'
if (!(Test-Path -LiteralPath $sourceGuard -PathType Leaf)) {
  Fail 'Production source identity guard is missing.'
}
& node $sourceGuard
if ($LASTEXITCODE -ne 0) {
  Fail 'Production source identity guard failed.'
}

$helpSosContract = Join-Path $CurrentRoot 'scripts\community-help-sos-release-contract.mjs'
if (!(Test-Path -LiteralPath $helpSosContract -PathType Leaf)) {
  Fail 'Community Help / Emergency SOS release contract is missing.'
}
& node $helpSosContract
if ($LASTEXITCODE -ne 0) {
  Fail 'Community Help / Emergency SOS locked baseline contract failed.'
}

$implementation = Join-Path $CurrentRoot 'scripts\DEPLOY_GAMES_WEB_DIRECT.ps1'
$recoveryScript = Join-Path $CurrentRoot 'scripts\RESTORE_CANONICAL_R31_R40.ps1'
if (!(Test-Path -LiteralPath $implementation -PathType Leaf)) {
  Fail 'Canonical web deploy implementation is missing.'
}
if (!(Test-Path -LiteralPath $recoveryScript -PathType Leaf)) {
  Fail 'Canonical R31/R40 recovery implementation is missing.'
}

Write-Host 'BUKLOD_CANONICAL_RELEASE_GUARD: PASS' -ForegroundColor Green
Write-Host "Workspace : $WorkspaceRoot"
Write-Host "Release   : $CurrentRoot"
Write-Host "Recovery  : $RecoveryRoot"
Write-Host "Origin    : $origin"
Write-Host "Branch    : $branch"
Write-Host "SHA lock  : $ExpectedSourceSha"
Write-Host ''

# Windows PowerShell 5.1 treats UTF-8-without-BOM scripts as the active ANSI
# code page. Some protected child scripts intentionally contain Unicode display
# punctuation. Normalize only the disposable staging copies after all source
# identity/dirty guards have passed; application source is not changed.
Write-Host 'Normalizing protected child PowerShell scripts for Windows PowerShell 5.1...' -ForegroundColor Yellow
Ensure-Utf8Bom $implementation
Ensure-Utf8Bom $recoveryScript
Write-Host 'PowerShell 5.1 child-script encoding: VERIFIED' -ForegroundColor Green

$headAfterNormalization = (& git rev-parse HEAD).Trim()
if ($headAfterNormalization -ne $ExpectedSourceSha) {
  Fail "Release staging SHA changed during local normalization. Expected=$ExpectedSourceSha actual=$headAfterNormalization"
}

Write-Host 'Starting protected web deployment implementation...' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $implementation
exit $LASTEXITCODE
