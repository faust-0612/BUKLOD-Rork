$ErrorActionPreference = "Stop"

$projectRoot = (Get-Location).Path
[Environment]::CurrentDirectory = $projectRoot

$script:results = @()

function Add-Pass {
    param([string]$Name,[string]$Detail="")
    $script:results += [pscustomobject]@{Status="PASS";Name=$Name;Detail=$Detail}
    Write-Host "[PASS] $Name" -ForegroundColor Green
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

function Add-Warn {
    param([string]$Name,[string]$Detail="")
    $script:results += [pscustomobject]@{Status="WARN";Name=$Name;Detail=$Detail}
    Write-Host "[WARN] $Name" -ForegroundColor Yellow
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor Yellow }
}

function Add-Fail {
    param([string]$Name,[string]$Detail="")
    $script:results += [pscustomobject]@{Status="FAIL";Name=$Name;Detail=$Detail}
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    if ($Detail) { Write-Host "       $Detail" -ForegroundColor Red }
}

function Get-LocalEnvValue {
    param([string]$Name)
    $envFile = Join-Path $projectRoot ".env.local"
    if (-not (Test-Path -LiteralPath $envFile)) { return "" }
    $text = [System.IO.File]::ReadAllText($envFile)
    $m = [regex]::Match($text,"(?m)^\s*"+[regex]::Escape($Name)+"\s*=\s*(.*?)\s*$")
    if (-not $m.Success) { return "" }
    return $m.Groups[1].Value.Trim().Trim("'","`"")
}

function Get-PackageVersion {
    param([string]$Name)
    $path = Join-Path $projectRoot ("node_modules\"+$Name.Replace("/","\")+"\package.json")
    if (-not (Test-Path -LiteralPath $path)) { return "" }
    try { return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json).version } catch { return "" }
}

function Get-PluginEntry {
    param([string]$Name,$Config)
    foreach ($plugin in @($Config.plugins)) {
        if ($plugin -is [string]) {
            if ($plugin -eq $Name) { return [pscustomobject]@{Found=$true;Options=$null} }
            continue
        }
        $parts=@($plugin)
        if ($parts.Count -gt 0 -and [string]$parts[0] -eq $Name) {
            $options=$null
            if ($parts.Count -gt 1) { $options=$parts[1] }
            return [pscustomobject]@{Found=$true;Options=$options}
        }
    }
    return [pscustomobject]@{Found=$false;Options=$null}
}

function Test-EasEnvName {
    param([string]$Name,[string]$EnvText)
    return ($EnvText -match ("(?m)^\s*"+[regex]::Escape($Name)+"\b"))
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " BUKLOD - FINAL NATIVE READINESS AUDIT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "READ ONLY - NO PREBUILD - NO APK BUILD" -ForegroundColor Yellow
Write-Host ""

$packageFile=Join-Path $projectRoot "package.json"
$appFile=Join-Path $projectRoot "app.config.js"
$easFile=Join-Path $projectRoot "eas.json"
$indexFile=Join-Path $projectRoot "index.js"
$layoutFile=Join-Path $projectRoot "src\app\_layout.tsx"

Write-Host "----- CORE FILES -----" -ForegroundColor Cyan
foreach ($file in @($packageFile,$appFile,$easFile,$indexFile,$layoutFile)) {
    if (Test-Path -LiteralPath $file) { Add-Pass "Core file exists" $file } else { Add-Fail "Core file missing" $file }
}
if (@($script:results|Where-Object Status -eq "FAIL").Count -gt 0) { exit 1 }

$package=Get-Content -LiteralPath $packageFile -Raw|ConvertFrom-Json
$appText=[System.IO.File]::ReadAllText($appFile)
$indexText=[System.IO.File]::ReadAllText($indexFile)
$layoutText=[System.IO.File]::ReadAllText($layoutFile)
$eas=Get-Content -LiteralPath $easFile -Raw|ConvertFrom-Json

Write-Host ""
Write-Host "----- EXPO STAGING CONFIG -----" -ForegroundColor Cyan
$env:APP_VARIANT="staging"
$env:EXPO_PUBLIC_APP_ENV="staging"
$configOutput=(npx expo config --type public --json 2>&1|Out-String)
if ($LASTEXITCODE -ne 0) { Add-Fail "Expo staging config resolution" $configOutput.Trim(); $config=$null }
else {
    try { $config=$configOutput|ConvertFrom-Json; Add-Pass "Expo staging config resolves" }
    catch { Add-Fail "Expo staging config JSON parse" $_.Exception.Message; $config=$null }
}
if ($null -ne $config) {
    if ($config.android.package -eq "org.mzbministry.buklod.staging") { Add-Pass "Staging Android package" "org.mzbministry.buklod.staging" }
    else { Add-Fail "Staging Android package" ([string]$config.android.package) }
}

Write-Host ""
Write-Host "----- VERSION / RUNTIME -----" -ForegroundColor Cyan
if ($null -ne $config) {
    if ($config.version -eq "1.3.0") { Add-Pass "App version" "1.3.0" } else { Add-Fail "App version must be 1.3.0" ([string]$config.version) }
    $runtimePolicy=""
    if ($config.runtimeVersion -is [string]) { $runtimePolicy=[string]$config.runtimeVersion }
    elseif ($null -ne $config.runtimeVersion -and $null -ne $config.runtimeVersion.policy) { $runtimePolicy=[string]$config.runtimeVersion.policy }
    if ($runtimePolicy -eq "appVersion") { Add-Pass "runtimeVersion policy" "appVersion" } else { Add-Fail "runtimeVersion policy must be appVersion" $runtimePolicy }
}

Write-Host ""
Write-Host "----- ORIENTATION -----" -ForegroundColor Cyan
if ($null -ne $config) {
    if ($config.orientation -eq "default") { Add-Pass "Global orientation" "default" } else { Add-Fail "Global orientation must be default" ([string]$config.orientation) }
    $screenEntry=Get-PluginEntry "expo-screen-orientation" $config
    if (-not $screenEntry.Found) { Add-Fail "expo-screen-orientation config plugin missing" }
    else {
        $initial=[string]$screenEntry.Options.initialOrientation
        if ($initial -eq "DEFAULT") { Add-Pass "Screen orientation initial mode" "DEFAULT" } else { Add-Fail "Screen orientation initial mode must be DEFAULT" $initial }
    }
}
if ($layoutText -match "orientation\s*[:=]\s*['`"]portrait['`"]") { Add-Fail "Root layout still contains portrait lock" } else { Add-Pass "No root portrait lock detected" }

Write-Host ""
Write-Host "----- CNG / EAS -----" -ForegroundColor Cyan
$ignoreFile=$null
if (Test-Path -LiteralPath (Join-Path $projectRoot ".easignore")) { $ignoreFile=Join-Path $projectRoot ".easignore" }
elseif (Test-Path -LiteralPath (Join-Path $projectRoot ".gitignore")) { $ignoreFile=Join-Path $projectRoot ".gitignore" }
if ($null -eq $ignoreFile) { Add-Fail "No .easignore or .gitignore available for CNG exclusion" }
else {
    $ignoreText=[System.IO.File]::ReadAllText($ignoreFile)
    if ($ignoreText -match "(?m)^\s*/android\s*$") { Add-Pass "/android excluded from EAS upload" $ignoreFile } else { Add-Fail "/android is not excluded from EAS upload" $ignoreFile }
    if ($ignoreText -match "(?m)^\s*/ios\s*$") { Add-Pass "/ios excluded from EAS upload" $ignoreFile } else { Add-Fail "/ios is not excluded from EAS upload" $ignoreFile }
}

Write-Host ""
Write-Host "----- EAS BUILD PROFILE -----" -ForegroundColor Cyan
$profile=$eas.build.'dev-native-120'
if ($null -eq $profile) { Add-Fail "EAS profile dev-native-120 missing" }
else {
    Add-Pass "EAS profile dev-native-120 exists"
    if ($profile.developmentClient -eq $true) { Add-Pass "Development client enabled" } else { Add-Fail "developmentClient should be true" }
    if ($profile.distribution -eq "internal") { Add-Pass "Internal distribution enabled" } else { Add-Fail "distribution should be internal" ([string]$profile.distribution) }
    if ($profile.android.buildType -eq "apk") { Add-Pass "Android build type" "APK" } else { Add-Fail "Android buildType must be apk" ([string]$profile.android.buildType) }
    $pEnv=[string]$profile.environment
    if ([string]::IsNullOrWhiteSpace($pEnv)) { Add-Warn "dev-native-120 has no explicit EAS environment field" }
    elseif ($pEnv -eq "development") { Add-Pass "EAS build environment" "development" }
    else { Add-Fail "dev-native-120 points to unexpected EAS environment" $pEnv }
}

Write-Host ""
Write-Host "----- EAS DEVELOPMENT VARIABLES -----" -ForegroundColor Cyan
$easEnvText=(npx eas-cli@latest env:list development --scope project --format short 2>&1|Out-String)
if ($LASTEXITCODE -ne 0) { Add-Fail "Could not read EAS Development variables" $easEnvText.Trim() }
else {
    Add-Pass "EAS Development environment reachable"
    foreach ($name in @("GOOGLE_MAPS_ANDROID_API_KEY","ADMOB_ANDROID_APP_ID","EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME","SENTRY_ORG","SENTRY_PROJECT","EXPO_PUBLIC_SENTRY_DSN","SENTRY_AUTH_TOKEN")) {
        if (Test-EasEnvName $name $easEnvText) { Add-Pass "EAS variable exists" $name } else { Add-Fail "EAS variable missing" $name }
    }
}

Write-Host ""
Write-Host "----- ML KIT TRANSLATION -----" -ForegroundColor Cyan
$mlRoot=Join-Path $projectRoot "modules\buklod-mlkit-translation"
$badMlRoot=Join-Path $projectRoot "modules\modules\buklod-mlkit-translation"
if (Test-Path -LiteralPath $mlRoot) { Add-Pass "ML Kit local module exists" $mlRoot } else { Add-Fail "ML Kit local module missing" $mlRoot }
if (Test-Path -LiteralPath $badMlRoot) { Add-Fail "Nested duplicate ML Kit module still exists" $badMlRoot } else { Add-Pass "No nested ML Kit duplicate detected" }
$mlConfig=Join-Path $mlRoot "expo-module.config.json"
if (Test-Path -LiteralPath $mlConfig) { Add-Pass "ML Kit expo-module.config.json exists" } else { Add-Fail "ML Kit expo-module.config.json missing" }
$mlText=""
if (Test-Path -LiteralPath $mlRoot) {
    foreach ($f in @(Get-ChildItem -LiteralPath $mlRoot -Recurse -File -ErrorAction SilentlyContinue|Where-Object {$_.Extension -in @(".kt",".gradle",".kts",".json",".ts")})) {
        try { $mlText += [System.IO.File]::ReadAllText($f.FullName)+"`n" } catch {}
    }
}
foreach ($c in @(
    @{Name="ML Kit Translate dependency 17.0.3";Pattern="com\.google\.mlkit:translate:17\.0\.3"},
    @{Name="ML Kit Language ID dependency 17.0.6";Pattern="com\.google\.mlkit:language-id:17\.0\.6"},
    @{Name="BuklodMlKitTranslationModule Kotlin module";Pattern="BuklodMlKitTranslationModule"}
)) {
    if ($mlText -match $c.Pattern) { Add-Pass $c.Name } else { Add-Fail $c.Name }
}

Write-Host ""
Write-Host "----- MAPS -----" -ForegroundColor Cyan
$mapsVersion=Get-PackageVersion "react-native-maps"
$locationVersion=Get-PackageVersion "expo-location"
if ($mapsVersion) { Add-Pass "react-native-maps installed" $mapsVersion } else { Add-Fail "react-native-maps missing" }
if ($locationVersion) { Add-Pass "expo-location installed" $locationVersion } else { Add-Fail "expo-location missing" }
if ($null -ne $config) {
    $mapsEntry=Get-PluginEntry "react-native-maps" $config
    if (-not $mapsEntry.Found) { Add-Fail "react-native-maps config plugin missing" }
    else {
        $key=[string]$mapsEntry.Options.androidGoogleMapsApiKey
        if ($key -match "^AIza") { Add-Pass "Resolved Android Google Maps key is populated" } else { Add-Fail "Resolved Android Google Maps API key is missing/invalid" }
    }
}
$localMapKey=Get-LocalEnvValue "GOOGLE_MAPS_ANDROID_API_KEY"
if ($localMapKey -match "^AIza") { Add-Pass "Local Maps API key exists" } else { Add-Fail "Local GOOGLE_MAPS_ANDROID_API_KEY missing/invalid" }

Write-Host ""
Write-Host "----- ADMOB / UMP -----" -ForegroundColor Cyan
$adsVersion=Get-PackageVersion "react-native-google-mobile-ads"
if ($adsVersion) { Add-Pass "react-native-google-mobile-ads installed" $adsVersion } else { Add-Fail "react-native-google-mobile-ads missing" }
if ($null -ne $config) {
    $adsEntry=Get-PluginEntry "react-native-google-mobile-ads" $config
    if (-not $adsEntry.Found) { Add-Fail "AdMob Expo config plugin missing" }
    else {
        $appId=[string]$adsEntry.Options.androidAppId
        if ($appId -match "^ca-app-pub-\d+~\d+$") { Add-Pass "Resolved AdMob Android App ID valid" } else { Add-Fail "Resolved AdMob Android App ID missing/invalid" }
        if ($adsEntry.Options.delayAppMeasurementInit -eq $true) { Add-Pass "AdMob delayed app measurement enabled" } else { Add-Fail "delayAppMeasurementInit is not true" }
    }
}
if ($appText -match "com\.google\.android\.gms\.internal\.consent_sdk") { Add-Pass "UMP ProGuard rule present" } else { Add-Warn "UMP ProGuard rule not detected in app.config.js" }
$adUnitsFile=Join-Path $projectRoot "src\lib\adUnits.ts"
$adMobFile=Join-Path $projectRoot "src\lib\adMob.ts"
$adsProviderFile=Join-Path $projectRoot "src\providers\AdsProvider.tsx"
$adBannerFile=Join-Path $projectRoot "src\components\BuklodTestAdBanner.tsx"
foreach ($file in @($adUnitsFile,$adMobFile,$adsProviderFile,$adBannerFile)) {
    if (Test-Path -LiteralPath $file) { Add-Pass "Ad runtime file exists" $file } else { Add-Fail "Ad runtime file missing" $file }
}
if (Test-Path -LiteralPath $adUnitsFile) {
    $t=[System.IO.File]::ReadAllText($adUnitsFile)
    if ($t -match "TestIds\.ADAPTIVE_BANNER") { Add-Pass "Staging Google test banner enforced" } else { Add-Fail "Staging Google test banner protection missing" }
}
if (Test-Path -LiteralPath $adMobFile) {
    $t=[System.IO.File]::ReadAllText($adMobFile)
    foreach ($p in @("AdsConsent","gatherConsent","canRequestAds")) {
        if ($t -match $p) { Add-Pass "UMP runtime contains $p" } else { Add-Fail "UMP runtime missing $p" }
    }
}
if ($layoutText -match "<AdsProvider>") { Add-Pass "AdsProvider root mounted" } else { Add-Fail "AdsProvider root mount missing" }

Write-Host ""
Write-Host "----- GCASH SUPPORT -----" -ForegroundColor Cyan
foreach ($pkgName in @("expo-clipboard","expo-web-browser","expo-linking")) {
    $v=Get-PackageVersion $pkgName
    if ($v) { Add-Pass "$pkgName installed" $v } else { Add-Fail "$pkgName missing" }
}
$gcashFile=Join-Path $projectRoot "src\lib\gcash.ts"
if (Test-Path -LiteralPath $gcashFile) {
    $g=[System.IO.File]::ReadAllText($gcashFile)
    foreach ($c in @(
        @{N="getGCashDetails";P="getGCashDetails"},
        @{N="copyGCashNumber";P="copyGCashNumber"},
        @{N="openGCashPayment";P="openGCashPayment"},
        @{N="Clipboard.setStringAsync";P="Clipboard\s*\.\s*setStringAsync"},
        @{N="WebBrowser.openBrowserAsync";P="WebBrowser\s*\.\s*openBrowserAsync"}
    )) {
        if ($g -match $c.P) { Add-Pass "GCash runtime" $c.N } else { Add-Fail "GCash runtime missing" $c.N }
    }
} else { Add-Fail "src\lib\gcash.ts missing" }

Write-Host ""
Write-Host "----- BACKGROUND AUDIO -----" -ForegroundColor Cyan
$audioVersion=Get-PackageVersion "expo-audio"
if ($audioVersion) { Add-Pass "expo-audio installed" $audioVersion } else { Add-Fail "expo-audio missing" }
if ($null -ne $config) {
    $audioEntry=Get-PluginEntry "expo-audio" $config
    if (-not $audioEntry.Found) { Add-Fail "expo-audio config plugin missing" }
    elseif ($audioEntry.Options.enableBackgroundPlayback -eq $true) { Add-Pass "Native background audio enabled" }
    else { Add-Fail "enableBackgroundPlayback is not true" }
}
$audioLib=Join-Path $projectRoot "src\lib\preachingAudio.ts"
$audioPlayer=Join-Path $projectRoot "src\components\PreachingAudioPlayer.tsx"
if (Test-Path -LiteralPath $audioLib) {
    $a=[System.IO.File]::ReadAllText($audioLib)
    if ($a -match "shouldPlayInBackground\s*:\s*true") { Add-Pass "Audio runtime background mode" } else { Add-Fail "shouldPlayInBackground:true missing" }
    if ($a -match "doNotMix") { Add-Pass "Audio interruption mode configured" } else { Add-Fail "Audio interruption mode missing" }
} else { Add-Fail "preachingAudio.ts missing" }
if (Test-Path -LiteralPath $audioPlayer) {
    $a=[System.IO.File]::ReadAllText($audioPlayer)
    if ($a -match "setActiveForLockScreen") { Add-Pass "Android lock-screen audio controls wired" } else { Add-Fail "setActiveForLockScreen missing" }
} else { Add-Fail "PreachingAudioPlayer.tsx missing" }

Write-Host ""
Write-Host "----- SENTRY -----" -ForegroundColor Cyan
$sentryVersion=Get-PackageVersion "@sentry/react-native"
if ($sentryVersion) { Add-Pass "@sentry/react-native installed" $sentryVersion } else { Add-Fail "@sentry/react-native missing" }
$sentryHits=@()
if (Test-Path -LiteralPath (Join-Path $projectRoot "src")) {
    $sentryHits=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot "src") -Recurse -File -ErrorAction SilentlyContinue|Where-Object {$_.Extension -in @(".ts",".tsx",".js",".jsx")}|Select-String -Pattern "Sentry\.init\s*\(" -ErrorAction SilentlyContinue)
}
if ($sentryHits.Count -gt 0) { Add-Pass "Sentry.init implementation found" } else { Add-Fail "Sentry.init implementation not found" }
if ($indexText -match "Sentry|sentry") { Add-Pass "Sentry referenced from early root entry" } else { Add-Warn "Sentry not referenced from index.js" }
$metroFile=Join-Path $projectRoot "metro.config.js"
$sentryNative=$false
if (Test-Path -LiteralPath $metroFile) {
    $m=[System.IO.File]::ReadAllText($metroFile)
    if ($m -match "Sentry|sentry") { $sentryNative=$true }
}
if ($appText -match "@sentry/react-native") { $sentryNative=$true }
if ($sentryNative) { Add-Pass "Sentry Expo/Metro native configuration detected" } else { Add-Fail "Sentry native/Metro configuration not detected" }

Write-Host ""
Write-Host "----- STREAM / FIREBASE -----" -ForegroundColor Cyan
$streamVersion=Get-PackageVersion "@stream-io/video-react-native-sdk"
$webrtcVersion=Get-PackageVersion "@stream-io/react-native-webrtc"
$callingXVersion=Get-PackageVersion "@stream-io/react-native-callingx"
$firebaseAppVersion=Get-PackageVersion "@react-native-firebase/app"
$firebaseMsgVersion=Get-PackageVersion "@react-native-firebase/messaging"
foreach ($item in @(
    @{Name="Stream Video SDK";Version=$streamVersion},
    @{Name="Stream WebRTC";Version=$webrtcVersion},
    @{Name="Stream CallingX";Version=$callingXVersion},
    @{Name="RNFirebase App";Version=$firebaseAppVersion},
    @{Name="RNFirebase Messaging";Version=$firebaseMsgVersion}
)) {
    if ($item.Version) { Add-Pass $item.Name $item.Version } else { Add-Fail "$($item.Name) missing" }
}
try {
    $v=[version](($streamVersion -split "-")[0])
    if ($v -ge [version]"1.32.0") { Add-Pass "Stream ringing SDK minimum satisfied" } else { Add-Fail "Stream Video SDK below 1.32.0" $streamVersion }
} catch { Add-Fail "Could not parse Stream Video version" $streamVersion }
try {
    $v=[version](($webrtcVersion -split "-")[0])
    if ($v -ge [version]"145.0.0") { Add-Pass "Stream WebRTC ringing minimum satisfied" } else { Add-Fail "Stream WebRTC below 145.0.0" $webrtcVersion }
} catch { Add-Fail "Could not parse Stream WebRTC version" $webrtcVersion }

if ($package.main -eq "index.js") { Add-Pass "package.json main = index.js" } else { Add-Fail "package.json main must be index.js" ([string]$package.main) }
$pushPos=$indexText.LastIndexOf("setPushConfig()")
$firebasePos=$indexText.LastIndexOf("setFirebaseListeners()")
$routerPos=$indexText.LastIndexOf("expo-router/entry")
if ($pushPos -ge 0 -and $firebasePos -ge 0 -and $routerPos -ge 0 -and $pushPos -lt $routerPos -and $firebasePos -lt $routerPos) { Add-Pass "Stream/Firebase startup occurs before Expo Router" } else { Add-Fail "Stream/Firebase root-entry ordering incorrect" }

if ($null -ne $config) {
    $streamEntry=Get-PluginEntry "@stream-io/video-react-native-sdk" $config
    $expectedBase="io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService"
    if (-not $streamEntry.Found) { Add-Fail "Stream Expo config plugin missing" }
    else {
        $o=$streamEntry.Options
        if ($o.ringing -eq $true) { Add-Pass "Stream ringing:true" } else { Add-Fail "Stream ringing:true missing" }
        if ($o.androidKeepCallAlive -eq $true) { Add-Pass "Stream androidKeepCallAlive:true" } else { Add-Fail "Stream androidKeepCallAlive:true missing" }
        if ($o.addNoiseCancellation -eq $true) { Add-Pass "Stream addNoiseCancellation:true" } else { Add-Warn "Stream addNoiseCancellation:true not detected" }
        if ([string]$o.androidMessagingServiceBaseClass -eq $expectedBase) { Add-Pass "RNFirebase single-service override configured" } else { Add-Fail "RNFirebase single-service override incorrect/missing" }
    }
    foreach ($pluginName in @("@react-native-firebase/app","@react-native-firebase/messaging")) {
        $entry=Get-PluginEntry $pluginName $config
        if ($entry.Found) { Add-Pass "Expo plugin configured" $pluginName } else { Add-Fail "Expo plugin missing" $pluginName }
    }
}
$pushFile=Join-Path $projectRoot "src\utils\setPushConfig.ts"
$listenerFile=Join-Path $projectRoot "src\utils\setFirebaseListeners.android.ts"
if (Test-Path -LiteralPath $pushFile) {
    $p=[System.IO.File]::ReadAllText($pushFile)
    foreach ($pattern in @("StreamVideoRN\.setPushConfig","createStreamVideoClient","getOrCreateInstance","EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME","stream-token")) {
        if ($p -match $pattern) { Add-Pass "Stream push source" $pattern } else { Add-Fail "Stream push source missing" $pattern }
    }
} else { Add-Fail "setPushConfig.ts missing" }
if (Test-Path -LiteralPath $listenerFile) {
    $p=[System.IO.File]::ReadAllText($listenerFile)
    foreach ($pattern in @("\bgetMessaging\s*\(","\bsetBackgroundMessageHandler\s*\(","\bonMessage\s*\(","isFirebaseStreamVideoMessage","firebaseDataHandler")) {
        if ($p -match $pattern) { Add-Pass "Firebase handler" $pattern } else { Add-Fail "Firebase handler missing" $pattern }
    }
} else { Add-Fail "setFirebaseListeners.android.ts missing" }

if ($null -ne $config) {
    $googlePath=[string]$config.android.googleServicesFile
    if ($googlePath -and -not [System.IO.Path]::IsPathRooted($googlePath)) { $googlePath=Join-Path $projectRoot $googlePath }
    if ($googlePath -and (Test-Path -LiteralPath $googlePath)) {
        try {
            $fj=Get-Content -LiteralPath $googlePath -Raw|ConvertFrom-Json
            $packages=@($fj.client|ForEach-Object {$_.client_info.android_client_info.package_name})
            if ($packages -contains "org.mzbministry.buklod.staging") { Add-Pass "Firebase JSON contains staging package" } else { Add-Fail "Firebase JSON staging package missing" }
        } catch { Add-Fail "Firebase JSON could not be parsed" $_.Exception.Message }
    } else { Add-Fail "Resolved google-services.json missing" }
}

Add-Warn "Stream Dashboard provider-name exact match remains manual" "EAS provider value must exactly equal the enabled Firebase provider Name in Stream Dashboard."
Add-Warn "Merged MESSAGING_EVENT manifest remains post-generation verification" "Raw node_modules source-service count is not final proof after the Stream Expo override."
Add-Warn "Terminated-state incoming call requires physical-device test" "Static audit cannot prove FCM behavior while app process is killed."

Write-Host ""
Write-Host "----- SUPPORT MODULES -----" -ForegroundColor Cyan
foreach ($pkgName in @("expo-document-picker","expo-file-system","expo-speech","expo-haptics","expo-linking","expo-clipboard","expo-web-browser")) {
    $v=Get-PackageVersion $pkgName
    if ($v) { Add-Pass "$pkgName installed" $v } else { Add-Fail "$pkgName missing" }
}

Write-Host ""
Write-Host "----- TYPESCRIPT -----" -ForegroundColor Cyan
$ts=(npx tsc --noEmit 2>&1|Out-String)
if ($LASTEXITCODE -eq 0) { Add-Pass "TypeScript clean" } else { Add-Fail "TypeScript failed" $ts.Trim() }

Write-Host ""
Write-Host "----- EXPO DOCTOR -----" -ForegroundColor Cyan
$doctor=(npx expo-doctor 2>&1|Out-String)
if ($LASTEXITCODE -eq 0) { Add-Pass "Expo Doctor passed" $doctor.Trim() } else { Add-Fail "Expo Doctor failed" $doctor.Trim() }

Write-Host ""
Write-Host "----- EXPO INSTALL CHECK -----" -ForegroundColor Cyan
$install=(npx expo install --check 2>&1|Out-String)
if ($LASTEXITCODE -eq 0) { Add-Pass "Expo dependency versions compatible" $install.Trim() } else { Add-Fail "Expo dependency version check failed" $install.Trim() }

Write-Host ""
Write-Host "----- EXPO AUTOLINKING -----" -ForegroundColor Cyan
$av=(npx expo-modules-autolinking verify 2>&1|Out-String)
if ($LASTEXITCODE -eq 0) { Add-Pass "Expo autolinking duplicate check passed" } else { Add-Fail "Expo autolinking verify failed" $av.Trim() }
$ar=(npx expo-modules-autolinking resolve --platform android 2>&1|Out-String)
if ($LASTEXITCODE -ne 0) { Add-Fail "Android Expo module resolution failed" $ar.Trim() }
else {
    Add-Pass "Android Expo module resolution completed"
    if ($ar -match "buklod-mlkit|BuklodMlKit") { Add-Pass "BUKLOD ML Kit module autolinked" } else { Add-Fail "BUKLOD ML Kit module not found in Android autolinking output" }
}

$passCount=@($script:results|Where-Object Status -eq "PASS").Count
$warnCount=@($script:results|Where-Object Status -eq "WARN").Count
$failCount=@($script:results|Where-Object Status -eq "FAIL").Count

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FINAL NATIVE READINESS RESULT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PASS : $passCount" -ForegroundColor Green
Write-Host "WARN : $warnCount" -ForegroundColor Yellow
Write-Host "FAIL : $failCount" -ForegroundColor Red

if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "BLOCKERS:" -ForegroundColor Red
    foreach ($item in @($script:results|Where-Object Status -eq "FAIL")) {
        Write-Host "  - $($item.Name)" -ForegroundColor Red
        if ($item.Detail) { Write-Host "    $($item.Detail)" -ForegroundColor DarkRed }
    }
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " FINAL NATIVE READINESS AUDIT = NOT READY" -ForegroundColor Red
    Write-Host " DO NOT BUILD APK YET" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 2
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " FINAL NATIVE READINESS AUDIT = STATIC READY" -ForegroundColor Green
Write-Host " TYPESCRIPT = CLEAN" -ForegroundColor Green
Write-Host " EXPO DOCTOR = CLEAN" -ForegroundColor Green
Write-Host " EXPO DEPENDENCIES = CLEAN" -ForegroundColor Green
Write-Host " AUTOLINKING = CLEAN" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "STILL REQUIRES FRESH APK / DEVICE QA:" -ForegroundColor Yellow
Write-Host "  - generated merged Android manifest" -ForegroundColor Yellow
Write-Host "  - ML Kit Kotlin native compilation" -ForegroundColor Yellow
Write-Host "  - terminated-state Stream incoming call" -ForegroundColor Yellow
Write-Host "  - Maps runtime rendering / Cloud key restrictions" -ForegroundColor Yellow
Write-Host "  - AdMob UMP dashboard message publication" -ForegroundColor Yellow
Write-Host "  - Sentry dashboard/source-map verification" -ForegroundColor Yellow
