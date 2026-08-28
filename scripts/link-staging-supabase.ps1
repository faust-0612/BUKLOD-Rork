param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

Write-Host "Logging into Supabase CLI..."
supabase login

Write-Host "Linking repository to staging project: $ProjectRef"
supabase link --project-ref $ProjectRef

Write-Host "Remote migration preview:"
supabase db push --dry-run

Write-Host ""
Write-Host "Review the dry-run output above."
Write-Host "To apply the fresh staging schema + starter seed, run:"
Write-Host "  supabase db push --include-seed"
