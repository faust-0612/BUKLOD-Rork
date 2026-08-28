param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

Write-Host "BUKLOD Production Database Cutover"
Write-Host "=================================="

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs | Out-File -Encoding utf8 release/PRODUCTION_MIGRATION_HASHES.json

Write-Host ""
Write-Host "Running production migration dry-run..."
supabase db push --dry-run

if (-not $Apply) {
  Write-Host ""
  Write-Host "DRY RUN COMPLETE. No production migration was applied."
  Write-Host "After human review, run:"
  Write-Host "  .\scripts\production-cutover.ps1 -Apply"
  exit 0
}

$confirm = Read-Host "Type BUKLOD-PRODUCTION to apply migrations"
if ($confirm -ne "BUKLOD-PRODUCTION") {
  throw "Confirmation did not match. Aborting."
}

Write-Host "Applying production migrations WITHOUT staging seed..."
supabase db push

Write-Host ""
Write-Host "Database migrations applied."
Write-Host "Next: bootstrap/verify first System Admin, apply reviewed production baseline,"
Write-Host "deploy Edge Functions, smoke test, then record Command Center decision."
