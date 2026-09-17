param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ApprovedSha,

  [Parameter(Mandatory = $true)]
  [switch]$IConfirmAllPhysicalQAPassed
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = if ($env:BUKLOD_WORKSPACE) {
  $env:BUKLOD_WORKSPACE
} else {
  Join-Path $HOME 'BUKLOD_WORKSPACE'
}
$ReleaseDir = Join-Path $WorkspaceRoot 'RELEASE\ANDROID\NATIVE_RC_20260917'
$BuildRecord = Join-Path $ReleaseDir 'BUKLOD_NATIVE_RC_APK_RECORD_20260917.txt'
$ApprovalRecord = Join-Path $ReleaseDir 'BUKLOD_NATIVE_RC_PHYSICAL_QA_APPROVED_20260917.txt'

if (-not $IConfirmAllPhysicalQAPassed) {
  throw 'STOP: Physical QA approval requires explicit -IConfirmAllPhysicalQAPassed.'
}
if (-not (Test-Path $BuildRecord)) {
  throw "STOP: Native RC APK build record not found: $BuildRecord"
}

$recordText = Get-Content $BuildRecord -Raw
$recordShaMatch = [regex]::Match($recordText, '(?im)^Git SHA:\s*([0-9a-f]{40})\s*$')
$apkMatch = [regex]::Match($recordText, '(?im)^APK:\s*(.+?)\s*$')
$hashMatch = [regex]::Match($recordText, '(?im)^APK SHA256:\s*([0-9a-f]{64})\s*$')
$buildIdMatch = [regex]::Match($recordText, '(?im)^EAS Build ID:\s*(.+?)\s*$')

if (-not $recordShaMatch.Success -or -not $apkMatch.Success -or -not $hashMatch.Success) {
  throw 'STOP: RC build record is incomplete; cannot freeze physical QA safely.'
}

$recordSha = $recordShaMatch.Groups[1].Value.ToLowerInvariant()
$approved = $ApprovedSha.Trim().ToLowerInvariant()
if ($approved.Length -lt 7 -or -not $recordSha.StartsWith($approved)) {
  throw "STOP: ApprovedSha '$ApprovedSha' does not match the APK build SHA $recordSha."
}

$apkPath = $apkMatch.Groups[1].Value.Trim()
$recordHash = $hashMatch.Groups[1].Value.ToLowerInvariant()
if (-not (Test-Path $apkPath)) {
  throw "STOP: Exact tested APK is missing: $apkPath"
}
$actualHash = (Get-FileHash -Algorithm SHA256 -Path $apkPath).Hash.ToLowerInvariant()
if ($actualHash -ne $recordHash) {
  throw "STOP: APK SHA256 changed. Recorded=$recordHash actual=$actualHash"
}

if (-not (Test-Path (Join-Path $Root '.git'))) {
  throw "Run this script from the BUKLOD-Rork repository root. Current path: $Root"
}

$dirty = git -C $Root status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
if ($dirty) {
  Write-Host $dirty
  throw 'STOP: Repository is dirty. Do not approve physical QA against uncommitted source.'
}

git -C $Root fetch origin release/native-rc-apk-20260917
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
$remoteSha = (git -C $Root rev-parse origin/release/native-rc-apk-20260917).Trim().ToLowerInvariant()
if ($remoteSha -ne $recordSha) {
  throw "STOP: RC branch moved after the APK was built. Built/tested=$recordSha current remote=$remoteSha. Rebuild and retest the current RC."
}

@(
  'BUKLOD MAIN NATIVE RC PHYSICAL QA APPROVAL'
  'ALL REQUIRED ITEMS IN docs/BUKLOD_NATIVE_RC_PHYSICAL_QA_20260917.md: CONFIRMED PASS'
  "Approved SHA: $recordSha"
  'Branch: release/native-rc-apk-20260917'
  'Package: org.mzbministry.buklod'
  'Version: 1.3.0'
  'VersionCode: 21'
  "EAS Build ID: $($buildIdMatch.Groups[1].Value.Trim())"
  "Tested APK: $apkPath"
  "Tested APK SHA256: $actualHash"
  "Approved at: $([DateTimeOffset]::Now.ToString('o'))"
  'RULE: Any source change after this approval invalidates this record and requires APK rebuild + full physical retest.'
) | Set-Content -Path $ApprovalRecord -Encoding UTF8

Write-Host "`nBUKLOD NATIVE RC PHYSICAL QA: FROZEN" -ForegroundColor Green
Write-Host "Approved SHA : $recordSha" -ForegroundColor Cyan
Write-Host "APK SHA256   : $actualHash"
Write-Host "Approval     : $ApprovalRecord"
Write-Host 'The final AAB script will refuse any different RC SHA.' -ForegroundColor Yellow
