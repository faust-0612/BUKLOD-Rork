$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$path = Join-Path $repoRoot 'src\app\(tabs)\buklod.tsx'
if (-not (Test-Path $path)) { throw "Community screen not found: $path" }

$content = Get-Content $path -Raw
$before = $content
$content = $content.Replace("'/reels' as any", "'/igpat' as any")
$content = $content.Replace('BUKLOD REELS', 'BUKLOD IGPAT')

if ($content -ne $before) {
  Set-Content $path $content -Encoding utf8
  Write-Host 'UPDATED Community video entry -> BUKLOD IGPAT /igpat'
} else {
  Write-Host 'Community IGPAT entry already canonical.'
}

$check = Get-Content $path -Raw
if ($check.Contains('BUKLOD REELS')) { throw 'A user-facing BUKLOD REELS label remains in buklod.tsx' }
if ($check.Contains("router.push('/reels' as any")) { throw 'A Community /reels navigation remains in buklod.tsx' }
