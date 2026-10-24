$ErrorActionPreference = "Stop"

Write-Host "BUKLOD 1.0 — Android Production Release Candidate"
Write-Host "================================================="

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs | Out-File -Encoding utf8 release/PRODUCTION_MIGRATION_HASHES.json

npx expo-doctor@latest
npm test

Write-Host ""
Write-Host "Before build, verify:"
Write-Host "  - production Supabase schema is deployed"
Write-Host "  - Maintenance Mode is ON"
Write-Host "  - production EAS variables are correct"
Write-Host "  - EAS cloud build will hard-fail if required AdMob production IDs are missing/test IDs"

$confirm = Read-Host "Type BUILD-ANDROID-1.0 to start the production AAB build"
if ($confirm -ne "BUILD-ANDROID-1.0") {
  throw "Confirmation did not match. Aborting."
}

eas whoami
eas build --platform android --profile production --message "BUKLOD 1.0 Android production release candidate"
