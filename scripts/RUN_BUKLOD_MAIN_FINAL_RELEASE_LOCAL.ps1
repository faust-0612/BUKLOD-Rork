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
Write-Host " AUTOMATED QA -> NATIVE CNG QA -> AAB -> EXACT RC -> MAIN -> WEB" -ForegroundColor Green
Write-Host " DEPLOYMENT LAST / SAME SOURCE SHA / NO PIECEMEAL RELEASE" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $Repo)) {
  throw "Canonical repo not found: $Repo"
}
Set-Location -LiteralPath $Repo

$remote = (git remote get-url origin).Trim()
if ($remote -notmatch 'faust-0612/BUKLOD-Rork') {
  throw "Wrong repository remote: $remote"
}

Run "1/13 FETCH EXACT REMOTES" {
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

Run "2/13 CREATE SOURCE-LOCKED QA WORKTREE" {
  git worktree add --detach $qaRoot $rcSha
  Assert-NativeSuccess "QA worktree creation"
}

Set-Location -LiteralPath $qaRoot
$actual = (git rev-parse HEAD).Trim()
if ($actual -ne $rcSha) {
  throw "QA worktree SHA mismatch. Expected $rcSha, got $actual"
}

Run "3/13 INSTALL LOCKED DEPENDENCIES" {
  npm.cmd ci --ignore-scripts --include=dev
  Assert-NativeSuccess "npm ci"
}

Run "4/13 STATIC + AUTH + TEST + TYPESCRIPT GATES" {
  node scripts/buklod-main-final-release-gate.mjs
  Assert-NativeSuccess "final release gate"
  node scripts/auth-canonical-login-contract.mjs
  Assert-NativeSuccess "auth canonical contract"
  npm.cmd test
  Assert-NativeSuccess "Jest regression suite"
  npx.cmd tsc --noEmit
  Assert-NativeSuccess "TypeScript release QA"
}

Run "5/13 MIGRATION + EXPO HEALTH + SECURITY GATES" {
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

Run "6/13 PRODUCTION ENVIRONMENT PREFLIGHT" {
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

Run "7/13 CONSOLIDATED NATIVE SOURCE GATE" {
  node scripts/buklod-main-final-native-gate.mjs
  Assert-NativeSuccess "final native source gate"
}

Run "8/13 FRESH WEB + ANDROID EXPORT QA" {
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

Run "9/13 ANDROID CNG + GENERATED MANIFEST QA" {
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

Run "10/13 FREEZE EXACT RELEASE CANDIDATE" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "RC SHA changed." }
  git diff --exit-code -- .
  Assert-NativeSuccess "tracked RC cleanliness"
  git diff --cached --exit-code -- .
  Assert-NativeSuccess "staged RC cleanliness"
}

Run "11/13 BUILD FINAL PRODUCTION AAB FROM EXACT RC" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "AAB source SHA drifted." }
  npx.cmd --yes eas-cli@latest build --platform android --profile production --non-interactive --wait --json |
    Tee-Object -FilePath eas-aab-build.json
  Assert-NativeSuccess "production AAB build"
  if (-not (Test-Path eas-aab-build.json)) { throw "AAB build record missing." }
}

Set-Location -LiteralPath $Repo
Run "12/13 ATOMIC FAST-FORWARD VERIFIED RC TO MAIN" {
  git fetch origin main $RcBranch
  Assert-NativeSuccess "final remote refresh"
}
$mainNow = (git rev-parse origin/main).Trim()
$rcNow = (git rev-parse "origin/$RcBranch").Trim()
if ($mainNow -ne $mainBefore) {
  throw "origin/main changed during QA. Release aborted; no deployment performed."
}
if ($rcNow -ne $rcSha) {
  throw "RC branch changed during QA. Release aborted; no deployment performed."
}
git merge-base --is-ancestor $mainNow $rcSha
if ($LASTEXITCODE -ne 0) { throw "Fast-forward safety check failed." }

Run "12B/13 PUSH VERIFIED RC TO MAIN" {
  git push origin "$rcSha`:refs/heads/main"
  Assert-NativeSuccess "verified RC push to main"
}

Set-Location -LiteralPath $qaRoot

Run "13/13 FINAL WEB PRODUCTION PUSH + LIVE VERIFY" {
  $env:NODE_ENV = "production"
  npx.cmd --yes eas-cli@latest deploy --prod --environment production --non-interactive
  Assert-NativeSuccess "production web deploy"

  1..5 | ForEach-Object {
    $response = Invoke-WebRequest -Uri "https://buklod.expo.app/" -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400 -or -not $response.Content) {
      throw "Live web verification failed on attempt $_."
    }
  }
}


Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL WEB + AAB BUILD COMPLETE" -ForegroundColor Green
Write-Host " SOURCE SHA: $rcSha" -ForegroundColor Green
Write-Host " WEB: https://buklod.expo.app" -ForegroundColor Green
Write-Host " AAB BUILD RECORD: $qaRoot\eas-aab-build.json" -ForegroundColor Green
Write-Host " PHYSICAL DEVICE NATIVE QA STILL REQUIRED BEFORE PLAY SUBMISSION" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Green
