# BUKLOD Main — one-command production OTA
# Source of truth: %USERPROFILE%\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN on branch main
# Target: same native APK/AAB as production (runtime 1.3.2, channel production)
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\PUSH_MAIN_OTA.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\PUSH_MAIN_OTA.ps1 -Message "fix PTT UI"

param(
  [string]$Message = "BUKLOD Main OTA (runtime 1.3.2)"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  throw "Push OTA only from branch main (current: $branch). Checkout main first."
}

# Guard native-compatibility BEFORE calling eas update. The currently installed
# production V28 APK reports Expo runtime 1.3.2; app.config.js is the source.
$appConfig = Get-Content -LiteralPath (Join-Path $root 'app.config.js') -Raw
if ($appConfig -notmatch "runtimeVersion:\s*isClassroom\s*\?\s*'1\.3\.0'\s*:\s*'1\.3\.2'") {
  throw "BUKLOD production runtime guard failed: expected main runtime 1.3.2 from app.config.js."
}

$dirty = git status --porcelain
if ($dirty) {
  throw "Working tree is dirty. Commit or stash before OTA so DEV/APK stay identical."
}

$env:CI = '1'
Write-Host "Publishing OTA → channel=production environment=production runtime=1.3.2"
Write-Host "Message: $Message"

# Android-only: production APK/AAB path. Avoids web export noise (e.g. sqlite wasm).
npx eas update `
  --channel production `
  --environment production `
  --platform android `
  --message $Message `
  --non-interactive

if ($LASTEXITCODE -ne 0) {
  throw "eas update failed with exit $LASTEXITCODE"
}

Write-Host "OTA published. Install/use production APK (profile production-apk or dev-apk) to receive it."
