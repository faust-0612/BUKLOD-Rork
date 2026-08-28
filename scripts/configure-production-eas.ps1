$ErrorActionPreference = "Stop"

Write-Host "BUKLOD — Configure EAS Production Environment"
Write-Host "=============================================="
Write-Host ""
Write-Host "This script stores only client-safe production values in EAS."

$SupabaseUrl = Read-Host "Production Supabase URL (https://...supabase.co)"
$PublishableKey = Read-Host "Production Supabase publishable key (sb_publishable_...)"
$EasProjectId = Read-Host "EAS Project ID (UUID)"

if ($SupabaseUrl -notmatch '^https://[a-zA-Z0-9-]+\.supabase\.co$') {
  throw "Invalid hosted Supabase URL."
}

if ($PublishableKey -notmatch '^sb_publishable_') {
  throw "Expected an sb_publishable_ key."
}

if ($PublishableKey -match 'sb_secret_|service_role') {
  throw "Refusing to store a secret/service-role key in the Expo client."
}

eas whoami

eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value $SupabaseUrl --environment production --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value $PublishableKey --environment production --visibility sensitive
eas env:set --name EAS_PROJECT_ID --value $EasProjectId --environment production --visibility plaintext

Write-Host ""
Write-Host "Production EAS variables were created/updated."
Write-Host "Verify them in the EAS project dashboard before building."
