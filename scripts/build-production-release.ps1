$ErrorActionPreference = "Stop"

Write-Host "BUKLOD 1.0 Production Build"
Write-Host "==========================="

node scripts/production-preflight.mjs
npx expo-doctor@latest
npm test

Write-Host ""
Write-Host "Verify database tests separately against the approved schema:"
Write-Host "  supabase test db"

eas whoami
eas build --platform all --profile production --message "BUKLOD 1.0 production release candidate"
