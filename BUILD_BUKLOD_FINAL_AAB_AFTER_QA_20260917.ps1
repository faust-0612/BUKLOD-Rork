param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ApprovedSha
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Branch = 'release/native-rc-apk-20260917'
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

Require-Command git
Require-Command node
Require-Command npm

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = if ($env:BUKLOD_WORKSPACE) {
  $env:BUKLOD_WORKSPACE
} else {
  Join-Path $HOME 'BUKLOD_WORKSPACE'
}
$RcReleaseDir = Join-Path $WorkspaceRoot 'RELEASE\ANDROID\NATIVE_RC_20260917'
$FinalReleaseDir = Join-Path $WorkspaceRoot 'RELEASE\ANDROID\FINAL_AAB_20260917'
$QaApprovalPath = Join-Path $RcReleaseDir 'BUKLOD_NATIVE_RC_PHYSICAL_QA_APPROVED_20260917.txt'
New-Item -ItemType Directory -Path $FinalReleaseDir -Force | Out-Null

Push-Location $Root
try {
  Step '1/9 Require explicit physical-QA approval record'
  if (-not (Test-Path $QaApprovalPath)) {
    throw "STOP: Physical QA approval record is missing: $QaApprovalPath. Complete the real-device checklist and run APPROVE_BUKLOD_NATIVE_RC_AFTER_PHYSICAL_QA_20260917.ps1 first."
  }
  $qaText = Get-Content $QaApprovalPath -Raw
  $qaShaMatch = [regex]::Match($qaText, '(?im)^Approved SHA:\s*([0-9a-f]{7,40})\s*$')
  if (-not $qaShaMatch.Success) {
    throw 'STOP: Physical QA approval record does not contain a valid Approved SHA.'
  }
  $qaSha = $qaShaMatch.Groups[1].Value.ToLowerInvariant()
  $approved = $ApprovedSha.Trim().ToLowerInvariant()
  if ($approved.Length -lt 7 -or -not $qaSha.StartsWith($approved)) {
    throw "STOP: Requested ApprovedSha '$ApprovedSha' does not match physical-QA record SHA $qaSha."
  }
  Write-Host "Physical QA approval record: $QaApprovalPath" -ForegroundColor Cyan
  Write-Host "Approved RC SHA: $qaSha" -ForegroundColor Cyan

  Step '2/9 Freeze exact physically-approved RC commit'
  if (-not (Test-Path '.git')) {
    throw "Run this script from the BUKLOD-Rork repository root. Current path: $Root"
  }

  $dirty = git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
  if ($dirty) {
    Write-Host $dirty
    throw 'STOP: Working tree is not clean. Final AAB must come from a clean, immutable RC commit.'
  }

  git fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw "Could not checkout $Branch." }
  git pull --ff-only origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'Fast-forward pull failed.' }

  $head = (git rev-parse HEAD).Trim().ToLowerInvariant()
  $remoteHead = (git rev-parse "origin/$Branch").Trim().ToLowerInvariant()

  if ($head -ne $remoteHead) {
    throw "Local HEAD $head does not equal origin/$Branch $remoteHead."
  }
  if ($head -ne $qaSha) {
    throw "STOP: Current RC $head is not the physically-approved SHA $qaSha. Any RC change invalidates the old physical approval; rebuild APK and retest."
  }

  Write-Host "Physically-approved immutable SHA: $head" -ForegroundColor Cyan

  Step '3/9 Install exact locked dependencies'
  npm ci --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

  Step '4/9 Re-run native closing contract'
  node scripts/native-android-closing-contract.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Native closing contract failed. Final AAB blocked.' }

  Step '5/9 Re-run TypeScript gate'
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript gate failed. Final AAB blocked.' }

  Step '6/9 Verify exact production Main identity'
  $env:APP_VARIANT = 'production'
  $env:EXPO_PUBLIC_APP_ENV = 'production'
  $env:BUKLOD_APP_TARGET = 'main'

  $verify = @"
const makeConfig = require('./app.config.js');
const eas = require('./eas.json');
const fs = require('fs');
const config = makeConfig({ config: {} });
const firebase = JSON.parse(fs.readFileSync('google-services.production.json','utf8'));
const client = (firebase.client || []).find(c => c?.client_info?.android_client_info?.package_name === '$ExpectedPackage');
const fail = m => { throw new Error(m); };
if (config.name !== 'BUKLOD') fail('Wrong app name: ' + config.name);
if (config.version !== '$ExpectedVersion') fail('Wrong version: ' + config.version);
if (config.android?.package !== '$ExpectedPackage') fail('Wrong package: ' + config.android?.package);
if (config.android?.versionCode !== $ExpectedVersionCode) fail('Wrong versionCode: ' + config.android?.versionCode);
if (config.runtimeVersion !== '1.3.0') fail('Wrong runtime: ' + config.runtimeVersion);
if (config.extra?.eas?.projectId !== '$ExpectedProjectId') fail('Wrong EAS project id');
if (!config.android?.permissions?.includes('android.permission.ACCESS_NOTIFICATION_POLICY')) fail('SOS DND permission missing');
if (eas?.build?.production?.android?.buildType !== 'app-bundle') fail('Production is not app-bundle');
if (eas?.build?.production?.environment !== 'production') fail('Production environment mismatch');
if (eas?.build?.production?.env?.EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME !== 'firebase-video-production') fail('Wrong Stream production push provider');
if (firebase?.project_info?.project_id !== 'buklod-efa4a') fail('Wrong Firebase project');
if (!client?.client_info?.mobilesdk_app_id) fail('Main Firebase Android client missing');
console.log(JSON.stringify({name:config.name,package:config.android.package,version:config.version,versionCode:config.android.versionCode,runtimeVersion:config.runtimeVersion,projectId:config.extra.eas.projectId}, null, 2));
"@
  $verify | node -
  if ($LASTEXITCODE -ne 0) { throw 'Production identity/config gate failed.' }

  Step '7/9 Verify Expo/EAS authentication and build final Play-ready AAB'
  npx eas-cli@latest whoami
  if ($LASTEXITCODE -ne 0) { throw 'EAS login missing. Run: npx eas-cli@latest login' }

  $jsonFile = Join-Path $FinalReleaseDir 'eas-final-aab-20260917.json'
  if (Test-Path $jsonFile) { Remove-Item $jsonFile -Force }

  $oldCI = $env:CI
  $env:CI = '1'
  try {
    npx eas-cli@latest build --platform android --profile production --non-interactive --wait --json | Tee-Object -FilePath $jsonFile
    if ($LASTEXITCODE -ne 0) { throw 'EAS final AAB build failed.' }
  }
  finally {
    if ($null -eq $oldCI) { Remove-Item Env:CI -ErrorAction SilentlyContinue } else { $env:CI = $oldCI }
  }

  Step '8/9 Download exact final AAB and hash it'
  $raw = (Get-Content $jsonFile -Raw).Trim()
  if (-not $raw) { throw 'EAS returned no JSON build result.' }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { $build = $parsed[0] } else { $build = $parsed }
  $aabUrl = $build.artifacts.buildUrl
  if (-not $aabUrl) { $aabUrl = $build.artifacts.applicationArchiveUrl }
  if (-not $aabUrl) { throw 'EAS completed but no AAB artifact URL was returned.' }

  $aabPath = Join-Path $FinalReleaseDir 'BUKLOD_MAIN_1.3.0_v21_FINAL.aab'
  if (Test-Path $aabPath) { Remove-Item $aabPath -Force }
  Invoke-WebRequest -Uri $aabUrl -OutFile $aabPath -UseBasicParsing
  if (-not (Test-Path $aabPath) -or (Get-Item $aabPath).Length -lt 1000000) {
    throw 'Downloaded final AAB is missing or unexpectedly small.'
  }
  $aabHash = (Get-FileHash -Algorithm SHA256 -Path $aabPath).Hash.ToLowerInvariant()

  Step '9/9 Record immutable final AAB result'
  $recordPath = Join-Path $FinalReleaseDir 'BUKLOD_FINAL_AAB_APPROVAL_20260917.txt'
  @(
    'BUKLOD MAIN FINAL AAB APPROVAL RECORD'
    "Approved SHA: $head"
    "Physical QA record: $QaApprovalPath"
    "Version: $ExpectedVersion"
    "VersionCode: $ExpectedVersionCode"
    "Package: $ExpectedPackage"
    "EAS Build ID: $($build.id)"
    "EAS Status: $($build.status)"
    "AAB URL: $aabUrl"
    "AAB: $aabPath"
    "AAB SHA256: $aabHash"
    "Generated: $([DateTimeOffset]::Now.ToString('o'))"
  ) | Set-Content -Path $recordPath -Encoding UTF8

  Write-Host "`n====================================================================" -ForegroundColor DarkGreen
  Write-Host ' BUKLOD MAIN FINAL AAB READY' -ForegroundColor Green
  Write-Host '====================================================================' -ForegroundColor DarkGreen
  Write-Host "Approved SHA : $head"
  Write-Host "Package      : $ExpectedPackage"
  Write-Host "Version      : $ExpectedVersion ($ExpectedVersionCode)"
  Write-Host "EAS Build ID : $($build.id)"
  Write-Host "AAB           : $aabPath" -ForegroundColor Cyan
  Write-Host "AAB SHA256    : $aabHash"
  Write-Host "Approval file : $recordPath"
  Write-Host 'Next gate: upload this exact AAB to Google Play Production; do not rebuild from a different SHA.' -ForegroundColor Yellow
}
finally {
  Pop-Location
}
