param(
  [string]$Repo = "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN",
  [string]$RcBranch = "release/buklod-main-final-20260920"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Run([string]$Label, [scriptblock]$Command) {
  Write-Host ""
  Write-Host "=== $Label ===" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label FAILED with exit code $LASTEXITCODE"
  }
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
Write-Host " AUTOMATED QA -> EXACT RC -> MAIN -> WEB -> VERIFY -> APK" -ForegroundColor Green
Write-Host " NO MANUAL APP TEST REQUIRED / DEPLOYMENT LAST" -ForegroundColor Green
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
}

Set-Location -LiteralPath $qaRoot
$actual = (git rev-parse HEAD).Trim()
if ($actual -ne $rcSha) {
  throw "QA worktree SHA mismatch. Expected $rcSha, got $actual"
}

Run "3/12 INSTALL LOCKED DEPENDENCIES" {
  npm.cmd ci --ignore-scripts
}

Run "4/12 STATIC + AUTH + TEST + TYPESCRIPT GATES" {
  node scripts/buklod-main-final-release-gate.mjs
  node scripts/auth-canonical-login-contract.mjs
  npm.cmd test
  npx.cmd tsc --noEmit
}

Run "5/12 MIGRATION + EXPO HEALTH GATES" {
  node scripts/verify-production-migrations.mjs | Out-File -Encoding utf8 final-migration-manifest.json
  npx.cmd --yes expo-doctor@latest
}

Run "6/12 PRODUCTION ENVIRONMENT PREFLIGHT" {
  npx.cmd --yes eas-cli@latest whoami --non-interactive
  Remove-Item .env.local -Force -ErrorAction SilentlyContinue
  npx.cmd --yes eas-cli@latest env:pull --environment production --path .env.local --non-interactive
  if (-not (Test-Path .env.local)) { throw "Production environment pull failed." }
  Load-DotEnv .env.local
  if ($env:EXPO_PUBLIC_SUPABASE_URL -ne "https://yhanxndaqbmuzbdqlblu.supabase.co") {
    throw "Wrong production Supabase URL."
  }
  $env:EXPO_PUBLIC_APP_ENV = "production"
  $env:BUKLOD_APP_TARGET = "main"
  node scripts/production-preflight.mjs
}

Run "7/12 FRESH WEB + ANDROID EXPORT QA" {
  $env:NODE_ENV = "production"
  Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item dist-android -Recurse -Force -ErrorAction SilentlyContinue
  npx.cmd expo export --platform web --output-dir dist --clear
  if (-not (Test-Path dist\index.html)) { throw "Web export has no index.html." }
  npx.cmd expo export --platform android --output-dir dist-android --clear
  if (-not (Test-Path dist-android)) { throw "Android export missing." }

  $bad = Get-ChildItem dist -Recurse -File -Filter *.js -ErrorAction SilentlyContinue |
    Select-String -Pattern 'localhost|127\.0\.0\.1|supabase\.local' -Quiet
  if ($bad) { throw "Development endpoint detected in production web bundle." }
}

Run "8/12 FREEZE EXACT RELEASE CANDIDATE" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "RC SHA changed." }
  git diff --exit-code -- .
  git diff --cached --exit-code -- .
}

Set-Location -LiteralPath $Repo
Run "9/12 ATOMIC FAST-FORWARD MAIN PUSH" {
  git fetch origin main $RcBranch
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

Run "10/12 PUSH VERIFIED RC TO MAIN" {
  git push origin "$rcSha`:refs/heads/main"
}

Set-Location -LiteralPath $qaRoot

Run "11/12 FINAL WEB PRODUCTION PUSH + LIVE VERIFY" {
  $env:NODE_ENV = "production"
  npx.cmd --yes eas-cli@latest deploy --prod --environment production --non-interactive

  1..5 | ForEach-Object {
    $response = Invoke-WebRequest -Uri "https://buklod.expo.app/" -MaximumRedirection 5 -TimeoutSec 20 -UseBasicParsing
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400 -or -not $response.Content) {
      throw "Live web verification failed on attempt $_."
    }
  }
}

Run "12/12 FINAL ANDROID APK BUILD FROM SAME SHA" {
  if ((git rev-parse HEAD).Trim() -ne $rcSha) { throw "APK source SHA drifted." }
  npx.cmd --yes eas-cli@latest build --platform android --profile production-apk --non-interactive --wait --json |
    Tee-Object -FilePath eas-apk-build.json
  if (-not (Test-Path eas-apk-build.json)) { throw "APK build record missing." }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " BUKLOD MAIN FINAL RELEASE COMPLETE" -ForegroundColor Green
Write-Host " SOURCE SHA: $rcSha" -ForegroundColor Green
Write-Host " WEB: https://buklod.expo.app" -ForegroundColor Green
Write-Host " APK BUILD RECORD: $qaRoot\eas-apk-build.json" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
