$ErrorActionPreference = "Stop"

Write-Host "BUKLOD — Release Android Build to Google Play INTERNAL TESTING"
Write-Host "============================================================="
Write-Host ""
Write-Host "This profile uses track=internal and releaseStatus=completed."

$confirm = Read-Host "Type PLAY-INTERNAL-RELEASE to continue"
if ($confirm -ne "PLAY-INTERNAL-RELEASE") {
  throw "Confirmation did not match. Aborting."
}

eas submit --platform android --profile google-play-internal
