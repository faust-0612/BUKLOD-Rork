#requires -Version 5.1
param(
  [string]$WorkspaceRoot = "$HOME\BUKLOD_WORKSPACE",
  [string]$ExpectedSourceSha = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Keep this launcher ASCII-only because Windows PowerShell 5.1 may parse
# UTF-8-without-BOM punctuation incorrectly on legacy Windows code pages.
$RepoUrl = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$RecoveryBranch = 'recovery/r31-r40-approved-local-20260910'
$SourceRoot = Join-Path $WorkspaceRoot 'SOURCE\BUKLOD-MAIN'
$RecoveryRepo = Join-Path $WorkspaceRoot 'RECOVERY\R31_R40_APPROVED'
$RecoveryPackage = Join-Path $RecoveryRepo 'recovery-import\r31-r40'
$RecoveryPreviousRoot = Join-Path $WorkspaceRoot 'RECOVERY\_previous'
$ReleaseRoot = Join-Path $WorkspaceRoot 'RELEASE\WEB'
$ReleaseWork = Join-Path $ReleaseRoot 'current'
$PreviousReleaseRoot = Join-Path $ReleaseRoot '_previous'
$Manifest = Join-Path $WorkspaceRoot 'BUKLOD_WORKSPACE.json'
$Marker = Join-Path $SourceRoot '.buklod-local-canonical.json'

function Fail([string]$Message) { throw $Message }
function Full([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\') }
function EnsureDir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Rotate-Directory([string]$Path, [string]$ArchiveRoot, [string]$Prefix) {
  if (!(Test-Path -LiteralPath $Path -PathType Container)) { return $null }
  EnsureDir $ArchiveRoot
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
  $target = Join-Path $ArchiveRoot ("${Prefix}_${stamp}_${suffix}")
  try {
    [System.IO.Directory]::Move((Full $Path), (Full $target))
  } catch {
    Fail "Could not rotate directory safely. Source=$Path Error=$($_.Exception.Message)"
  }
  Write-Host "Rotated previous directory to: $target" -ForegroundColor DarkGray
  return $target
}
function Clone-ShallowWithRetry(
  [string]$Branch,
  [string]$Destination,
  [string]$ArchiveRoot,
  [string]$Prefix,
  [int]$Attempts = 3
) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (Test-Path -LiteralPath $Destination -PathType Container) {
      $null = Rotate-Directory $Destination $ArchiveRoot "${Prefix}_failed_clone"
    }

    Write-Host "Clone attempt $attempt/$Attempts - branch $Branch" -ForegroundColor DarkGray
    & git -c http.version=HTTP/1.1 clone --depth 1 --branch $Branch --single-branch $RepoUrl $Destination
    $cloneExit = $LASTEXITCODE
    if ($cloneExit -eq 0) { return }

    Write-Host "Git clone attempt $attempt failed with exit code $cloneExit." -ForegroundColor Yellow
    if ($attempt -lt $Attempts) {
      Start-Sleep -Seconds 2
    }
  }

  Fail "Could not clone branch $Branch after $Attempts attempts."
}

if (!(Test-Path -LiteralPath $SourceRoot -PathType Container)) { Fail "Canonical SOURCE missing: $SourceRoot" }
if (!(Test-Path -LiteralPath $Manifest -PathType Leaf)) { Fail "Canonical workspace manifest missing. Run scripts\FINALIZE_BUKLOD_CENTRALIZATION.ps1 first: $Manifest" }
if (!(Test-Path -LiteralPath $Marker -PathType Leaf)) { Fail "Canonical local source marker missing. Run scripts\FINALIZE_BUKLOD_CENTRALIZATION.ps1 first: $Marker" }

Write-Host 'BUKLOD CANONICAL WEB RELEASE' -ForegroundColor Cyan
Write-Host "SOURCE   : $SourceRoot"
Write-Host "RECOVERY : $RecoveryPackage"
Write-Host "STAGING  : $ReleaseWork"
Write-Host ''

Write-Host 'STEP 1/3 - VERIFY + NORMALIZE CANONICAL SOURCE' -ForegroundColor Cyan
Push-Location $SourceRoot
try {
  $origin = (& git remote get-url origin).Trim()
  if ($origin -ne $RepoUrl) { Fail "Canonical SOURCE origin mismatch: $origin" }

  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) {
    git status --short
    Fail 'Canonical SOURCE is dirty. No reset/discard was attempted.'
  }

  & git fetch origin --prune
  if ($LASTEXITCODE -ne 0) { Fail 'Could not refresh canonical SOURCE.' }

  & git switch main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not switch canonical SOURCE to main.' }

  & git pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not update canonical SOURCE main.' }

  $branch = (& git symbolic-ref --short -q HEAD).Trim()
  $sourceSha = (& git rev-parse HEAD).Trim()
  $originMain = (& git rev-parse origin/main).Trim()
  $dirtyAfter = @(& git status --porcelain)

  if ($branch -ne 'main') { Fail "Canonical SOURCE must be on main. Current branch: $branch" }
  if ($dirtyAfter.Count -gt 0) { Fail 'Canonical SOURCE became dirty during verification. Deployment stopped.' }
  if ($sourceSha -ne $originMain) { Fail "Canonical SOURCE is not identical to origin/main. HEAD=$sourceSha origin/main=$originMain" }
  if (-not [string]::IsNullOrWhiteSpace($ExpectedSourceSha) -and $sourceSha -ne $ExpectedSourceSha.Trim()) {
    Fail "Canonical SOURCE SHA does not match requested release SHA. Expected=$($ExpectedSourceSha.Trim()) actual=$sourceSha"
  }

  $manifestIdentity = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
  $markerIdentity = Get-Content -LiteralPath $Marker -Raw | ConvertFrom-Json
  if ($manifestIdentity.repository -ne $RepoUrl -or $markerIdentity.repository -ne $RepoUrl) { Fail 'Canonical manifest/marker repository identity mismatch.' }
  if ((Full ([string]$manifestIdentity.canonical_source)) -ne (Full $SourceRoot)) { Fail 'Canonical manifest source path mismatch.' }
  if ((Full ([string]$markerIdentity.canonical_source)) -ne (Full $SourceRoot)) { Fail 'Canonical marker source path mismatch.' }

  Write-Host 'BUKLOD_CANONICAL_SOURCE: PASS' -ForegroundColor Green
  Write-Host "HEAD        : $sourceSha"
  Write-Host "origin/main : $originMain"
  Write-Host "LOCKED SHA  : $sourceSha"
  Write-Host 'Dirty       : False'
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'STEP 2/3 - REFRESH + VERIFY APPROVED R31/R40 RECOVERY' -ForegroundColor Cyan
# Never recursively delete this Git clone on Windows. Rotate the top-level folder
# atomically, then clone a fresh approved recovery reference. Retry transient
# transport resets without weakening any release identity checks.
$null = Rotate-Directory $RecoveryRepo $RecoveryPreviousRoot 'r31_r40'
EnsureDir (Split-Path -Parent $RecoveryRepo)
Clone-ShallowWithRetry $RecoveryBranch $RecoveryRepo $RecoveryPreviousRoot 'r31_r40'

$RecoveryManifest = Join-Path $RecoveryPackage 'RECOVERY_MANIFEST.json'
if (!(Test-Path -LiteralPath $RecoveryManifest -PathType Leaf)) { Fail "Approved recovery manifest missing: $RecoveryManifest" }
$recoveryIdentity = Get-Content -LiteralPath $RecoveryManifest -Raw | ConvertFrom-Json
if ([int]$recoveryIdentity.r40_named_asset_count -lt 168) { Fail "Approved recovery manifest reports incomplete R40 assets: $($recoveryIdentity.r40_named_asset_count)" }
if (@($recoveryIdentity.source_files).Count -lt 11) { Fail 'Approved recovery manifest does not contain the complete R31/R40 source family.' }
Write-Host 'Approved R31/R40 recovery package: VERIFIED' -ForegroundColor Green
Write-Host "R40 assets : $($recoveryIdentity.r40_named_asset_count)"
Write-Host "Source set : $(@($recoveryIdentity.source_files).Count) files"

Write-Host ''
Write-Host 'STEP 3/3 - CREATE FRESH RELEASE STAGING + RUN PROTECTED DEPLOY' -ForegroundColor Cyan
$null = Rotate-Directory $ReleaseWork $PreviousReleaseRoot 'web'
EnsureDir $ReleaseRoot
# Disposable staging needs only the captured main snapshot, not repository history.
# If main advances after source verification, the clone SHA check below fails closed.
Clone-ShallowWithRetry 'main' $ReleaseWork $PreviousReleaseRoot 'web'

$stagingSha = (& git -C $ReleaseWork rev-parse HEAD).Trim()
if ($stagingSha -ne $sourceSha) { Fail "Release staging SHA mismatch. Source=$sourceSha staging=$stagingSha" }
Write-Host "Fresh staging HEAD: $stagingSha" -ForegroundColor Green
Write-Host "Release SHA lock: $sourceSha" -ForegroundColor Green

$env:BUKLOD_CANONICAL_RELEASE = '1'
$env:BUKLOD_WORKSPACE_ROOT = Full $WorkspaceRoot
$env:BUKLOD_R31_R40_RECOVERY_ROOT = Full $RecoveryPackage
$env:BUKLOD_RELEASE_SOURCE_SHA = $sourceSha
$deployExit = 1

Push-Location $ReleaseWork
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\DEPLOY_BUKLOD_WEB_CANONICAL.ps1'
  $deployExit = $LASTEXITCODE
} finally {
  Pop-Location
  Remove-Item Env:\BUKLOD_CANONICAL_RELEASE -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_WORKSPACE_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_R31_R40_RECOVERY_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:\BUKLOD_RELEASE_SOURCE_SHA -ErrorAction SilentlyContinue
}

if ($deployExit -ne 0) { Fail "Protected canonical web deploy failed with exit code $deployExit." }

Write-Host ''
Write-Host 'BUKLOD CANONICAL WEB RELEASE: COMPLETE' -ForegroundColor Green
Write-Host "Released source SHA: $sourceSha" -ForegroundColor Green
exit 0
