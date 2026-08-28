$ErrorActionPreference = "Stop"

Write-Host "BUKLOD — Submit Android Build to Google Play as DRAFT"
Write-Host "===================================================="
Write-Host ""
Write-Host "Select the exact approved/tested production build when EAS prompts you."

$confirm = Read-Host "Type PLAY-DRAFT to continue"
if ($confirm -ne "PLAY-DRAFT") {
  throw "Confirmation did not match. Aborting."
}

eas submit --platform android --profile google-play-draft
