Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Dist = Join-Path $Root 'dist-main-web-recovery'
$MainProjectId = '23dad7d0-389a-406e-8dec-08965dab85d8'
$ExpectedSupabaseUrl = 'https://yhanxndaqbmuzbdqlblu.supabase.co'
$ExpectedProductionUrl = 'https://buklod.expo.app'

function Step([string]$Text) {
    Write-Host ''
    Write-Host ('=' * 76) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('=' * 76) -ForegroundColor DarkCyan
}

function Run([string]$Label, [scriptblock]$Command) {
    Step $Label
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Load-DotEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing environment file: $Path"
    }

    foreach ($RawLine in Get-Content -LiteralPath $Path) {
        $Line = $RawLine.Trim()
        if (-not $Line -or $Line.StartsWith('#')) { continue }
        if ($Line.StartsWith('export ')) { $Line = $Line.Substring(7).Trim() }

        $Match = [regex]::Match($Line, '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$')
        if (-not $Match.Success) { continue }

        $Name = $Match.Groups[1].Value
        $Value = $Match.Groups[2].Value.Trim()

        if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
            ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
            if ($Value.Length -ge 2) {
                $Value = $Value.Substring(1, $Value.Length - 2)
            }
        }

        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
}

Set-Location -LiteralPath $Root

Step 'BUKLOD MAIN — WEB-ONLY WHITE-SCREEN RECOVERY'
Write-Host "Target: $ExpectedProductionUrl"
Write-Host 'Android OTA: FORBIDDEN'
Write-Host 'EAS Build / APK / AAB: FORBIDDEN'
Write-Host 'Scope: production web export + production web deploy only'

if (Test-Path -LiteralPath $Dist) {
    Remove-Item -LiteralPath $Dist -Recurse -Force
}

try {
    $Git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $Git) { $Git = Get-Command git -ErrorAction Stop }
    $Npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $Npx) { $Npx = Get-Command npx -ErrorAction Stop }

    Step 'VERIFY CURRENT MAIN'
    & $Git.Source fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not refresh origin/main.' }
    $Head = (& $Git.Source rev-parse HEAD).Trim()
    $Remote = (& $Git.Source rev-parse origin/main).Trim()
    if ($Head -ne $Remote) {
        throw "Checkout is not current origin/main. HEAD=$Head origin/main=$Remote"
    }
    Write-Host "PASS: current main $Head" -ForegroundColor Green

    Run 'VERIFY EXPO AUTHENTICATION' {
        & $Npx.Source 'eas-cli@latest' 'whoami' '--non-interactive'
    }

    Step 'PULL EAS PRODUCTION ENVIRONMENT'
    $EnvFile = Join-Path $Root '.env.local'
    if (Test-Path -LiteralPath $EnvFile) { Remove-Item -LiteralPath $EnvFile -Force }
    & $Npx.Source 'eas-cli@latest' 'env:pull' '--environment' 'production' '--path' '.env.local' '--non-interactive'
    if ($LASTEXITCODE -ne 0) { throw 'Could not pull EAS production environment.' }
    Load-DotEnv -Path $EnvFile

    $SupabaseUrl = [Environment]::GetEnvironmentVariable('EXPO_PUBLIC_SUPABASE_URL', 'Process')
    $SupabaseKey = [Environment]::GetEnvironmentVariable('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'Process')
    if (-not $SupabaseUrl -or -not $SupabaseKey) {
        throw 'Production Supabase public environment is incomplete.'
    }
    if ($SupabaseUrl -ne $ExpectedSupabaseUrl) {
        throw 'STOP: production Supabase URL does not match protected BUKLOD Main.'
    }
    Write-Host 'PASS: protected BUKLOD Main Supabase environment loaded.' -ForegroundColor Green

    $env:APP_VARIANT = 'production'
    $env:EXPO_PUBLIC_APP_ENV = 'production'
    $env:BUKLOD_APP_TARGET = 'main'
    $env:EAS_PROJECT_ID = $MainProjectId
    $env:EXPO_PUBLIC_EAS_PROJECT_ID = $MainProjectId
    $env:NODE_ENV = 'production'

    Step 'VERIFY MAIN PROJECT ID'
    $ConfigJson = & $Npx.Source 'expo' 'config' '--type' 'public' '--json'
    if ($LASTEXITCODE -ne 0) { throw 'Expo config resolution failed.' }
    $Config = $ConfigJson | ConvertFrom-Json
    $ResolvedProjectId = [string]$Config.extra.eas.projectId
    if ($ResolvedProjectId -ne $MainProjectId) {
        throw "Wrong EAS project. Expected $MainProjectId, got $ResolvedProjectId"
    }
    Write-Host "PASS: Main EAS project $ResolvedProjectId" -ForegroundColor Green

    Run 'TYPESCRIPT QA' {
        & $Npx.Source 'tsc' '--noEmit'
    }

    Step 'FRESH PRODUCTION WEB EXPORT'
    & $Npx.Source 'expo' 'export' '--platform' 'web' '--output-dir' 'dist-main-web-recovery'
    if ($LASTEXITCODE -ne 0) {
        throw 'Expo web export failed.'
    }

    $Index = Join-Path $Dist 'index.html'
    if (-not (Test-Path -LiteralPath $Index)) {
        throw 'Fresh web export is missing index.html.'
    }

    $Bundles = @(Get-ChildItem -LiteralPath $Dist -File -Recurse -Filter '*.js')
    if ($Bundles.Count -lt 1) {
        throw 'Fresh web export has no JavaScript bundle.'
    }

    $SupabaseHost = ([Uri]$ExpectedSupabaseUrl).Host
    $HostEmbedded = $false
    foreach ($Bundle in $Bundles) {
        if (Select-String -LiteralPath $Bundle.FullName -SimpleMatch $SupabaseHost -Quiet) {
            $HostEmbedded = $true
            break
        }
    }
    if (-not $HostEmbedded) {
        throw 'STOP: production Supabase host is not embedded in the browser bundle.'
    }
    Write-Host 'PASS: production Supabase runtime config is embedded in web bundle.' -ForegroundColor Green

    Run 'DEPLOY MAIN WEB TO PRODUCTION' {
        & $Npx.Source 'eas-cli@latest' 'deploy' '--export-dir' 'dist-main-web-recovery' '--prod' '--environment' 'production' '--non-interactive'
    }

    Step 'WEB-ONLY RECOVERY COMPLETE'
    Write-Host "WEB: $ExpectedProductionUrl" -ForegroundColor Green
    Write-Host 'Android OTA: NOT RUN' -ForegroundColor Green
    Write-Host 'EAS Build/APK/AAB: NOT RUN' -ForegroundColor Green
    Write-Host 'Refresh the browser with Ctrl+F5 and verify login/home.'
}
catch {
    Write-Host ''
    Write-Host "STOPPED SAFELY: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No Android OTA or native build was triggered.' -ForegroundColor Yellow
    exit 1
}
finally {
    if (Test-Path -LiteralPath $Dist) {
        Write-Host "Recovery export kept at: $Dist" -ForegroundColor DarkGray
    }
}
