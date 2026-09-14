Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Dist = Join-Path $Root 'dist-main-report-door'
$MainProjectId = '23dad7d0-389a-406e-8dec-08965dab85d8'
$ReportProductionUrl = 'https://buklod-report-mzb.expo.app'
$ExpectedMainProductionUrl = 'https://buklod.expo.app'

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host ('=' * 80) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('=' * 80) -ForegroundColor DarkCyan
}

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
    Write-Step $Label
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Read-DotEnvValue([string]$File, [string]$Name) {
    if (-not (Test-Path -LiteralPath $File)) { return '' }
    foreach ($RawLine in @(Get-Content -LiteralPath $File)) {
        $Line = $RawLine.Trim()
        if (-not $Line -or $Line.StartsWith('#')) { continue }
        if ($Line.StartsWith('export ')) { $Line = $Line.Substring(7).Trim() }
        $Match = [regex]::Match($Line, '^' + [regex]::Escape($Name) + '\s*=\s*(.*)$')
        if (-not $Match.Success) { continue }
        $Value = $Match.Groups[1].Value.Trim()
        if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
            if ($Value.Length -ge 2) { $Value = $Value.Substring(1, $Value.Length - 2) }
        } else {
            $Value = ($Value -split '\s+#', 2)[0].Trim()
        }
        return $Value
    }
    return ''
}

function Get-EnvCandidates {
    $Roots = New-Object System.Collections.Generic.List[string]
    $Roots.Add($Root)

    $ExplicitSource = [Environment]::GetEnvironmentVariable('BUKLOD_SOURCE_ROOT', 'Process')
    if ($ExplicitSource -and (Test-Path -LiteralPath $ExplicitSource)) {
        $Roots.Add((Resolve-Path -LiteralPath $ExplicitSource).Path)
    }

    $Parent = Split-Path -Parent $Root
    if (Test-Path -LiteralPath $Parent) {
        Get-ChildItem -LiteralPath $Parent -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'BUKLOD-Rork-current-*' } |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object { $Roots.Add($_.FullName) }
    }

    $Seen = @{}
    foreach ($CandidateRoot in @($Roots)) {
        if ($Seen.ContainsKey($CandidateRoot)) { continue }
        $Seen[$CandidateRoot] = $true
        foreach ($Name in @('.env.local', '.env.production.local', '.env')) {
            $Path = Join-Path $CandidateRoot $Name
            if (Test-Path -LiteralPath $Path) { $Path }
        }
    }
}

function Ensure-PublicEnv([string]$Name) {
    $Existing = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($Existing) { return }
    foreach ($File in @(Get-EnvCandidates)) {
        $Value = Read-DotEnvValue -File $File -Name $Name
        if ($Value) {
            [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
            return
        }
    }
    throw "Missing $Name. Put the production public value in the current process or a local .env file."
}

function Remove-StaleDist {
    if (Test-Path -LiteralPath $Dist) {
        Remove-Item -LiteralPath $Dist -Recurse -Force
    }
}

function Assert-CleanTrackedSource([string]$GitPath) {
    Write-Step 'TRACKED SOURCE DRIFT CHECK'
    $Changed = @(& $GitPath 'diff' '--name-only' '--') | Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect tracked source drift.' }
    $Staged = @(& $GitPath 'diff' '--cached' '--name-only' '--') | Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged source drift.' }
    $AllChanged = @($Changed + $Staged | Sort-Object -Unique)
    if ($AllChanged.Count -gt 0) {
        Write-Host 'Tracked files differ from the checked-out checkpoint:' -ForegroundColor Yellow
        foreach ($Path in $AllChanged) { Write-Host "  - $Path" -ForegroundColor Yellow }
        throw 'Tracked source drift detected. Release refused.'
    }
    Write-Host 'PASS: tracked source matches the checked-out checkpoint.' -ForegroundColor Green
}

function Assert-CurrentMain([string]$GitPath) {
    Write-Step 'CURRENT MAIN CHECKPOINT'
    & $GitPath 'fetch' 'origin' 'main'
    if ($LASTEXITCODE -ne 0) { throw 'Could not refresh origin/main.' }
    $Head = (& $GitPath 'rev-parse' 'HEAD').Trim()
    $Remote = (& $GitPath 'rev-parse' 'origin/main').Trim()
    if (-not $Head -or -not $Remote) { throw 'Could not resolve Main Git checkpoints.' }
    if ($Head -ne $Remote) {
        throw "Release checkout is not current origin/main. HEAD=$Head origin/main=$Remote"
    }
    Write-Host "PASS: current Main checkpoint $Head" -ForegroundColor Green
}

function Assert-FreshExport([datetime]$ExportStartedUtc) {
    $Index = Join-Path $Dist 'index.html'
    if (-not (Test-Path -LiteralPath $Index)) { throw 'Fresh Main export is missing index.html.' }
    if ((Get-Item -LiteralPath $Index).LastWriteTimeUtc -lt $ExportStartedUtc.AddSeconds(-5)) {
        throw 'Main index.html is older than this export run; stale export refused.'
    }
    $Files = @(Get-ChildItem -LiteralPath $Dist -File -Recurse)
    if ($Files.Count -lt 10) { throw "Main export contains only $($Files.Count) files; partial/stale deployment refused." }
    $Bundles = @(Get-ChildItem -LiteralPath $Dist -File -Recurse -Filter '*.js')
    if ($Bundles.Count -lt 1) { throw 'Main export has no JavaScript bundle.' }
    if (($Bundles | Measure-Object -Property Length -Sum).Sum -lt 100000) {
        throw 'Main JavaScript output is unexpectedly small; deployment refused.'
    }
    Write-Host "PASS: fresh Main export validated ($($Files.Count) files)." -ForegroundColor Green
}

Set-Location -LiteralPath $Root
Write-Step 'BUKLOD MAIN REPORT DOOR - SAFE WEB + OTA RELEASE'
Write-Host "Project: $Root"
Write-Host "Report target: $ReportProductionUrl"
Write-Host 'Native build: FORBIDDEN / NOT REQUIRED'
Write-Host 'Rule: any failed gate stops before the next release surface.'

Remove-StaleDist

try {
    $Git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $Git) { $Git = Get-Command git -ErrorAction Stop }
    $GitPath = $Git.Source
    $Node = (Get-Command node -ErrorAction Stop).Source
    $Npx = (Get-Command npx.cmd -ErrorAction Stop).Source

    Assert-CleanTrackedSource -GitPath $GitPath
    Assert-CurrentMain -GitPath $GitPath

    Ensure-PublicEnv 'EXPO_PUBLIC_SUPABASE_URL'
    Ensure-PublicEnv 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'

    $env:APP_VARIANT = 'production'
    $env:EXPO_PUBLIC_APP_ENV = 'production'
    $env:BUKLOD_APP_TARGET = 'main'
    $env:EAS_PROJECT_ID = $MainProjectId
    $env:EXPO_PUBLIC_EAS_PROJECT_ID = $MainProjectId
    $env:EXPO_PUBLIC_BUKLOD_REPORT_WEB_URL = $ReportProductionUrl

    Write-Host 'PASS: Main production identity + Report production URL locked for local web export.' -ForegroundColor Green

    Invoke-Checked 'REPORT DOOR PREFLIGHT' { & $Node 'scripts/report-main-door-preflight.mjs' }

    Write-Step 'MAIN PROJECT ID CHECK'
    $ConfigJson = & $Npx 'expo' 'config' '--type' 'public' '--json'
    if ($LASTEXITCODE -ne 0) { throw 'Expo config resolution failed.' }
    $Config = $ConfigJson | ConvertFrom-Json
    $ResolvedProjectId = [string]$Config.extra.eas.projectId
    if ($ResolvedProjectId -ne $MainProjectId) {
        throw "Wrong EAS project resolved. Expected $MainProjectId, got $ResolvedProjectId"
    }
    if ([string]$Config.runtimeVersion -ne '1.3.0') {
        throw "Unexpected Main production runtimeVersion: $($Config.runtimeVersion)"
    }
    Write-Host "PASS: Main EAS project $ResolvedProjectId; runtime 1.3.0." -ForegroundColor Green

    Write-Step 'FRESH MAIN PRODUCTION WEB EXPORT'
    $ExportStartedUtc = [datetime]::UtcNow
    & $Npx 'expo' 'export' '--platform' 'web' '--output-dir' 'dist-main-report-door'
    if ($LASTEXITCODE -ne 0) {
        Remove-StaleDist
        throw "Main Expo web export failed with exit code $LASTEXITCODE. Partial dist removed."
    }
    Assert-FreshExport -ExportStartedUtc $ExportStartedUtc

    $HeadBeforeRelease = (& $GitPath 'rev-parse' 'HEAD').Trim()

    Write-Step 'DEPLOY MAIN WEB TO PRODUCTION'
    & $Npx 'eas-cli@latest' 'deploy' '--export-dir' 'dist-main-report-door' '--prod' '--environment' 'production' '--non-interactive'
    if ($LASTEXITCODE -ne 0) { throw "Main web production deploy failed with exit code $LASTEXITCODE. OTA was NOT attempted." }

    Write-Step 'PUBLISH MAIN PRODUCTION OTA'
    & $Npx 'eas-cli@latest' 'update' '--channel' 'production' '--message' 'Route BUKLOD Report door to standalone production web app' '--environment' 'production' '--non-interactive'
    if ($LASTEXITCODE -ne 0) { throw "Main production OTA failed with exit code $LASTEXITCODE. Web is live; mobile OTA requires retry." }

    $HeadAfterRelease = (& $GitPath 'rev-parse' 'HEAD').Trim()
    if ($HeadAfterRelease -ne $HeadBeforeRelease) {
        throw "Git HEAD changed during release ($HeadBeforeRelease -> $HeadAfterRelease)."
    }

    Write-Step 'MAIN REPORT DOOR RELEASE CHECKPOINT'
    Write-Host "HEAD:   $HeadAfterRelease" -ForegroundColor Green
    Write-Host "MAIN:   $ExpectedMainProductionUrl" -ForegroundColor Green
    Write-Host "REPORT: $ReportProductionUrl" -ForegroundColor Green
    Write-Host 'OTA:    production channel published for runtime 1.3.0' -ForegroundColor Green
    Write-Host 'PASS: no EAS Build/APK/AAB was triggered.' -ForegroundColor Green
    Write-Host 'NEXT: Ctrl+F5 Main web; on Android fully close/reopen up to twice, then test Org/Cluster -> BUKLOD Report.'
}
catch {
    Remove-StaleDist
    Write-Host ''
    Write-Host "STOPPED SAFELY: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No native build was triggered.' -ForegroundColor Yellow
    exit 1
}
