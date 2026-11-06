# BUKLOD one-command encrypted cloud rescue: NO LOCAL PROJECT DELETION.
# Uploads the five existing local recovery artifacts to a private GitHub Release.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function ToolPath([string]$name, [string]$package, [string[]]$paths) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $paths) { if (Test-Path -LiteralPath $p) { return $p } }
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw "Missing $name; install $package manually." }
  Write-Host "Installing $package ..."
  & winget.exe install --id $package --exact --source winget --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Installation failed: $package" }
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $paths) { if (Test-Path -LiteralPath $p) { return $p } }
  throw "$name not found after install. Reopen PowerShell and rerun."
}
function MustSucceed([string]$stage) { if ($LASTEXITCODE -ne 0) { throw "$stage failed (exit $LASTEXITCODE)" } }

$seven = ToolPath '7z.exe' '7zip.7zip' @('C:\Program Files\7-Zip\7z.exe','C:\Program Files (x86)\7-Zip\7z.exe')
$gh = ToolPath 'gh.exe' 'GitHub.cli' @('C:\Program Files\GitHub CLI\gh.exe',"$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe")
$git = (Get-Command git.exe -ErrorAction Stop).Source

$source = Join-Path $env:TEMP 'BUKLOD_MIGRATION_RESCUE'
$names = @('MAIN.bundle','HEADER.bundle','BSOC.bundle','QUICKCHECK.bundle','WALL_CHANGES.patch')
foreach ($n in $names) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $n) -PathType Leaf)) { throw "Required file missing: $n; no upload performed." }
}
$base = Join-Path $env:USERPROFILE 'BUKLOD_WORKSPACE'
$checks = @(
  @{n='MAIN.bundle';p=(Join-Path $base 'SOURCE\BUKLOD-MAIN')},
  @{n='HEADER.bundle';p=(Join-Path $base 'RELEASES\HEADER-BANNER-ONLY')},
  @{n='BSOC.bundle';p=(Join-Path $base 'SOURCE\BUKLOD_BSOC_Standalone')},
  @{n='QUICKCHECK.bundle';p=(Join-Path $base 'SOURCE\BUKLOD-QuickCheck-Web')}
)
foreach ($x in $checks) {
  if (-not (Test-Path -LiteralPath $x.p)) { throw "Source repository missing: $($x.p)" }
  & $git -C $x.p bundle verify (Join-Path $source $x.n) 1>$null 2>$null
  MustSucceed "Bundle check $($x.n)"
}
& $gh auth status --hostname github.com 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Log in using the browser; never paste a GitHub token into chat.'
  & $gh auth login --hostname github.com --web --git-protocol https
  MustSucceed 'GitHub login'
}
$actor = ((& $gh api user --jq '.login') | Out-String).Trim()
MustSucceed 'GitHub login identity check'
if ($actor -ine 'faust-0612') { throw "Wrong GitHub user: $actor; expected faust-0612." }
$repo = 'faust-0612/BUKLOD-Local-Recovery'
& $gh repo view $repo --json isPrivate --jq '.isPrivate' 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --private --add-readme --description 'Encrypted BUKLOD local recovery archive; no deployments'
  MustSucceed 'Private repository creation'
}
$private = ((& $gh repo view $repo --json isPrivate --jq '.isPrivate') | Out-String).Trim()
MustSucceed 'Repository privacy check'
if ($private.ToLowerInvariant() -ne 'true') { throw 'Destination is not PRIVATE. Aborting upload.' }

$tag = 'rescue-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$out = Join-Path $env:TEMP "BUKLOD_CLOUD_$tag"
New-Item -ItemType Directory -Path $out -Force | Out-Null
$file = "BUKLOD_LOCAL_RESCUE_$tag.7z"
$archive = Join-Path $out $file

Write-Host 'An ENCRYPTION password prompt follows. Save the passphrase OUTSIDE this laptop.'
Write-Host 'Do not enter your GitHub password or any existing API secret.'
Push-Location $source
try {
  # '-p' without a value prompts interactively, rather than exposing password in process arguments.
  & $seven a '-t7z' '-mhe=on' '-mx=0' '-p' $archive @names
  MustSucceed 'Encrypted package creation'
} finally { Pop-Location }
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Archive not created.' }

Write-Host 'Re-enter the encryption passphrase to check the archive integrity.'
& $seven t '-p' $archive | Select-Object -Last 5 | Out-Host
MustSucceed 'Encrypted archive self-test'
$sha = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
$notes = "Encrypted historical rescue only; does NOT authorize local deletion. SHA256: $sha"
& $gh release create $tag $archive --repo $repo --title "BUKLOD encrypted recovery $tag" --notes $notes --latest=false
MustSucceed 'Private release upload'
$checkDir = Join-Path $out 'verify'
New-Item -ItemType Directory -Path $checkDir -Force | Out-Null
& $gh release download $tag --repo $repo --dir $checkDir --pattern $file
MustSucceed 'Private release download'
$copy = Join-Path $checkDir $file
if (-not (Test-Path -LiteralPath $copy -PathType Leaf)) { throw 'Remote backup download missing.' }
$remoteSHA = (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash
if ($remoteSHA -ne $sha) { throw 'SHA256 MISMATCH. Stop; do not delete anything.' }
Remove-Item -LiteralPath $copy -Force  # Only redundant downloaded verification copy.
$result = [pscustomobject]@{
  Status='VERIFIED ENCRYPTED CLOUD BACKUP'; Repository=$repo; Release=$tag;
  SHA256=$sha; Included=$names; DeletedProjectFiles=0;
  FullMigrationComplete=$false; SafeToDeleteLocal=$false
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $out 'RESULT.json') -Encoding UTF8
Write-Host ''
Write-Host 'VERIFIED ENCRYPTED CLOUD BACKUP (NOT FULL MIGRATION)' -ForegroundColor Green
Write-Host ("URL: https://github.com/" + $repo + '/releases/tag/' + $tag)
Write-Host "SHA256: $sha"
Write-Host "RESULT: $(Join-Path $out 'RESULT.json')"
Write-Host 'KEEP local files. Other standalone apps/assets and independent restore verification are still pending.'
