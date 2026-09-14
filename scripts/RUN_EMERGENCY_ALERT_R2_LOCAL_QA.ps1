#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Step([string]$Message) {
  Write-Host ''
  Write-Host ('=' * 68) -ForegroundColor DarkGray
  Write-Host $Message -ForegroundColor Cyan
  Write-Host ('=' * 68) -ForegroundColor DarkGray
}

function Fail([string]$Message) {
  throw "R2 LOCAL QA FAILED: $Message"
}

$ExpectedBranch = 'feature/community-help-emergency-alert-r2'
$ExpectedRepo = 'https://github.com/faust-0612/BUKLOD-Rork.git'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ExportDir = Join-Path $env:TEMP "buklod-emergency-r2-android-export-$Stamp"

try {
  Step '1/7 VERIFY QA SOURCE IDENTITY'
  $origin = (& git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or $origin -ne $ExpectedRepo) {
    Fail "Wrong repository. Expected $ExpectedRepo; actual $origin"
  }

  $branchLines = @(& git symbolic-ref --short -q HEAD 2>$null)
  $branch = ''
  if ($branchLines.Count -gt 0) {
    $branch = ([string]$branchLines[0]).Trim()
  }
  if ($branch -and $branch -ne $ExpectedBranch) {
    Fail "Run this only from $ExpectedBranch or a detached worktree created from origin/$ExpectedBranch. Actual branch: $branch"
  }

  $dirty = @(& git status --porcelain)
  if ($dirty.Count -gt 0) {
    Fail 'QA worktree is dirty before checks.'
  }

  $head = (& git rev-parse HEAD).Trim()
  $branchLabel = '<detached>'
  if ($branch) { $branchLabel = $branch }
  Write-Host "Repo   : $origin"
  Write-Host "Branch : $branchLabel"
  Write-Host "HEAD   : $head"

  Step '2/7 INSTALL EXACT LOCKFILE DEPENDENCIES'
  # Use the CMD shims explicitly. Newer npm PowerShell shims inspect
  # $MyInvocation.Statement, which is not present in Windows PowerShell 5.1
  # under StrictMode and fails before npm itself can run.
  & npm.cmd ci --ignore-scripts
  if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }

  Step '3/7 VERIFY LOCKED R1 COMMUNITY HELP / SOS CONTRACT'
  & node scripts/community-help-sos-release-contract.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'Locked R1 SOS contract failed.' }

  Step '4/7 VERIFY EMERGENCY ALERT MODE R2 CONTRACT'
  & node scripts/community-help-emergency-alert-r2-contract.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'R2 emergency alert contract failed.' }

  Step '5/7 TYPESCRIPT QA'
  & npx.cmd tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Fail 'TypeScript QA failed.' }

  Step '6/7 ANDROID EXPO EXPORT — NO EAS BUILD / NO PUBLISH'
  if (Test-Path -LiteralPath $ExportDir) {
    Remove-Item -LiteralPath $ExportDir -Recurse -Force
  }
  & npx.cmd expo export --platform android --output-dir $ExportDir
  if ($LASTEXITCODE -ne 0) { Fail 'Android Expo export failed.' }
  if (!(Test-Path -LiteralPath $ExportDir -PathType Container)) {
    Fail 'Android Expo export directory was not created.'
  }

  Step '7/7 VERIFY QA DID NOT MUTATE SOURCE'
  $dirtyAfter = @(& git status --porcelain)
  if ($dirtyAfter.Count -gt 0) {
    Write-Host ($dirtyAfter -join "`n") -ForegroundColor Yellow
    Fail 'QA changed tracked/untracked repository state.'
  }

  Write-Host ''
  Write-Host 'R2 LOCAL QA: PASS' -ForegroundColor Green
  Write-Host "HEAD          : $head"
  Write-Host "Android export: $ExportDir"
  Write-Host 'No EAS Build, APK/AAB build, OTA publish, Web deploy, or production notification was triggered.' -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
