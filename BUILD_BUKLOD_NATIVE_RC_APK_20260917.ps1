$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Branch = 'release/native-rc-apk-20260917'
$Repo = 'faust-0612/BUKLOD-Rork'
$ExpectedPackage = 'org.mzbministry.buklod'
$ExpectedVersion = '1.3.0'
$ExpectedVersionCode = 21
$ExpectedProjectId = '23dad7d0-389a-406e-8dec-08965dab85d8'

function Step([string]$Text) {
  Write-Host "`n====================================================================" -ForegroundColor DarkGreen
  Write-Host " $Text" -ForegroundColor Green
  Write-Host "====================================================================" -ForegroundColor DarkGreen
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not installed or not on PATH."
  }
}

Step 'BUKLOD NATIVE RC APK - DEVICE TEST BUILD'
Write-Host "Repository : $Repo"
Write-Host "Branch     : $Branch"
Write-Host "Target     : BUKLOD Main Android APK"
Write-Host "Version    : $ExpectedVersion"
Write-Host "VersionCode: $ExpectedVersionCode"
Write-Host 'AAB        : NOT built by this script'

Require-Command git
Require-Command node
Require-Command npm

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Root
try {
  Step '1/9 Verify repository and protect local work'
  if (-not (Test-Path '.git')) {
    throw "This script must be run from the root of the BUKLOD-Rork Git repository. Current path: $Root"
  }

  $remote = (git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Could not read git origin.' }
  if ($remote -notmatch 'faust-0612/BUKLOD-Rork') {
    throw "Wrong repository origin: $remote"
  }

  $dirty = git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
  if ($dirty) {
    Write-Host $dirty
    throw 'STOP: Local working tree is not clean. Commit/stash intentional work first; this script will not overwrite it.'
  }

  Step '2/9 Update exact native RC branch'
  git fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw "Could not checkout $Branch." }
  git pull --ff-only origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'Fast-forward pull failed. No reset/force was attempted.' }

  $head = (git rev-parse HEAD).Trim()
  $remoteHead = (git rev-parse "origin/$Branch").Trim()
  if ($head -ne $remoteHead) {
    throw "Local HEAD $head does not match origin/$Branch $remoteHead."
  }
  Write-Host "Release candidate commit: $head" -ForegroundColor Cyan

  Step '3/9 Install locked dependencies'
  npm ci --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

  Step '4/9 Native Android closing contract'
  node scripts/native-android-closing-contract.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'Native Android closing contract failed. APK build stopped so a required native capability cannot be omitted silently.'
  }

  Step '5/9 TypeScript release gate'
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript gate failed. APK build stopped.' }

  Step '6/9 Verify Main native identity/configuration'
  $env:APP_VARIANT = 'production'
  $env:EXPO_PUBLIC_APP_ENV = 'production'
  $env:BUKLOD_APP_TARGET = 'main'

  $verify = @"
const makeConfig = require('./app.config.js');
const config = makeConfig({ config: {} });
const eas = require('./eas.json');
const fs = require('fs');
const firebase = JSON.parse(fs.readFileSync('google-services.production.json','utf8'));
const main = (firebase.client || []).find(c => c?.client_info?.android_client_info?.package_name === '$ExpectedPackage');
const fail = (m) => { throw new Error(m); };
if (config.name !== 'BUKLOD') fail('Expected BUKLOD Main app name, got ' + config.name);
if (config.version !== '$ExpectedVersion') fail('Expected version $ExpectedVersion, got ' + config.version);
if (config.android?.package !== '$ExpectedPackage') fail('Unexpected package ' + config.android?.package);
if (config.android?.versionCode !== $ExpectedVersionCode) fail('Expected versionCode $ExpectedVersionCode, got ' + config.android?.versionCode);
if (!config.android?.permissions?.includes('android.permission.ACCESS_NOTIFICATION_POLICY')) fail('Emergency Notification Policy permission missing');
if (config.extra?.eas?.projectId !== '$ExpectedProjectId') fail('Unexpected EAS project id ' + config.extra?.eas?.projectId);
if (config.runtimeVersion !== '1.3.0') fail('Unexpected runtimeVersion ' + config.runtimeVersion);
if (eas?.build?.['production-apk']?.android?.buildType !== 'apk') fail('production-apk is not configured as APK');
if (eas?.build?.['production-apk']?.extends !== 'production') fail('production-apk no longer extends production');
if (eas?.build?.production?.environment !== 'production') fail('Production EAS environment mismatch');
if (eas?.build?.production?.env?.EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME !== 'firebase-video-production') fail('Production push provider mismatch');
if (firebase?.project_info?.project_id !== 'buklod-efa4a') fail('Firebase project mismatch');
if (!main?.client_info?.mobilesdk_app_id) fail('Main Firebase Android client missing');
console.log(JSON.stringify({name:config.name,version:config.version,versionCode:config.android.versionCode,package:config.android.package,runtimeVersion:config.runtimeVersion,projectId:config.extra.eas.projectId}, null, 2));
"@
  $verify | node -
  if ($LASTEXITCODE -ne 0) { throw 'Native identity/config gate failed.' }

  Step '7/9 Verify Expo/EAS authentication'
  npx eas-cli@latest whoami
  if ($LASTEXITCODE -ne 0) {
    throw 'EAS authentication is not ready. Run: npx eas-cli@latest login'
  }

  Step '8/9 Build installable APK on EAS'
  $jsonFile = Join-Path $Root 'eas-native-rc-apk-20260917.json'
  if (Test-Path $jsonFile) { Remove-Item $jsonFile -Force }

  $oldCI = $env:CI
  $env:CI = '1'
  try {
    npx eas-cli@latest build --platform android --profile production-apk --non-interactive --wait --json | Tee-Object -FilePath $jsonFile
    if ($LASTEXITCODE -ne 0) { throw 'EAS APK build failed.' }
  }
  finally {
    if ($null -eq $oldCI) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { $env:CI = $oldCI }
  }

  Step '9/9 Read build result'
  $raw = (Get-Content $jsonFile -Raw).Trim()
  if (-not $raw) { throw 'EAS returned no JSON build result.' }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { $build = $parsed[0] } else { $build = $parsed }
  $apkUrl = $build.artifacts.buildUrl
  if (-not $apkUrl) { $apkUrl = $build.artifacts.applicationArchiveUrl }
  if (-not $apkUrl) { throw 'EAS build completed but no APK URL was returned.' }

  Write-Host "`n====================================================================" -ForegroundColor DarkGreen
  Write-Host ' BUKLOD NATIVE RC APK READY' -ForegroundColor Green
  Write-Host '====================================================================' -ForegroundColor DarkGreen
  Write-Host "Commit      : $head"
  Write-Host "Version     : $ExpectedVersion"
  Write-Host "VersionCode : $ExpectedVersionCode"
  Write-Host "EAS Build ID: $($build.id)"
  Write-Host "Status      : $($build.status)"
  Write-Host "APK         : $apkUrl" -ForegroundColor Cyan
  Write-Host 'AAB         : NOT built. Test/edit this APK first; AAB comes only after approval.' -ForegroundColor Yellow
}
finally {
  Pop-Location
}
