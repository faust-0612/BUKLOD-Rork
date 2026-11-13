# BUKLOD staging-only native APK attestation (read-only)
# Requires Node 22+ and Android platform-tools adb on Windows PATH.
# Supply all required --name=value args, for example:
# .\scripts\RUN_BUKLOD_STAGING_DEVICE_ATTESTATION.ps1 --apk="C:\Temp\BUKLOD-Staging-Green-B.apk" --build-id=9c0eb308-9a8e-4f34-a5f4-798ae556b7b0 --source=9f412afd71b74e41995a3a1a63e05e72f78b6e39 --version-code=9 --version-name=1.3.6
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
$script = Join-Path $PSScriptRoot 'staging-apk-device-attestation.mjs'
& $node.Source $script @args
exit $LASTEXITCODE
