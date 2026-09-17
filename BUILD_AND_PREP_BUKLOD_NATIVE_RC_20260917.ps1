param(
  [switch]$SkipDevicePreflight
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = if ($env:BUKLOD_WORKSPACE) {
  $env:BUKLOD_WORKSPACE
} else {
  Join-Path $HOME 'BUKLOD_WORKSPACE'
}
$ReleaseDir = Join-Path $WorkspaceRoot 'RELEASE\ANDROID\NATIVE_RC_20260917'
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

$BuildScript = Join-Path $Root 'BUILD_BUKLOD_NATIVE_RC_APK_20260917.ps1'
$ResultJson = Join-Path $ReleaseDir 'eas-native-rc-apk-20260917.json'
$ApkPath = Join-Path $ReleaseDir 'BUKLOD_NATIVE_RC_1.3.0_v21.apk'
$RecordPath = Join-Path $ReleaseDir 'BUKLOD_NATIVE_RC_APK_RECORD_20260917.txt'
$DevicePreflight = Join-Path $Root 'RUN_BUKLOD_NATIVE_RC_DEVICE_PREFLIGHT_20260917.ps1'

if (-not (Test-Path $BuildScript)) { throw "Missing build script: $BuildScript" }

Write-Host "`nBUKLOD NATIVE RC — BUILD + DOWNLOAD + DEVICE PREP" -ForegroundColor Green
Write-Host "Release artifacts: $ReleaseDir" -ForegroundColor Cyan
& $BuildScript
if ($LASTEXITCODE -ne 0) { throw 'Native RC build script failed.' }

if (-not (Test-Path $ResultJson)) {
  throw "Build succeeded but result JSON is missing: $ResultJson"
}

$raw = (Get-Content $ResultJson -Raw).Trim()
if (-not $raw) { throw 'EAS build result JSON is empty.' }
$parsed = $raw | ConvertFrom-Json
if ($parsed -is [System.Array]) { $build = $parsed[0] } else { $build = $parsed }
$url = $build.artifacts.buildUrl
if (-not $url) { $url = $build.artifacts.applicationArchiveUrl }
if (-not $url) { throw 'EAS build did not provide an APK URL.' }

Write-Host "`nDownloading exact RC APK..." -ForegroundColor Cyan
if (Test-Path $ApkPath) { Remove-Item $ApkPath -Force }
Invoke-WebRequest -Uri $url -OutFile $ApkPath -UseBasicParsing
if (-not (Test-Path $ApkPath) -or (Get-Item $ApkPath).Length -lt 1000000) {
  throw 'Downloaded APK is missing or unexpectedly small.'
}

$hash = (Get-FileHash -Algorithm SHA256 -Path $ApkPath).Hash.ToLowerInvariant()
$head = (git -C $Root rev-parse HEAD).Trim()
$mainHead = (git -C $Root rev-parse origin/main).Trim()
$branch = (git -C $Root branch --show-current).Trim()
if ($branch -ne 'release/native-rc-apk-20260917') {
  throw "Unexpected branch after RC build: $branch"
}

@(
  'BUKLOD MAIN NATIVE RC APK RECORD'
  "Git SHA: $head"
  "Canonical main ancestor: $mainHead"
  'Branch: release/native-rc-apk-20260917'
  'Package: org.mzbministry.buklod'
  'Version: 1.3.0'
  'VersionCode: 21'
  "EAS Build ID: $($build.id)"
  "EAS Status: $($build.status)"
  "APK URL: $url"
  "APK: $ApkPath"
  "APK SHA256: $hash"
  "Generated: $([DateTimeOffset]::Now.ToString('o'))"
) | Set-Content -Path $RecordPath -Encoding UTF8

Write-Host "APK: $ApkPath" -ForegroundColor Green
Write-Host "SHA256: $hash" -ForegroundColor Green
Write-Host "RC commit: $head" -ForegroundColor Green
Write-Host "Record: $RecordPath" -ForegroundColor Green
Write-Host 'Repository working tree is not used for generated build artifacts.' -ForegroundColor Cyan

if ($SkipDevicePreflight) {
  Write-Host "`nDevice preflight skipped by request." -ForegroundColor Yellow
  Write-Host "Later run: .\RUN_BUKLOD_NATIVE_RC_DEVICE_PREFLIGHT_20260917.ps1 -ApkPath `"$ApkPath`""
  exit 0
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Write-Host "`nAPK is ready, but ADB is not installed/on PATH." -ForegroundColor Yellow
  Write-Host 'Install Android Platform Tools, connect one phone with USB debugging, then run:'
  Write-Host ".\RUN_BUKLOD_NATIVE_RC_DEVICE_PREFLIGHT_20260917.ps1 -ApkPath `"$ApkPath`"" -ForegroundColor Cyan
  exit 0
}

if (-not (Test-Path $DevicePreflight)) { throw "Missing device preflight: $DevicePreflight" }
& $DevicePreflight -ApkPath $ApkPath
