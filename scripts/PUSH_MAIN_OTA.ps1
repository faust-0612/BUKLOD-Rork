# BUKLOD Main - legacy direct OTA shortcut retired 2026-11-11.
# Never bypass protected PR, exact RC fingerprint, production status checks or release marker.
# This script intentionally performs no network, build, Git or publish operation.
param([string]$Message = "No direct OTA")
$ErrorActionPreference = 'Stop'
throw "DIRECT OTA BLOCKED: scripts/PUSH_MAIN_OTA.ps1 and npm run ota:main are disabled. Use the protected GitHub production release-marker PR, then the canonical .github/workflows/production_android_ota.yml from verified main. No OTA was published."
