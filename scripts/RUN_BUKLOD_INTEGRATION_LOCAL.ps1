$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

Write-Host '=== BUKLOD R42 LOCAL INTEGRATION ==='
Write-Host '1/4 Restore approved 5 Basic Character assets'
& (Join-Path $PSScriptRoot 'RESTORE_APPROVED_CHARACTER_ASSETS.ps1')

Write-Host '2/4 Enforce Community -> BUKLOD IGPAT'
& (Join-Path $PSScriptRoot 'ENSURE_IGPAT_COMMUNITY_ENTRY.ps1')

Write-Host '3/4 TypeScript gate'
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript gate failed.' }

Write-Host '4/4 Starting clean Expo web localhost'
Write-Host 'Verify: /igpat  /igpat/create  /igpat/arena  and Profile -> Customize'
npx expo start --web -c
