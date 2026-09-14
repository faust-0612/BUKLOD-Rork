Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Dist = Join-Path $Root 'dist-report-production'
$ExpectedProjectId = 'cc69b3c0-a5df-4b69-a84c-887c36242fdd'

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host ('=' * 80) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('=' * 80) -ForegroundColor DarkCyan
}

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
    Write-Step $Label
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE." }
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
    if ($ExplicitSource -and (Test-Path -LiteralPath $ExplicitSource)) { $Roots.Add((Resolve-Path -LiteralPath $ExplicitSource).Path) }
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
    throw "Missing $Name. Put it in the current process or a local .env file."
}

function Remove-StaleDist {
    if (Test-Path -LiteralPath $Dist) { Remove-Item -LiteralPath $Dist -Recurse -Force }
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
        throw 'Tracked source drift detected. Production promotion refused.'
    }
    Write-Host 'PASS: tracked source matches the checked-out checkpoint.' -ForegroundColor Green
}

function Assert-FreshExport([datetime]$ExportStartedUtc) {
    $Index = Join-Path $Dist 'index.html'
    if (-not (Test-Path -LiteralPath $Index)) { throw 'Fresh export is missing index.html.' }
    $IndexItem = Get-Item -LiteralPath $Index
    if ($IndexItem.LastWriteTimeUtc -lt $ExportStartedUtc.AddSeconds(-5)) { throw 'index.html is older than this export run; stale export refused.' }
    $Files = @(Get-ChildItem -LiteralPath $Dist -File -Recurse)
    if ($Files.Count -lt 10) { throw "Fresh export contains only $($Files.Count) files; refusing a likely partial/stale deployment." }
    $Bundles = @(Get-ChildItem -LiteralPath $Dist -File -Recurse -Filter '*.js' | Where-Object { $_.FullName -match '[\\/]_expo[\\/]static[\\/]js[\\/]web[\\/]' })
    if ($Bundles.Count -lt 1) { throw 'Fresh export has no Expo web JavaScript bundle.' }
    if (($Bundles | Measure-Object -Property Length -Sum).Sum -lt 100000) { throw 'Expo web JavaScript bundle is unexpectedly small; refusing deployment.' }
    Write-Host "PASS: fresh production export validated ($($Files.Count) files)." -ForegroundColor Green
}

Set-Location -LiteralPath $Root
Write-Step 'BUKLOD REPORT WEB PRODUCTION - FAIL-FAST PROMOTION'
Write-Host "Project: $Root"
Write-Host 'Target: original production hostname https://buklod-report-mzb.expo.app'
Write-Host 'Rule: failed preflight/typecheck/export can NEVER continue to production deployment.'
Remove-StaleDist

try {
    $Git = (Get-Command git.exe -ErrorAction SilentlyContinue)
    if (-not $Git) { $Git = Get-Command git -ErrorAction Stop }
    $GitPath = $Git.Source
    Assert-CleanTrackedSource -GitPath $GitPath

    Ensure-PublicEnv 'EXPO_PUBLIC_SUPABASE_URL'
    Ensure-PublicEnv 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'

    $env:APP_VARIANT = 'production'
    $env:EXPO_PUBLIC_APP_ENV = 'production'
    $env:BUKLOD_APP_TARGET = 'report'
    $env:REPORT_RELEASE_TARGET = 'web'
    $env:REPORT_EAS_PROJECT_ID = $ExpectedProjectId
    $env:EXPO_PUBLIC_REPORT_ADSENSE_ENABLED = 'false'
    $env:EXPO_PUBLIC_REPORT_ADSENSE_CLIENT = ''
    $env:EXPO_PUBLIC_REPORT_ADSENSE_SLOT = ''
    Remove-Item Env:REPORT_PREFLIGHT_SOURCE_ONLY -ErrorAction SilentlyContinue

    Write-Host 'PASS: required public Supabase environment loaded (values hidden).' -ForegroundColor Green
    $Node = (Get-Command node -ErrorAction Stop).Source
    $Npx = (Get-Command npx.cmd -ErrorAction Stop).Source

    Invoke-Checked 'MANAGEMENT PREFLIGHT' { & $Node 'scripts/report-management-preflight.mjs' }
    Invoke-Checked 'REPORT WEB PREFLIGHT' { & $Node 'scripts/report-web-preflight.mjs' }
    Invoke-Checked 'REPORT TYPESCRIPT' { & $Npx 'tsc' '-p' 'tsconfig.report.json' '--noEmit' }

    Write-Step 'FRESH REPORT PRODUCTION WEB EXPORT'
    $ExportStartedUtc = [datetime]::UtcNow
    & $Npx 'expo' 'export' '--platform' 'web' '--output-dir' 'dist-report-production'
    if ($LASTEXITCODE -ne 0) {
        Remove-StaleDist
        throw "Expo web export failed with exit code $LASTEXITCODE. Partial dist removed."
    }
    Assert-FreshExport -ExportStartedUtc $ExportStartedUtc

    $HeadBeforeDeploy = (& $GitPath 'rev-parse' 'HEAD').Trim()
    if (-not $HeadBeforeDeploy) { throw 'Could not resolve Git HEAD.' }

    Write-Step 'DEPLOY FRESH EXPORT TO ORIGINAL PRODUCTION HOSTNAME'
    & $Npx 'eas-cli@latest' 'deploy' '--export-dir' 'dist-report-production' '--prod' '--non-interactive'
    if ($LASTEXITCODE -ne 0) { throw "EAS production deploy failed with exit code $LASTEXITCODE." }

    $HeadAfterDeploy = (& $GitPath 'rev-parse' 'HEAD').Trim()
    if ($HeadAfterDeploy -ne $HeadBeforeDeploy) { throw "Git HEAD changed during production release ($HeadBeforeDeploy -> $HeadAfterDeploy)." }

    Write-Step 'PRODUCTION RELEASE CHECKPOINT'
    Write-Host "HEAD: $HeadAfterDeploy" -ForegroundColor Green
    Write-Host 'WEB:  https://buklod-report-mzb.expo.app' -ForegroundColor Green
    Write-Host 'PASS: only a fresh, validated production export was deployed.' -ForegroundColor Green
}
catch {
    Remove-StaleDist
    Write-Host ''
    Write-Host "STOPPED SAFELY: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No stale/partial production dist remains available for accidental deployment.' -ForegroundColor Yellow
    exit 1
}
