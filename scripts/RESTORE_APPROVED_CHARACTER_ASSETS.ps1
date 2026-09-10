$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $repoRoot '..\..')).Path
$source = Join-Path $workspaceRoot 'RECOVERY\R31_R40_APPROVED\recovery-import\r31-r40\assets\images\characters'
$target = Join-Path $repoRoot 'assets\images\characters'

$names = @('phan_r26.jpg','quin_r26.jpg','van_r26.jpg','christian_r26.jpg','lhen_r26.jpg')

if (-not (Test-Path $source)) {
  throw "Approved R31/R40 character source not found: $source"
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach ($name in $names) {
  $src = Join-Path $source $name
  $dst = Join-Path $target $name
  if (-not (Test-Path $src)) { throw "Missing approved asset: $src" }
  Copy-Item $src $dst -Force
  if (-not (Test-Path $dst)) { throw "Restore failed: $dst" }
  Write-Host "RESTORED $name"
}

Write-Host ''
Write-Host 'Five approved Basic Character sprite sheets are present.'
Write-Host 'Commit these files on the integration branch so they cannot disappear again.'
