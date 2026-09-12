# IGPAT_MANUAL_TS_QA_R15
$ErrorActionPreference = 'Stop'
node scripts/fix-igpat-community-ts-r15.cjs
if ($LASTEXITCODE -ne 0) { throw 'IGPAT publish cleanup patch failed.' }
node scripts/fix-igpat-r15-catch-types.cjs
if ($LASTEXITCODE -ne 0) { throw 'IGPAT strict catch typing patch failed.' }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript QA failed after IGPAT cleanup.' }
if (Test-Path 'dist-igpat-qa-r15') { Remove-Item 'dist-igpat-qa-r15' -Recurse -Force }
npx expo export --platform web --clear --output-dir dist-igpat-qa-r15
if ($LASTEXITCODE -ne 0) { throw 'Expo web export failed after IGPAT cleanup.' }
if (-not (Test-Path 'dist-igpat-qa-r15/index.html')) { throw 'Expo export completed without index.html.' }
Write-Host 'IGPAT R15 MANUAL QA: PASS' -ForegroundColor Green
