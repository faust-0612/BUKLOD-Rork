param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

Write-Host "BUKLOD — Link Production Supabase"
Write-Host "================================="
Write-Host ""
Write-Host "Target project ref: $ProjectRef"
Write-Host "This helper will LINK and DRY-RUN only. It will not apply migrations."

$confirm = Read-Host "Type LINK-PRODUCTION to continue"
if ($confirm -ne "LINK-PRODUCTION") {
  throw "Confirmation did not match. Aborting."
}

supabase login
supabase link --project-ref $ProjectRef

Write-Host ""
Write-Host "Linked project. Running migration dry-run..."
supabase db push --dry-run

Write-Host ""
Write-Host "STOP HERE and review the output."
Write-Host "Use scripts/production-cutover.ps1 -Apply only after production preflight and human review."
