param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$RcBranch = "release/buklod-main-final-20260920"
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
Write-Host " BUKLOD MAIN FINAL LOCAL RELEASE FALLBACK" -ForegroundColor Green
Write-Host " PHASE 1: AUTOMATED QA -> NATIVE CNG QA -> AAB -> EXACT RC -> BACKEND HANDOFF" -ForegroundColor Green
Write-Host " NO MAIN/WEB CUTOVER UNTIL CENTRAL SUPPORT BACKEND IS VERIFIED" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $Repo)) {
  throw "Canonical repo not found: $Repo"
}
Set-Location -LiteralPath $Repo

$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'faust-0612/BUKLOD-Rork') {
  throw "Wrong repository remote: $remote"
}

Run "1/12 FETCH EXACT REMOTES" {
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
$qaRoot = "$HOME\BUKLOD_WORKSPACE\QA\BUKLOD_MAIN_FINAL_$short"

if (Test-Path -LiteralPath $qaRoot) {
  try { git worktree remove --force $qaRoot | Out-Null } catch {}
  Remove-Item -LiteralPath $qaRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Run "2/12 CREATE SOURCE-LOCKED QA WORKTREE" {
  git worktree add --detach $qaRoot $rcSha
  Assert-NativeSuccess "QA worktree creation"
}

Set-Location -LiteralPath $qaRoot
$actual = (git rev-parse HEAD).Trim()
if ($actual -ne $rcSha) {
  throw "QA worktree SHA mismatch. Expected $rcSha, got $actual"
}

Run "3/12 INSTALL LOCKED DEPENDENCIES" {
  npm.cmd ci --ignore-scripts --include=dev
  Assert-NativeSuccess "npm ci"
}

Run "4/12 STATIC + AUTH + TEST + TYPESCRIPT GATES" {
  node scripts/buklod-main-final-release-gate.mjs
  Assert-NativeSuccess "final release gate"
  node scripts/auth-canonical-login-contract.mjs
  Assert-NativeSuccess "auth canonical contract"
  npm.cmd test
  Assert-NativeSuccess "Jest regression suite"
  npx.cmd tsc --noEmit
  Assert-NativeSuccess "TypeScript release QA"
}

Run "5/12 MIGRATION + EXPO HEALTH + SECURITY GATES" {
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

Run "6/12 PRODUCTION ENVIRONMENT PREFLIGHT" {
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

Run "7/12 CONSOLIDATED NATIVE SOURCE GATE" {
  node scripts/buklod-main-final-native-gate.mjs
  Assert-NativeSuccess "final native source gate"
}

Run "8/12 FRESH WEB + ANDROID EXPORT QA" {
  $env:NODE_ENV = "production"
  Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item dist-android -Recurse -Force -ErrorAction SilentlyContinue
  npx.cmd expo export --platform web --output-dir dist --clear
  Assert-NativeSuccess "production web export"
  if (-not (Test-Path dist\index.html)) { throw "Web export has no index.html." }
  npx.cmd expo export --platform android --output-dir dist-android --clear
  Assert-NativeSuccess "Android export"
  if (-not (Test-Path dist-android)) { throw "Android export missing." }

  $bad = Get-ChildItem dist -Recurse -File -Filter *.js -ErrorAction SilentlyContinue |
    Select-String -Pattern 'localhost|127\.0\.0\.1|supabase\.local' -Quiet
  if ($bad) { throw "Development endpoint detected in production web bundle." }
}

Run "9/12 ANDROID CNG + GENERATED MANIFEST QA" {
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

Run "10/12 FREEZE EXACT RELEASE CANDIDATE" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "RC SHA changed." }
  git diff --exit-code -- .
  Assert-NativeSuccess "tracked RC cleanliness"
  git diff --cached --exit-code -- .
  Assert-NativeSuccess "staged RC cleanliness"
}

Run "11/12 BUILD FINAL PRODUCTION AAB FROM EXACT RC" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "AAB source SHA drifted." }
  npx.cmd --yes eas-cli@latest build --platform android --profile production --non-interactive --wait --json |
    Tee-Object -FilePath eas-aab-build.json
  Assert-NativeSuccess "production AAB build"
  if (-not (Test-Path eas-aab-build.json)) { throw "AAB build record missing." }
}

Set-Location -LiteralPath $Repo
Run "12/12 FREEZE REMOTES + WRITE SUPPORT BACKEND HANDOFF" {
  git fetch origin main $RcBranch
  Assert-NativeSuccess "final remote refresh"

  $mainNow = (git rev-parse origin/main).Trim()
  $rcNow = (git rev-parse "origin/$RcBranch").Trim()

  if ($mainNow -ne $mainBefore) {
    throw "origin/main changed during QA/AAB build. Phase 1 aborted; no backend/Main/Web cutover performed."
  }
  if ($rcNow -ne $rcSha) {
    throw "RC branch changed during QA/AAB build. Phase 1 aborted; exact AAB proof is no longer current."
  }

  git merge-base --is-ancestor $mainNow $rcSha
  Assert-NativeSuccess "fast-forward safety check"

  $handoff = [ordered]@{
    product = "BUKLOD Main"
    source_sha = $rcSha
    main_before = $mainBefore
    rc_branch = $RcBranch
    aab_record = "$qaRoot\eas-aab-build.json"
    support_schema = "BUKLOD_CENTRAL_SUPPORT_V1"
    support_migration = "supabase/migrations/20260920225500_buklod_central_support_v1.sql"
    support_function = "buklod-support-v1"
    support_verify_jwt = $false
    expected_health_service = "BUKLOD_SUPPORT_V1"
    created_at = (Get-Date).ToUniversalTime().ToString("o")
  }
  $handoffPath = "$qaRoot\buklod-support-backend-handoff.json"
  $handoff | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $handoffPath -Encoding UTF8
  if (-not (Test-Path -LiteralPath $handoffPath)) {
    throw "Backend handoff proof was not written."
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RELEASE PHASE 1 COMPLETE" -ForegroundColor Green
Write-Host " EXACT SOURCE SHA: $rcSha" -ForegroundColor Green
Write-Host " AAB BUILD RECORD: $qaRoot\eas-aab-build.json" -ForegroundColor Green
Write-Host " BACKEND HANDOFF: $qaRoot\buklod-support-backend-handoff.json" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BACKEND HANDOFF REQUIRED BEFORE MAIN / WEB CUTOVER" -ForegroundColor Yellow
Write-Host " DO NOT MANUALLY MERGE PR #192." -ForegroundColor Yellow
Write-Host " DO NOT DEPLOY WEB SEPARATELY." -ForegroundColor Yellow
Write-Host " Send this completed Phase 1 output back to ChatGPT." -ForegroundColor Yellow
Write-Host " The exact support migration + buklod-support-v1 function must be activated" -ForegroundColor Yellow
Write-Host " and health-verified before the same frozen SHA can resume release." -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
