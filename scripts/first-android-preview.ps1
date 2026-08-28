$ErrorActionPreference = "Stop"

Write-Host "BUKLOD Android staging/preview build"
Write-Host "===================================="
Write-Host "Prerequisites:"
Write-Host "  1. eas login"
Write-Host "  2. eas init"
Write-Host "  3. Preview EAS environment contains the staging Supabase public values."

eas whoami
node scripts/staging-gate.mjs
eas build --platform android --profile preview --message "BUKLOD staging pilot preview"
