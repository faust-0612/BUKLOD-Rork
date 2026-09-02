$ErrorActionPreference = "Stop"

$projectRoot = (Get-Location).Path
[Environment]::CurrentDirectory = $projectRoot

$appFile = Join-Path $projectRoot "app.config.js"
$layoutFile = Join-Path $projectRoot "src\app\_layout.tsx"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " FINAL-C - GLOBAL ORIENTATION REPAIR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $appFile)) {
    throw "app.config.js missing."
}

$app = [System.IO.File]::ReadAllText($appFile)

$pattern = "(?m)^(\s*)orientation\s*:\s*(['""])portrait\2(\s*,?\s*)$"
$matches = [regex]::Matches($app, $pattern)

if ($matches.Count -eq 0) {
    Write-Host ""
    Write-Host "No literal orientation:'portrait' line found." -ForegroundColor Yellow
    Write-Host "Relevant source matches:" -ForegroundColor Yellow

    Select-String `
        -LiteralPath $appFile `
        -Pattern "orientation","portrait","expo-screen-orientation" `
        -Context 3,6

    throw "Resolved config is portrait, but source is not a simple literal. No blind patch applied."
}

if ($matches.Count -gt 1) {
    Write-Host ""
    Write-Host "Multiple literal portrait orientation properties found:" -ForegroundColor Red

    Select-String `
        -LiteralPath $appFile `
        -Pattern "orientation\s*:\s*['""]portrait['""]" `
        -Context 2,4

    throw "Multiple portrait orientation properties found. No blind patch applied."
}

$match = $matches[0]

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $projectRoot "native_backups\FINAL_C_ORIENTATION_$stamp"

New-Item `
    -ItemType Directory `
    -Path $backupDir `
    -Force |
Out-Null

Copy-Item `
    -LiteralPath $appFile `
    -Destination (Join-Path $backupDir "app.config.js") `
    -Force

Write-Host "[PASS] Backup created" -ForegroundColor Green
Write-Host "       $backupDir"

$replacement =
    $match.Groups[1].Value +
    "orientation: " +
    $match.Groups[2].Value +
    "default" +
    $match.Groups[2].Value +
    $match.Groups[3].Value

$app =
    $app.Remove($match.Index, $match.Length).
        Insert($match.Index, $replacement)

[System.IO.File]::WriteAllText(
    $appFile,
    $app,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[FIX] app.config.js global orientation changed portrait -> default" -ForegroundColor Green

# Source read-back
$verify = [System.IO.File]::ReadAllText($appFile)

if (
    $verify -notmatch
    "(?m)^\s*orientation\s*:\s*['""]default['""]"
) {
    throw "Source read-back failed: orientation default not found."
}

Write-Host "[PASS] Source orientation = default" -ForegroundColor Green

# Root layout must not re-lock portrait.
if (Test-Path -LiteralPath $layoutFile) {
    $layout = [System.IO.File]::ReadAllText($layoutFile)

    if (
        $layout -match
        "orientation\s*[:=]\s*['""]portrait['""]"
    ) {
        throw "Root _layout.tsx still contains a portrait orientation lock."
    }

    Write-Host "[PASS] Root layout has no portrait lock" -ForegroundColor Green
}
else {
    throw "src\app\_layout.tsx missing."
}

# Resolve actual staging config.
$env:APP_VARIANT = "staging"
$env:EXPO_PUBLIC_APP_ENV = "staging"

Write-Host ""
Write-Host "Resolving staging Expo config..." -ForegroundColor Cyan

$configRaw = npx expo config --type public --json

if ($LASTEXITCODE -ne 0) {
    throw "Expo config resolution failed."
}

$config = $configRaw | ConvertFrom-Json

if ($config.android.package -ne "org.mzbministry.buklod.staging") {
    throw "Unexpected Android package: $($config.android.package)"
}

if ($config.orientation -ne "default") {
    throw "Resolved orientation is still: $($config.orientation)"
}

Write-Host "[PASS] Resolved staging orientation = default" -ForegroundColor Green
Write-Host "[PASS] Staging package preserved" -ForegroundColor Green

# Verify expo-screen-orientation remains DEFAULT when present.
$screenEntry = $null

foreach ($plugin in @($config.plugins)) {
    if ($plugin -isnot [string]) {
        $parts = @($plugin)

        if (
            $parts.Count -gt 0 -and
            [string]$parts[0] -eq "expo-screen-orientation"
        ) {
            $screenEntry = $parts
            break
        }
    }
}

if ($null -eq $screenEntry) {
    throw "expo-screen-orientation config plugin missing."
}

$options = $screenEntry[1]

if ([string]$options.initialOrientation -ne "DEFAULT") {
    throw "expo-screen-orientation initialOrientation is not DEFAULT."
}

Write-Host "[PASS] expo-screen-orientation initialOrientation = DEFAULT" -ForegroundColor Green

Write-Host ""
Write-Host "Running TypeScript..." -ForegroundColor Cyan

npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    throw "TypeScript failed."
}

Write-Host "[PASS] TypeScript clean" -ForegroundColor Green

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host " FINAL-C PASS" -ForegroundColor Green
Write-Host " GLOBAL ORIENTATION = DEFAULT" -ForegroundColor Green
Write-Host " ROOT PORTRAIT LOCK = ABSENT" -ForegroundColor Green
Write-Host " STAGING CONFIG = RESOLVED" -ForegroundColor Green
Write-Host " TYPESCRIPT = CLEAN" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: rerun FINAL-B closing audit." -ForegroundColor Yellow
