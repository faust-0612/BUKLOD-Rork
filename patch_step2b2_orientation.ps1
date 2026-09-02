$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
[Environment]::CurrentDirectory = $projectRoot

$appFile =
    Join-Path $projectRoot "app.config.js"

$layoutFile =
    Join-Path $projectRoot "src\app\_layout.tsx"

$packageFile =
    Join-Path $projectRoot "package.json"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " STEP 2B-2 - ORIENTATION SURGICAL REPAIR" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# ==================================================
# 1. VERIFY PROJECT + PACKAGE
# ==================================================

foreach ($file in @(
    $appFile,
    $layoutFile,
    $packageFile
)) {

    if (-not (Test-Path -LiteralPath $file)) {
        throw "Required file missing: $file"
    }
}

$pkg =
    Get-Content `
        -LiteralPath $packageFile `
        -Raw |
    ConvertFrom-Json

$orientationPackage = $null

if ($null -ne $pkg.dependencies) {
    $orientationPackage =
        $pkg.dependencies.PSObject.Properties[
            "expo-screen-orientation"
        ]
}

if (
    $null -eq $orientationPackage -and
    $null -ne $pkg.devDependencies
) {
    $orientationPackage =
        $pkg.devDependencies.PSObject.Properties[
            "expo-screen-orientation"
        ]
}

if ($null -eq $orientationPackage) {
    throw "expo-screen-orientation is not present in package.json."
}

Write-Host "[PASS] Project root:" -ForegroundColor Green
Write-Host "       $projectRoot"

Write-Host "[PASS] expo-screen-orientation installed" -ForegroundColor Green

# ==================================================
# 2. BACKUP ONLY LIVE FILES
# ==================================================

$stamp =
    Get-Date -Format "yyyyMMdd_HHmmss"

$backupDir =
    Join-Path `
        $projectRoot `
        "native_backups\STEP2B2_ORIENTATION_$stamp"

New-Item `
    -ItemType Directory `
    -Path $backupDir `
    -Force |
    Out-Null

Copy-Item `
    -LiteralPath $appFile `
    -Destination (
        Join-Path $backupDir "app.config.js"
    ) `
    -Force

Copy-Item `
    -LiteralPath $layoutFile `
    -Destination (
        Join-Path $backupDir "_layout.tsx"
    ) `
    -Force

Write-Host "[PASS] Safety backup created" -ForegroundColor Green
Write-Host "       $backupDir"

# ==================================================
# 3. APP.CONFIG.JS
#    portrait -> default
# ==================================================

$app =
    [System.IO.File]::ReadAllText(
        $appFile
    )

$orientationPattern =
    "(?m)^(\s*)orientation\s*:\s*['""](portrait|landscape|default)['""]\s*,?"

$orientationMatches =
    [regex]::Matches(
        $app,
        $orientationPattern
    )

if ($orientationMatches.Count -ne 1) {
    throw "Expected exactly one app.config orientation property. Found $($orientationMatches.Count)."
}

$oldOrientation =
    $orientationMatches[0].Groups[2].Value

$app =
    [regex]::Replace(
        $app,
        $orientationPattern,
        {
            param($m)

            return (
                $m.Groups[1].Value +
                "orientation: 'default',"
            )
        },
        1
    )

Write-Host "[FIX] app.config orientation: $oldOrientation -> default" -ForegroundColor Green

# ==================================================
# 4. ADD SCREEN ORIENTATION CONFIG PLUGIN
#    ONLY IF MISSING
# ==================================================

if (
    $app -notmatch
    "['""]expo-screen-orientation['""]"
) {

    $routerPattern =
        "(?m)^(\s*)['""]expo-router['""]\s*,"

    $routerMatches =
        [regex]::Matches(
            $app,
            $routerPattern
        )

    if ($routerMatches.Count -ne 1) {
        throw "Could not uniquely locate expo-router plugin. Found $($routerMatches.Count)."
    }

    $app =
        [regex]::Replace(
            $app,
            $routerPattern,
            {
                param($m)

                $indent =
                    $m.Groups[1].Value

                return (
                    $m.Value +
                    "`r`n" +
                    $indent +
                    "[" +
                    "`r`n" +
                    $indent +
                    "  'expo-screen-orientation'," +
                    "`r`n" +
                    $indent +
                    "  {" +
                    "`r`n" +
                    $indent +
                    "    initialOrientation: 'DEFAULT'," +
                    "`r`n" +
                    $indent +
                    "  }," +
                    "`r`n" +
                    $indent +
                    "],"
                )
            },
            1
        )

    Write-Host "[FIX] expo-screen-orientation config plugin added" -ForegroundColor Green
}
else {

    Write-Host "[PASS] expo-screen-orientation plugin already present" -ForegroundColor Green
}

# ==================================================
# 5. WRITE APP.CONFIG USING ABSOLUTE PATH
# ==================================================

[System.IO.File]::WriteAllText(
    $appFile,
    $app,
    [System.Text.UTF8Encoding]::new($false)
)

# ==================================================
# 6. REMOVE ONLY ROOT GLOBAL PORTRAIT LOCK
#    Do NOT touch intentional screen-specific locks.
# ==================================================

$layout =
    [System.IO.File]::ReadAllText(
        $layoutFile
    )

$rootPattern =
    "screenOptions\s*=\s*\{\{\s*headerShown\s*:\s*false\s*,\s*orientation\s*:\s*['""]portrait['""]\s*\}\}"

$rootMatches =
    [regex]::Matches(
        $layout,
        $rootPattern
    )

if ($rootMatches.Count -gt 1) {
    throw "Multiple root portrait screenOptions detected. Stopping safely."
}

if ($rootMatches.Count -eq 1) {

    $layout =
        [regex]::Replace(
            $layout,
            $rootPattern,
            "screenOptions={{ headerShown: false }}",
            1
        )

    Write-Host "[FIX] Removed global root portrait lock" -ForegroundColor Green
}

if ($rootMatches.Count -eq 0) {

    Write-Host "[INFO] Exact old root portrait pattern not present." -ForegroundColor Yellow
    Write-Host "[INFO] Will verify root layout below." -ForegroundColor Yellow
}

[System.IO.File]::WriteAllText(
    $layoutFile,
    $layout,
    [System.Text.UTF8Encoding]::new($false)
)

# ==================================================
# 7. READ BACK FROM DISK
# ==================================================

$appVerify =
    [System.IO.File]::ReadAllText(
        $appFile
    )

$layoutVerify =
    [System.IO.File]::ReadAllText(
        $layoutFile
    )

if (
    $appVerify -notmatch
    "(?m)^\s*orientation\s*:\s*['""]default['""]"
) {
    throw "app.config.js still does not contain orientation:'default'."
}

Write-Host "[PASS] DISK app.config orientation = default" -ForegroundColor Green

if (
    $appVerify -notmatch
    "['""]expo-screen-orientation['""]"
) {
    throw "expo-screen-orientation plugin missing after repair."
}

Write-Host "[PASS] DISK orientation plugin present" -ForegroundColor Green

if (
    $layoutVerify -match
    "screenOptions\s*=\s*\{\{[^}]*orientation\s*:\s*['""]portrait['""]"
) {
    throw "Root Stack is still globally locked to portrait."
}

Write-Host "[PASS] Root Stack has no global portrait lock" -ForegroundColor Green

# ==================================================
# 8. SHOW OTHER PORTRAIT LOCKS
#    INFORMATION ONLY
# ==================================================

$remaining =
    @(
        Get-ChildItem `
            -LiteralPath (
                Join-Path $projectRoot "src"
            ) `
            -Recurse `
            -File `
            -Include *.ts,*.tsx `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch
                "before-|backup|native_backups"
        } |
        Select-String `
            -Pattern `
            "orientation\s*:\s*['""]portrait['""]"
    )

Write-Host ""

if ($remaining.Count -gt 0) {

    Write-Host "[INFO] Screen-specific portrait settings found:" -ForegroundColor Yellow

    foreach ($item in $remaining) {

        $relative =
            $item.Path.Replace(
                $projectRoot + "\",
                ""
            )

        Write-Host (
            "       " +
            $relative +
            ":" +
            $item.LineNumber +
            "  " +
            $item.Line.Trim()
        )
    }

    Write-Host "[INFO] These are NOT automatically removed." -ForegroundColor Yellow
}

if ($remaining.Count -eq 0) {
    Write-Host "[PASS] No additional live portrait locks detected" -ForegroundColor Green
}

# ==================================================
# 9. RESOLVE REAL STAGING EXPO CONFIG
# ==================================================

$env:APP_VARIANT =
    "staging"

$env:EXPO_PUBLIC_APP_ENV =
    "staging"

Write-Host ""
Write-Host "Resolving staging Expo config..." -ForegroundColor Cyan

$configRaw =
    npx expo config --type public --json

if ($LASTEXITCODE -ne 0) {
    throw "npx expo config failed."
}

$config =
    $configRaw |
    ConvertFrom-Json

Write-Host "Resolved orientation :" $config.orientation
Write-Host "Resolved package     :" $config.android.package
Write-Host "Resolved version     :" $config.version

if ($config.orientation -ne "default") {
    throw "Resolved Expo orientation is '$($config.orientation)', expected 'default'."
}

if (
    $config.android.package -ne
    "org.mzbministry.buklod.staging"
) {
    throw "Unexpected Android package: $($config.android.package)"
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " STEP 2B-2 PASS" -ForegroundColor Green
Write-Host " GLOBAL ORIENTATION = DEFAULT / UNLOCKED" -ForegroundColor Green
Write-Host " ROOT STACK PORTRAIT LOCK = REMOVED" -ForegroundColor Green
Write-Host " PER-SCREEN ORIENTATION = AVAILABLE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
