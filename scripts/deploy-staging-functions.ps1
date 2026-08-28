$ErrorActionPreference = "Stop"

Write-Host "Deploying BUKLOD Edge Functions to the linked Supabase project..."
supabase functions deploy push
supabase functions deploy delete-account

Write-Host ""
Write-Host "Optional enhanced Expo push security:"
Write-Host "  supabase secrets set EXPO_ACCESS_TOKEN=YOUR_VALUE"
Write-Host ""
Write-Host "Then configure the notifications INSERT database webhook to call the push function."
