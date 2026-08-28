$ErrorActionPreference = "Stop"
Write-Host "== BUKLOD Quality Gates =="
npx expo-doctor@latest
npm test
supabase test db
node scripts/release-gate.mjs
Write-Host "All configured quality gates passed."
