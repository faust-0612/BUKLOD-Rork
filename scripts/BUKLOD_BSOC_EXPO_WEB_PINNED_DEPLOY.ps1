param(
  [switch]$PreviewOnly,
  [switch]$SkipTypecheck,
  [switch]$FreshClone
)
# Windows PowerShell 5.1-compatible, pinned Expo Hosting release script.
# Fails closed without publishing if source, build, account or project guard fails.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$repository = 'https://github.com/faust-0612/BUKLOD-Migrated-Sources.git'
$pinnedCommit = '3e8c51a3493d3017dae3e3d4051cd11b5bd39bef'
$subdirectory = 'systems/bsoc/BUKLOD_BSOC_Standalone'
$expectedProjectId = '55d08013-cf5c-4d4a-9ecb-8d9e8e21e62c'
$expectedOwner = 'faust_0612'
$expectedSlug = 'buklod-bsoc'
$reportPath = Join-Path $env:TEMP ('BUKLOD_BSOC_EXPO_RELEASE_' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')

$state = [ordered]@{
  schema = 'buklod-bsoc-expo-web-release/v2'
  expectedSha = $pinnedCommit
  projectId = $expectedProjectId
  status = 'NOT_STARTED'
  step = 'preflight'
  published = $false
  createdAt = [DateTime]::UtcNow.ToString('o')
}
$workDir = $null

function Assert-ExitCode {
  param([string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE"
  }
}

function Run-Native {
  param(
    [string]$Executable,
    [string[]]$Arguments,
    [string]$Step
  )
  Write-Host "STEP: $Step"
  $state.step = $Step
  # Use the .cmd shims on Windows. Avoid npm.ps1/eas.ps1 interacting with
  # parent PowerShell strict mode and command AST properties.
  & $Executable @Arguments
  Assert-ExitCode $Step
}

try {
  $state.step = 'tools'
  $git = Get-Command 'git.exe' -ErrorAction Stop
  $npm = Get-Command 'npm.cmd' -ErrorAction Stop
  $npx = Get-Command 'npx.cmd' -ErrorAction Stop
  $state.status = 'TOOLS_AVAILABLE'

  $state.step = 'source_checkout'
  $root = $null
  if (-not $FreshClone) {
    $previous = @(Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'BUKLOD_BSOC_WEB_RELEASE_*' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTimeUtc -Descending)
    foreach ($candidate in $previous) {
      $candidateWorkDir = Join-Path $candidate.FullName $subdirectory
      if (-not (Test-Path -LiteralPath (Join-Path $candidateWorkDir 'package-lock.json'))) { continue }
      $candidateHead = (& $git.Source -C $candidate.FullName rev-parse HEAD 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $candidateHead -eq $pinnedCommit) {
        $root = $candidate.FullName
        Write-Host "Reusing SHA-verified checkout: $root"
        break
      }
    }
  }
  if (-not $root) {
    $root = Join-Path $env:TEMP ('BUKLOD_BSOC_WEB_RELEASE_' + [Guid]::NewGuid().ToString('N'))
    Run-Native $git.Source @('clone', '--quiet', '--filter=blob:none', '--no-checkout', $repository, $root) 'clone_original_source'
    Run-Native $git.Source @('-C', $root, 'fetch', '--quiet', 'origin', $pinnedCommit) 'fetch_pinned_commit'
    Run-Native $git.Source @('-C', $root, 'checkout', '--quiet', '--detach', $pinnedCommit) 'checkout_pinned_commit'
  }
  $actual = (& $git.Source -C $root rev-parse HEAD | Out-String).Trim()
  Assert-ExitCode 'verify_checkout_sha'
  if ($actual -ne $pinnedCommit) { throw 'Pinned source SHA mismatch' }

  $workDir = Join-Path $root $subdirectory
  if (-not (Test-Path -LiteralPath (Join-Path $workDir 'package-lock.json'))) {
    throw 'Recovered source is missing package-lock.json'
  }
  $app = Get-Content -LiteralPath (Join-Path $workDir 'app.json') -Raw | ConvertFrom-Json
  if ($app.expo.owner -ne $expectedOwner -or
      $app.expo.slug -ne $expectedSlug -or
      $app.expo.extra.eas.projectId -ne $expectedProjectId -or
      $app.expo.web.output -ne 'static') {
    throw 'Expo owner/slug/projectId/web.output mismatch; no deployment authorized'
  }
  $state.status = 'SOURCE_VERIFIED'
  $state.step = 'dependencies'
  $state.workingCopy = $workDir

  # These are PUBLIC publishable client values, NOT secrets or service_role.
  $env:EXPO_PUBLIC_SUPABASE_URL = 'https://yhanxndaqbmuzbdqlblu.supabase.co'
  $env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS'
  $env:CI = '1'

  Push-Location -LiteralPath $workDir
  try {
    Run-Native $npm.Source @('ci', '--no-audit', '--no-fund') 'npm_ci'
    $state.status = 'DEPENDENCIES_INSTALLED'

    if (-not $SkipTypecheck) {
      Run-Native $npm.Source @('run', 'typecheck') 'typecheck'
      $state.status = 'TYPECHECK_PASSED'
    }
    Run-Native $npm.Source @('run', 'export:web') 'export_web'
    if (-not (Test-Path -LiteralPath (Join-Path $workDir 'dist/index.html'))) {
      throw 'Expo export did not create dist/index.html'
    }
    $state.status = 'WEB_BUNDLE_BUILT'

    $state.step = 'expo_auth'
    $easCmd = Get-Command 'eas.cmd' -ErrorAction SilentlyContinue
    if ($null -ne $easCmd) {
      $easBinary = $easCmd.Source
      $easPrefix = @()
    } else {
      $easBinary = $npx.Source
      $easPrefix = @('--yes', 'eas-cli@latest')
    }
    # Capture only account username; do not log EXPO_TOKEN or credentials.
    Write-Host 'STEP: expo_auth'
    $whoLines = @(& $easBinary @easPrefix 'whoami' 2>&1)
    Assert-ExitCode 'Expo whoami'
    $who = ($whoLines | Out-String).Trim()
    if ($who -notmatch ('(?im)^' + [regex]::Escape($expectedOwner) + '$')) {
      throw 'Authenticated Expo account differs from original project owner. Run eas login as the correct account.'
    }
    $state.status = 'EXPO_OWNER_VERIFIED'

    # Confirm linked Expo project identity before production deployment.
    $state.step = 'expo_project'
    Write-Host 'STEP: expo_project'
    $projectLines = @(& $easBinary @easPrefix 'project:info' 2>&1)
    Assert-ExitCode 'Expo project:info'
    $projectText = ($projectLines | Out-String)
    if ($projectText -notmatch [regex]::Escape($expectedProjectId)) {
      throw 'Expo project:info does not match expected project ID; refusing to publish.'
    }
    $state.status = 'EXPO_PROJECT_VERIFIED'

    $arguments = @($easPrefix) + @('deploy', '--non-interactive')
    if (-not $PreviewOnly) { $arguments += '--prod' }
    Write-Host ('STEP: ' + $(if ($PreviewOnly) { 'expo_preview_deploy' } else { 'expo_production_deploy' }))
    $state.step = $(if ($PreviewOnly) { 'expo_preview_deploy' } else { 'expo_production_deploy' })
    # Show EAS CLI output for deployment URL/ID without echoing any credentials.
    & $easBinary @arguments
    Assert-ExitCode 'Expo web deployment'
    $state.status = $(if ($PreviewOnly) { 'EXPO_PREVIEW_DEPLOY_COMMAND_SUCCEEDED' } else { 'EXPO_PRODUCTION_DEPLOY_COMMAND_SUCCEEDED' })
    $state.published = $true
    $state.note = 'CLI completed; verify actual Expo URL and deployed release ID separately.'
  }
  finally {
    Pop-Location
  }
}
catch {
  $state.error = $_.Exception.Message
  $state.errorType = $_.Exception.GetType().FullName
  $state.errorPosition = $_.InvocationInfo.PositionMessage
  Write-Warning ('Deployment stopped at ' + $state.step + ': ' + $state.error)
  if ($state.errorPosition) { Write-Warning $state.errorPosition }
}
finally {
  $state.finishedAt = [DateTime]::UtcNow.ToString('o')
  $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  Write-Host ('RELEASE RECEIPT: ' + $reportPath)
  Write-Host ('RESULT=' + $state.status + ' PUBLISHED=' + $state.published + ' STEP=' + $state.step + ' PINNED_SOURCE=' + $pinnedCommit)
}
if (-not $state.published) { exit 1 }
