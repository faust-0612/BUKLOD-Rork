$ErrorActionPreference = "Continue"

$projectRoot = (Get-Location).Path
[Environment]::CurrentDirectory = $projectRoot

$script:checks = @()

function Pass {
    param([string]$Name,[string]$Detail="")
    $script:checks += [pscustomobject]@{Status="PASS";Name=$Name;Detail=$Detail}
    Write-Host "[PASS] $Name" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Warn {
    param([string]$Name,[string]$Detail="")
    $script:checks += [pscustomobject]@{Status="WARN";Name=$Name;Detail=$Detail}
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor Yellow }
}

function Fail {
    param([string]$Name,[string]$Detail="")
    $script:checks += [pscustomobject]@{Status="FAIL";Name=$Name;Detail=$Detail}
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor Red }
}

function Run-Native {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $output = (& $Command 2>&1 | Out-String)
        $code = $LASTEXITCODE
        return [pscustomobject]@{
            Label    = $Label
            ExitCode = $code
            Output   = $output.Trim()
        }
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-PluginEntry {
    param([string]$Name,$Config)

    foreach ($plugin in @($Config.plugins)) {
        if ($plugin -is [string]) {
            if ($plugin -eq $Name) {
                return [pscustomobject]@{Found=$true;Options=$null}
            }
            continue
        }

        $parts = @($plugin)

        if ($parts.Count -gt 0 -and [string]$parts[0] -eq $Name) {
            $options = $null
            if ($parts.Count -gt 1) { $options = $parts[1] }

            return [pscustomobject]@{
                Found   = $true
                Options = $options
            }
        }
    }

    return [pscustomobject]@{
        Found   = $false
        Options = $null
    }
}

function Test-EasEnvName {
    param([string]$Name,[string]$Text)
    return ($Text -match ("(?m)^\s*" + [regex]::Escape($Name) + "\b"))
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FINAL-B - NATIVE READINESS CLOSING AUDIT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "READ ONLY - NO PREBUILD - NO APK BUILD" -ForegroundColor Yellow
Write-Host ""

# ------------------------------------------------------------
# 1. FINAL-A MUST REALLY BE CLEAN
# ------------------------------------------------------------

Write-Host "----- 1. EXPO DOCTOR -----" -ForegroundColor Cyan

$doctor = Run-Native "expo-doctor" {
    npx expo-doctor --verbose
}

if ($doctor.ExitCode -eq 0) {
    Pass "Expo Doctor clean" (($doctor.Output -split "`r?`n" | Select-Object -Last 2) -join " | ")
}
else {
    Fail "Expo Doctor still has issue(s)" $doctor.Output
}

# ------------------------------------------------------------
# 2. EXPO INSTALL CHECK
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 2. EXPO INSTALL CHECK -----" -ForegroundColor Cyan

$install = Run-Native "expo install --check" {
    npx expo install --check
}

if ($install.ExitCode -eq 0) {
    Pass "Expo package versions compatible" $install.Output
}
else {
    Fail "Expo package version check failed" $install.Output
}

# ------------------------------------------------------------
# 3. TYPESCRIPT
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 3. TYPESCRIPT -----" -ForegroundColor Cyan

$ts = Run-Native "tsc" {
    npx tsc --noEmit
}

if ($ts.ExitCode -eq 0) {
    Pass "TypeScript clean"
}
else {
    Fail "TypeScript failed" $ts.Output
}

# ------------------------------------------------------------
# 4. LOCAL ML KIT MODULE STRUCTURE + GITIGNORE
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 4. ML KIT LOCAL MODULE -----" -ForegroundColor Cyan

$mlRoot = Join-Path $projectRoot "modules\buklod-mlkit-translation"
$mlAndroid = Join-Path $mlRoot "android"
$mlConfig = Join-Path $mlRoot "expo-module.config.json"
$nestedBad = Join-Path $projectRoot "modules\modules\buklod-mlkit-translation"

if (Test-Path -LiteralPath $mlRoot) {
    Pass "ML Kit module root exists" $mlRoot
}
else {
    Fail "ML Kit module root missing" $mlRoot
}

if (Test-Path -LiteralPath $mlAndroid) {
    Pass "ML Kit Android native directory exists"
}
else {
    Fail "ML Kit Android native directory missing"
}

if (Test-Path -LiteralPath $mlConfig) {
    Pass "ML Kit expo-module.config.json exists"
}
else {
    Fail "ML Kit expo-module.config.json missing"
}

if (Test-Path -LiteralPath $nestedBad) {
    Fail "Stale nested duplicate ML Kit module exists" $nestedBad
}
else {
    Pass "No nested duplicate ML Kit module"
}

$gitCheck = Run-Native "git check-ignore module android" {
    git check-ignore -v -- "modules/buklod-mlkit-translation/android"
}

if ($gitCheck.ExitCode -eq 0) {
    Fail "ML Kit Android directory is still gitignored" $gitCheck.Output
}
else {
    Pass "ML Kit Android directory is NOT gitignored"
}

$rootAndroidCheck = Run-Native "git check-ignore root android" {
    git check-ignore -v -- "android"
}

if ($rootAndroidCheck.ExitCode -eq 0) {
    Pass "Root /android remains ignored for CNG" $rootAndroidCheck.Output
}
else {
    Fail "Root /android is not ignored for CNG"
}

# ------------------------------------------------------------
# 5. EXPO AUTOLINKING VERIFY
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 5. EXPO AUTOLINKING VERIFY -----" -ForegroundColor Cyan

$autoVerify = Run-Native "expo-modules-autolinking verify" {
    npx expo-modules-autolinking verify --verbose
}

if ($autoVerify.ExitCode -eq 0) {
    Pass "Expo native-module duplicate check clean"
}
else {
    Fail "Expo autolinking verify failed" $autoVerify.Output
}

# ------------------------------------------------------------
# 6. ANDROID AUTOLINKING RESOLVE
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 6. ANDROID AUTOLINKING RESOLVE -----" -ForegroundColor Cyan

$autoResolve = Run-Native "expo-modules-autolinking resolve android" {
    npx expo-modules-autolinking resolve --platform android
}

if ($autoResolve.ExitCode -eq 0) {
    Pass "Android autolinking resolution completed"

    if ($autoResolve.Output -match "buklod-mlkit|BuklodMlKit") {
        Pass "BUKLOD ML Kit detected by Android autolinking"
    }
    else {
        Fail "BUKLOD ML Kit NOT found in Android autolinking output" $autoResolve.Output
    }
}
else {
    Fail "Android autolinking resolution failed" $autoResolve.Output
}

# ------------------------------------------------------------
# 7. ML KIT NATIVE SOURCE / DEPENDENCIES
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 7. ML KIT SOURCE CHECK -----" -ForegroundColor Cyan

$mlText = ""

if (Test-Path -LiteralPath $mlRoot) {
    foreach ($f in @(
        Get-ChildItem `
            -LiteralPath $mlRoot `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Extension -in @(".kt",".gradle",".kts",".json",".ts",".tsx")
        }
    )) {
        try {
            $mlText += [System.IO.File]::ReadAllText($f.FullName)
            $mlText += "`n"
        }
        catch {}
    }
}

foreach ($check in @(
    @{
        Name="ML Kit Translate 17.0.3"
        Pattern="com\.google\.mlkit:translate:17\.0\.3"
    },
    @{
        Name="ML Kit Language ID 17.0.6"
        Pattern="com\.google\.mlkit:language-id:17\.0\.6"
    },
    @{
        Name="BuklodMlKitTranslationModule Kotlin class"
        Pattern="BuklodMlKitTranslationModule"
    }
)) {
    if ($mlText -match $check.Pattern) {
        Pass $check.Name
    }
    else {
        Fail "$($check.Name) missing"
    }
}

# ------------------------------------------------------------
# 8. RESOLVED STAGING CONFIG - CRITICAL NATIVE VALUES
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 8. RESOLVED STAGING CONFIG -----" -ForegroundColor Cyan

$env:APP_VARIANT = "staging"
$env:EXPO_PUBLIC_APP_ENV = "staging"

$configRun = Run-Native "expo config" {
    npx expo config --type public --json
}

$config = $null

if ($configRun.ExitCode -ne 0) {
    Fail "Staging Expo config failed to resolve" $configRun.Output
}
else {
    try {
        $config = $configRun.Output | ConvertFrom-Json
        Pass "Staging Expo config resolves"
    }
    catch {
        Fail "Staging Expo config JSON parse failed" $_.Exception.Message
    }
}

if ($null -ne $config) {
    if ($config.android.package -eq "org.mzbministry.buklod.staging") {
        Pass "Staging Android package correct"
    }
    else {
        Fail "Wrong staging Android package" ([string]$config.android.package)
    }

    if ($config.version -eq "1.3.0") {
        Pass "App version 1.3.0"
    }
    else {
        Fail "App version is not 1.3.0" ([string]$config.version)
    }

    $runtimePolicy = ""
    if ($config.runtimeVersion -is [string]) {
        $runtimePolicy = [string]$config.runtimeVersion
    }
    elseif ($null -ne $config.runtimeVersion.policy) {
        $runtimePolicy = [string]$config.runtimeVersion.policy
    }

    if ($runtimePolicy -eq "appVersion") {
        Pass "runtimeVersion policy = appVersion"
    }
    else {
        Fail "runtimeVersion policy is not appVersion" $runtimePolicy
    }

    if ($config.orientation -eq "default") {
        Pass "Global orientation = default"
    }
    else {
        Fail "Global orientation is not default" ([string]$config.orientation)
    }

    $streamEntry = Get-PluginEntry "@stream-io/video-react-native-sdk" $config

    if (-not $streamEntry.Found) {
        Fail "Stream Expo plugin missing"
    }
    else {
        $s = $streamEntry.Options

        if ($s.ringing -eq $true) {
            Pass "Stream ringing:true"
        }
        else {
            Fail "Stream ringing:true missing"
        }

        if ($s.androidKeepCallAlive -eq $true) {
            Pass "Stream androidKeepCallAlive:true"
        }
        else {
            Fail "Stream androidKeepCallAlive:true missing"
        }

        $expectedBase = "io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService"

        if ([string]$s.androidMessagingServiceBaseClass -eq $expectedBase) {
            Pass "Stream/RNFirebase single-service override correct"
        }
        else {
            Fail "Stream/RNFirebase single-service override wrong or missing"
        }
    }

    foreach ($pluginName in @(
        "@react-native-firebase/app",
        "@react-native-firebase/messaging"
    )) {
        $entry = Get-PluginEntry $pluginName $config
        if ($entry.Found) {
            Pass "Expo plugin configured" $pluginName
        }
        else {
            Fail "Expo plugin missing" $pluginName
        }
    }

    $mapsEntry = Get-PluginEntry "react-native-maps" $config

    if (
        $mapsEntry.Found -and
        ([string]$mapsEntry.Options.androidGoogleMapsApiKey -match "^AIza")
    ) {
        Pass "Resolved Google Maps Android key populated"
    }
    else {
        Fail "Resolved Google Maps Android key missing/invalid"
    }

    $adsEntry = Get-PluginEntry "react-native-google-mobile-ads" $config

    if (
        $adsEntry.Found -and
        ([string]$adsEntry.Options.androidAppId -match "^ca-app-pub-\d+~\d+$")
    ) {
        Pass "Resolved AdMob Android App ID valid"
    }
    else {
        Fail "Resolved AdMob Android App ID missing/invalid"
    }

    $audioEntry = Get-PluginEntry "expo-audio" $config

    if (
        $audioEntry.Found -and
        $audioEntry.Options.enableBackgroundPlayback -eq $true
    ) {
        Pass "expo-audio background playback enabled"
    }
    else {
        Fail "expo-audio background playback not enabled"
    }
}

# ------------------------------------------------------------
# 9. EAS DEVELOPMENT ENVIRONMENT - NAMES ONLY, NO SECRET PRINT
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 9. EAS DEVELOPMENT VARIABLES -----" -ForegroundColor Cyan

$easEnv = Run-Native "EAS env:list development" {
    npx eas-cli@latest env:list development --scope project --format short
}

if ($easEnv.ExitCode -ne 0) {
    Fail "Cannot read EAS Development environment" $easEnv.Output
}
else {
    Pass "EAS Development environment reachable"

    foreach ($name in @(
        "GOOGLE_MAPS_ANDROID_API_KEY",
        "ADMOB_ANDROID_APP_ID",
        "EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME",
        "SENTRY_ORG",
        "SENTRY_PROJECT",
        "EXPO_PUBLIC_SENTRY_DSN",
        "SENTRY_AUTH_TOKEN"
    )) {
        if (Test-EasEnvName $name $easEnv.Output) {
            Pass "EAS variable exists" $name
        }
        else {
            Fail "EAS variable missing" $name
        }
    }
}

# ------------------------------------------------------------
# 10. ROOT ENTRY / STREAM FIREBASE STARTUP
# ------------------------------------------------------------

Write-Host ""
Write-Host "----- 10. ROOT ENTRY / PUSH STARTUP -----" -ForegroundColor Cyan

$packageFile = Join-Path $projectRoot "package.json"
$indexFile = Join-Path $projectRoot "index.js"

if (
    (Test-Path -LiteralPath $packageFile) -and
    (Test-Path -LiteralPath $indexFile)
) {
    $package = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
    $indexText = [System.IO.File]::ReadAllText($indexFile)

    if ($package.main -eq "index.js") {
        Pass "package.json main = index.js"
    }
    else {
        Fail "package.json main is not index.js" ([string]$package.main)
    }

    $p1 = $indexText.LastIndexOf("setPushConfig()")
    $p2 = $indexText.LastIndexOf("setFirebaseListeners()")
    $r  = $indexText.LastIndexOf("expo-router/entry")

    if (
        $p1 -ge 0 -and
        $p2 -ge 0 -and
        $r -ge 0 -and
        $p1 -lt $r -and
        $p2 -lt $r
    ) {
        Pass "Stream/Firebase startup runs before Expo Router"
    }
    else {
        Fail "Stream/Firebase root-entry ordering incorrect"
    }
}
else {
    Fail "package.json or index.js missing"
}

# ------------------------------------------------------------
# 11. FINAL COUNT
# ------------------------------------------------------------

$passCount = @(
    $script:checks |
    Where-Object Status -eq "PASS"
).Count

$warnCount = @(
    $script:checks |
    Where-Object Status -eq "WARN"
).Count

$failCount = @(
    $script:checks |
    Where-Object Status -eq "FAIL"
).Count

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FINAL-B RESULT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PASS : $passCount" -ForegroundColor Green
Write-Host "WARN : $warnCount" -ForegroundColor Yellow
Write-Host "FAIL : $failCount" -ForegroundColor Red

if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "FINAL BLOCKERS:" -ForegroundColor Red

    foreach ($item in @(
        $script:checks |
        Where-Object Status -eq "FAIL"
    )) {
        Write-Host "  - $($item.Name)" -ForegroundColor Red

        if ($item.Detail) {
            $detail = $item.Detail

            if ($detail.Length -gt 1200) {
                $detail = $detail.Substring(0,1200) + " ...[truncated]"
            }

            Write-Host "    $detail" -ForegroundColor DarkRed
        }
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " FINAL-B = NOT READY" -ForegroundColor Red
    Write-Host " DO NOT BUILD APK YET" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 2
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " FINAL-B = STATIC READY" -ForegroundColor Green
Write-Host " ZERO STATIC BLOCKERS" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT PROOF IS NATIVE BUILD + DEVICE QA:" -ForegroundColor Yellow
Write-Host "  - ML Kit Kotlin native compile" -ForegroundColor Yellow
Write-Host "  - generated/merged Android MESSAGING_EVENT manifest" -ForegroundColor Yellow
Write-Host "  - Stream incoming call in background/terminated state" -ForegroundColor Yellow
Write-Host "  - Maps runtime rendering and Google Cloud restrictions" -ForegroundColor Yellow
Write-Host "  - AdMob UMP runtime/dashboard setup" -ForegroundColor Yellow
Write-Host "  - Sentry event/source-map verification" -ForegroundColor Yellow
