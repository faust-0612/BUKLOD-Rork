param(
  [string]$Repo = "D:\Downloads\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$RcBranch = "release/buklod-main-final-rc-20260923"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-NativeSuccess([string]$Context) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Context FAILED with exit code $LASTEXITCODE"
  }
}

function Run([string]$Label, [scriptblock]$Command) {
  Write-Host ""
  Write-Host "=== $Label ===" -ForegroundColor Cyan
  & $Command
}

function Load-DotEnv([string]$Path) {
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $pair = $line.Split("=", 2)
    $name = $pair[0].Trim()
    $value = $pair[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL LOCAL RELEASE - PHASE 1" -ForegroundColor Green
Write-Host " QA -> EXACT RC -> SUPPORT BACKEND HANDOFF" -ForegroundColor Green
Write-Host " WEB DEPLOY FIRST IN PHASE 2 -> LIVE VERIFY -> SAME-SHA AAB" -ForegroundColor Green
Write-Host " C: READ-ONLY / ALL ACTIVE WRITES ON D:" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $Repo)) {
  throw "Canonical D: repo not found: $Repo"
}
if (-not $Repo.StartsWith("D:\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Active release repo must be on D:. C: is read-only."
}
Set-Location -LiteralPath $Repo

$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'faust-0612/BUKLOD-Rork') {
  throw "Wrong repository remote: $remote"
}

$sourceRoot = Split-Path -LiteralPath $Repo -Parent
$workspaceRoot = Split-Path -LiteralPath $sourceRoot -Parent
$qaBase = Join-Path $workspaceRoot "QA"
$cacheRoot = Join-Path $workspaceRoot "CACHE"
$tempRoot = Join-Path $workspaceRoot "TEMP"
New-Item -ItemType Directory -Force -Path $qaBase,$cacheRoot,$tempRoot | Out-Null
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:npm_config_cache = Join-Path $cacheRoot "npm"
$env:GRADLE_USER_HOME = Join-Path $cacheRoot "gradle"
New-Item -ItemType Directory -Force -Path $env:npm_config_cache,$env:GRADLE_USER_HOME | Out-Null

Run "1/11 FETCH EXACT REMOTES" {
  git fetch origin main $RcBranch --prune
  Assert-NativeSuccess "initial remote fetch"
}

$mainBefore = (git rev-parse origin/main).Trim()
$rcSha = (git rev-parse "origin/$RcBranch").Trim()
if (-not $rcSha) { throw "Could not resolve RC SHA." }

git merge-base --is-ancestor origin/main "origin/$RcBranch"
if ($LASTEXITCODE -ne 0) {
  throw "RC is not a fast-forward descendant of current origin/main."
}

$short = $rcSha.Substring(0, 12)
$qaRoot = Join-Path $qaBase "BUKLOD_MAIN_FINAL_$short"

if (Test-Path -LiteralPath $qaRoot) {
  try { git worktree remove --force $qaRoot | Out-Null } catch {}
  Remove-Item -LiteralPath $qaRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Run "2/11 CREATE SOURCE-LOCKED D: QA WORKTREE" {
  git worktree add --detach $qaRoot $rcSha
  Assert-NativeSuccess "QA worktree creation"
}

Set-Location -LiteralPath $qaRoot
$actual = (git rev-parse HEAD).Trim()
if ($actual -ne $rcSha) {
  throw "QA worktree SHA mismatch. Expected $rcSha, got $actual"
}

Run "3/11 INSTALL LOCKED DEPENDENCIES" {
  npm.cmd ci --ignore-scripts --include=dev
  Assert-NativeSuccess "npm ci"
}

Run "4/11 STATIC + AUTH + TEST + TYPESCRIPT GATES" {
  node scripts/buklod-main-final-release-gate.mjs
  Assert-NativeSuccess "final release gate"
  node scripts/buklod-main-ux-feedback-gate.mjs
  Assert-NativeSuccess "Main UX feedback gate"
  node scripts/verify-buklod-main-self-heal-r1.cjs
  Assert-NativeSuccess "Main closed-loop self-heal contract"
  node scripts/auth-canonical-login-contract.mjs
  Assert-NativeSuccess "auth canonical contract"
  npm.cmd test
  Assert-NativeSuccess "Jest regression suite"
  npx.cmd tsc --noEmit
  Assert-NativeSuccess "TypeScript release QA"
}

Run "5/11 MIGRATION + EXPO HEALTH + SECURITY GATES" {
  node scripts/verify-production-migrations.mjs | Out-File -Encoding utf8 final-migration-manifest.json
  Assert-NativeSuccess "migration manifest"
  npx.cmd --yes expo-doctor@latest
  Assert-NativeSuccess "Expo Doctor"
  npx.cmd expo install --check
  Assert-NativeSuccess "Expo dependency compatibility"
  npx.cmd expo-modules-autolinking verify
  Assert-NativeSuccess "Expo native-module duplicate check"
  $autoLink = (npx.cmd expo-modules-autolinking resolve --platform android | Out-String)
  Assert-NativeSuccess "Android native-module resolution"
  if ($autoLink -notmatch "buklod-mlkit|BuklodMlKit") {
    throw "BUKLOD ML Kit native module was not resolved by Android autolinking."
  }
  npm.cmd audit --omit=dev --audit-level=high
  Assert-NativeSuccess "production dependency security audit"
}

Run "6/11 PRODUCTION ENVIRONMENT PREFLIGHT" {
  npx.cmd --yes eas-cli@latest whoami --non-interactive
  Assert-NativeSuccess "EAS identity"
  Remove-Item .env.local -Force -ErrorAction SilentlyContinue
  npx.cmd --yes eas-cli@latest env:pull --environment production --path .env.local --non-interactive
  Assert-NativeSuccess "production environment pull"
  if (-not (Test-Path .env.local)) { throw "Production environment pull failed." }
  Load-DotEnv .env.local
  if ($env:EXPO_PUBLIC_SUPABASE_URL -ne "https://yhanxndaqbmuzbdqlblu.supabase.co") {
    throw "Wrong production Supabase URL."
  }
  $env:EXPO_PUBLIC_APP_ENV = "production"
  $env:APP_VARIANT = "production"
  $env:BUKLOD_APP_TARGET = "main"
  $env:EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME = "firebase-video-production"

  node scripts/production-preflight.mjs
  Assert-NativeSuccess "production preflight"

  $easEnvText = (npx.cmd --yes eas-cli@latest env:list production --scope project --format short | Out-String)
  Assert-NativeSuccess "production EAS env list"
  foreach ($requiredName in @(
    "GOOGLE_MAPS_ANDROID_API_KEY",
    "ADMOB_ANDROID_APP_ID",
    "EXPO_PUBLIC_SENTRY_DSN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN"
  )) {
    if ($easEnvText -notmatch ("(?m)^\s*" + [regex]::Escape($requiredName) + "\b")) {
      throw "Required production EAS variable missing: $requiredName"
    }
  }
}

Run "7/11 CONSOLIDATED NATIVE SOURCE GATE" {
  node scripts/buklod-main-final-native-gate.mjs
  Assert-NativeSuccess "final native source gate"
}

Run "8/11 FRESH WEB + ANDROID EXPORT QA" {
  $env:NODE_ENV = "production"
  Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item dist-android -Recurse -Force -ErrorAction SilentlyContinue
  npx.cmd expo export --platform web --output-dir dist --clear
  Assert-NativeSuccess "production web export"
  if (-not (Test-Path dist\index.html)) { throw "Web export has no index.html." }
  node scripts/write-adsense-dist-assets.mjs dist
  Assert-NativeSuccess "web dist assets"
  npx.cmd expo export --platform android --output-dir dist-android --clear
  Assert-NativeSuccess "Android export"
  if (-not (Test-Path dist-android)) { throw "Android export missing." }

  $bad = Get-ChildItem dist -Recurse -File -Filter *.js -ErrorAction SilentlyContinue |
    Select-String -Pattern 'localhost|127\.0\.0\.1|supabase\.local' -Quiet
  if ($bad) { throw "Development endpoint detected in production web bundle." }
}

Run "9/11 ANDROID CNG + GENERATED MANIFEST QA" {
  $trackedAndroid = @(git ls-files android)
  if ($trackedAndroid.Count -gt 0) {
    throw "Root android contains tracked files; refusing destructive CNG cleanup."
  }

  Remove-Item android -Recurse -Force -ErrorAction SilentlyContinue
  npx.cmd expo prebuild --platform android --clean --no-install
  Assert-NativeSuccess "Android CNG prebuild"

  $androidText = (
    Get-ChildItem android -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in @(".xml", ".kt", ".java", ".gradle", ".properties") } |
      ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue }
  ) -join [Environment]::NewLine

  foreach ($token in @(
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.MANAGE_OWN_CALLS",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.intent.action.SEND",
    "android.intent.action.SEND_MULTIPLE"
  )) {
    if ($androidText -notmatch [regex]::Escape($token)) {
      throw "Generated Android native project missing requirement: $token"
    }
  }

  Remove-Item android -Recurse -Force -ErrorAction SilentlyContinue
}

Run "10/11 FREEZE EXACT RELEASE CANDIDATE" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "RC SHA changed." }
  git diff --exit-code -- .
  Assert-NativeSuccess "tracked RC cleanliness"
  git diff --cached --exit-code -- .
  Assert-NativeSuccess "staged RC cleanliness"
}

Set-Location -LiteralPath $Repo
Run "11/11 FREEZE REMOTES + WRITE SUPPORT BACKEND HANDOFF" {
  git fetch origin main $RcBranch
  Assert-NativeSuccess "final remote refresh"

  $mainNow = (git rev-parse origin/main).Trim()
  $rcNow = (git rev-parse "origin/$RcBranch").Trim()

  if ($mainNow -ne $mainBefore) {
    throw "origin/main changed during QA. Phase 1 aborted; no backend/Web/Main cutover performed."
  }
  if ($rcNow -ne $rcSha) {
    throw "RC branch changed during QA. Phase 1 aborted; verification is no longer current."
  }

  git merge-base --is-ancestor $mainNow $rcSha
  Assert-NativeSuccess "fast-forward safety check"

  $handoff = [ordered]@{
    product = "BUKLOD Main"
    source_sha = $rcSha
    main_before = $mainBefore
    rc_branch = $RcBranch
    support_schema = "BSOC_USER_FEEDBACK_COMPAT_V1"
    support_migration = "supabase/migrations/20260920225500_buklod_central_support_v1.sql"
    support_function = "buklod-support-v1"
    support_verify_jwt = $false
    expected_health_service = "BUKLOD_SUPPORT_V1"
    required_release_order = "WEB_LIVE_VERIFY_THEN_SAME_SHA_AAB"
    created_at = (Get-Date).ToUniversalTime().ToString("o")
  }
  $handoffPath = Join-Path $qaRoot "buklod-support-backend-handoff.json"
  $handoff | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $handoffPath -Encoding UTF8
  if (-not (Test-Path -LiteralPath $handoffPath)) {
    throw "Backend handoff proof was not written."
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RELEASE PHASE 1 COMPLETE" -ForegroundColor Green
Write-Host " EXACT SOURCE SHA: $rcSha" -ForegroundColor Green
Write-Host " BACKEND HANDOFF: $qaRoot\buklod-support-backend-handoff.json" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BACKEND HANDOFF REQUIRED BEFORE PRODUCTION WEB CUTOVER" -ForegroundColor Yellow
Write-Host " WEB MUST DEPLOY AND PASS LIVE VERIFY BEFORE SAME-SHA AAB BUILD." -ForegroundColor Yellow
Write-Host " DO NOT MANUALLY MERGE RELEASE PRS." -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
