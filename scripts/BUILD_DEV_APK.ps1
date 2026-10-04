# BUKLOD Main — daily DEV APK = production APK (identical package/runtime/channel)
# Profile alias: dev-apk → production-apk → production
# Package: org.mzbministry.buklod | runtime: 1.3.3 | channel: production
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\BUILD_DEV_APK.ps1

param(
  [string]$Message = "BUKLOD DEV APK = production APK (runtime 1.3.3)"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  throw "Build DEV APK only from branch main (current: $branch)."
}

$env:CI = '1'
Write-Host "Building identical DEV/production APK (profile dev-apk)…"
npx eas build -p android --profile dev-apk --message $Message --non-interactive

if ($LASTEXITCODE -ne 0) {
  throw "eas build failed with exit $LASTEXITCODE"
}
