param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ApkPath
)

$ErrorActionPreference = 'Stop'
$Package = 'org.mzbministry.buklod'
$ExpectedVersionCode = '21'

function Step([string]$Text) {
  Write-Host "`n====================================================================" -ForegroundColor DarkGreen
  Write-Host " $Text" -ForegroundColor Green
  Write-Host "====================================================================" -ForegroundColor DarkGreen
}

if (-not (Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw 'ADB is not installed/on PATH. Install Android Platform Tools, connect the test phone with USB debugging, then rerun this script.'
}

Step '1/7 Verify one Android test device is connected'
$deviceLines = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if ($LASTEXITCODE -ne 0) { throw 'adb devices failed.' }
if (($deviceLines | Measure-Object).Count -ne 1) {
  adb devices
  throw 'Connect exactly one authorized Android phone for this preflight.'
}
$serial = (($deviceLines | Select-Object -First 1) -split '\s+')[0]
Write-Host "Device: $serial" -ForegroundColor Cyan

Step '2/7 Install exact RC APK'
adb -s $serial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }

Step '3/7 Verify installed BUKLOD identity/version'
$packageDump = adb -s $serial shell dumpsys package $Package
if ($LASTEXITCODE -ne 0 -or -not $packageDump) { throw "Could not inspect installed package $Package." }
if (($packageDump -join "`n") -notmatch "versionCode=$ExpectedVersionCode(\s|\b)") {
  throw "Installed BUKLOD is not versionCode $ExpectedVersionCode."
}
Write-Host "PASS package=$Package versionCode=$ExpectedVersionCode"

Step '4/7 Verify critical Android permissions in installed manifest'
$requiredPermissions = @(
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.WAKE_LOCK',
  'android.permission.ACCESS_NOTIFICATION_POLICY'
)
$dumpText = $packageDump -join "`n"
foreach ($permission in $requiredPermissions) {
  if ($dumpText -notmatch [regex]::Escape($permission)) {
    throw "Installed APK is missing expected permission: $permission"
  }
  Write-Host "PASS $permission"
}

Step '5/7 Verify native SOS Quick Settings service'
if ($dumpText -notmatch 'BuklodSosTileService') {
  throw 'Installed APK does not expose BuklodSosTileService.'
}
if ($dumpText -notmatch 'android\.service\.quicksettings\.action\.QS_TILE') {
  Write-Host 'WARN: dumpsys did not print the QS_TILE action text; service class is present. Confirm tile manually in Quick Settings edit.' -ForegroundColor Yellow
} else {
  Write-Host 'PASS Quick Settings SOS TileService + QS_TILE intent filter'
}

Step '6/7 Launch canonical SOS deep link from a closed app'
adb -s $serial shell am force-stop $Package
Start-Sleep -Milliseconds 700
$launch = adb -s $serial shell am start -W -a android.intent.action.VIEW -d 'buklod://sos?trigger=deep_link' $Package
if ($LASTEXITCODE -ne 0) { throw 'SOS deep-link launch failed.' }
$launchText = $launch -join "`n"
if ($launchText -match 'Error:|Activity not started|unable to resolve') {
  Write-Host $launchText
  throw 'Android could not resolve/launch buklod://sos.'
}
Write-Host $launchText
Write-Host 'PASS closed-app SOS deep-link entry resolved.' -ForegroundColor Cyan

Step '7/7 Hand off to human-required emergency/device checks'
Write-Host @'
AUTOMATED DEVICE PREFLIGHT PASSED.

Now complete docs/BUKLOD_NATIVE_RC_PHYSICAL_QA_20260917.md on this exact installed APK.
Highest-priority manual checks:
  1. Quick Settings BUKLOD SOS from closed app.
  2. Launcher long-press Emergency SOS.
  3. Lock-screen SOS Ready shortcut.
  4. Final SOS hold -> fingerprint/face/device PIN success and cancel paths.
  5. Controlled recipient push with MAX alert + DND opt-in.
  6. Incoming call while receiver app is killed.
  7. IGPAT camera/playback.
  8. Rive character + Skia Kingdom/game.
  9. Hybrid/satellite native map + live GPS + Google navigation handoff.

Do not build the final AAB until all physical QA items pass.
'@
