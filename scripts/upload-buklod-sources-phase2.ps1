# BUKLOD source snapshot to PRIVATE GitHub Release (phase 2).
# Does not push unreviewed code, delete any project file, or deploy anything.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function RequireTool([string]$n,[string[]]$locations) {
  $c=Get-Command $n -ErrorAction SilentlyContinue
  if ($c) {return $c.Source}
  foreach($p in $locations){if(Test-Path -LiteralPath $p){return $p}}
  throw "Missing $n"
}
function Run([string]$exe,[string[]]$arguments,[string]$stage) {
  $old=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    & $exe @arguments
    $rc=$LASTEXITCODE
  } finally {$ErrorActionPreference=$old}
  if ($rc -ne 0){throw "$stage failed (exit $rc)"}
}
function Quiet([string]$exe,[string[]]$arguments) {
  $old=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    & $exe @arguments 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } finally {$ErrorActionPreference=$old}
}

$seven=RequireTool '7z.exe' @('C:\Program Files\7-Zip\7z.exe')
$gh=RequireTool 'gh.exe' @('C:\Program Files\GitHub CLI\gh.exe')
$repo='faust-0612/BUKLOD-Local-Recovery'
if (-not (Quiet $gh @('auth','status','--hostname','github.com'))) {
  Run $gh @('auth','login','--hostname','github.com','--web','--git-protocol','https') 'GitHub login'
}
$who=((& $gh api user --jq '.login') | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $who -ne 'faust-0612') {throw "Unexpected GitHub account $who"}
$private=((& $gh repo view $repo --json isPrivate --jq '.isPrivate') | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $private -ne 'true') {throw 'Destination repo not verified PRIVATE'}

$home=$env:USERPROFILE
$rootPaths=@(
  (Join-Path $home 'BUKLOD_WORKSPACE\SOURCE'),
  (Join-Path $home 'BUKLOD-Rork'),
  (Join-Path $home 'BUKLOD-Rork-WebDeploy'),
  (Join-Path $home 'BUKLOD_QUIZ_SSO_WEB'),
  (Join-Path $home 'BUKLOD_IGPAT_WEB_VERIFY_20260917'),
  (Join-Path $home 'OneDrive\Documents\ChatGPT\BUKLOD_Quiz_Standalone'),
  (Join-Path $home 'Downloads\BUKLOD_Classroom_Standalone'),
  (Join-Path $home 'Downloads\BUKLOD_Quiz_Standalone'),
  (Join-Path $home 'Downloads\BUKLOD_Report'),
  (Join-Path $home 'Downloads\BUKLOD_Production_Starter_v16'),
  'C:\BUKLOD-Manual',
  'C:\BUKLOD_HC',
  'C:\BUKLOD_IOS_V28',
  'C:\BUKLOD_IOS_KEYS'
)
# Include KL creative working files and the standalone Firebase Admin SDK key in ENCRYPTED storage only.
if (Test-Path -LiteralPath 'D:\Download') {
  $rootPaths+=@(Get-ChildItem -LiteralPath 'D:\Download' -Force -ErrorAction Stop |
    Where-Object { $_.Name -match '^KABIHASNANG_LIGAW_' -or $_.Name -match '^buklod-.*firebase-adminsdk.*\.json$' } |
    ForEach-Object {$_.FullName})
}
$roots=@($rootPaths | Where-Object {Test-Path -LiteralPath $_} | Sort-Object -Unique)
$missing=@($rootPaths | Where-Object {-not (Test-Path -LiteralPath $_)} | Sort-Object -Unique)
if ($roots.Count -lt 8) {throw 'Too few source paths available; refusing incomplete upload.'}

$rootOut = if (Test-Path 'D:\') {'D:\BUKLOD_GITHUB_TRANSFER_STAGE'} else {Join-Path $env:TEMP 'BUKLOD_GITHUB_TRANSFER_STAGE'}
New-Item -ItemType Directory -Force -Path $rootOut | Out-Null
$tag='sources-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$work=Join-Path $rootOut $tag
New-Item -ItemType Directory -Force -Path $work | Out-Null
$archive=Join-Path $work "BUKLOD_SOURCES_$tag.7z"
$exclude=@('-xr!node_modules','-xr!.expo','-xr!.gradle','-xr!.next','-xr!__pycache__','-xr!.cache','-xr!Pods','-xr!DerivedData')
$manifest=[pscustomobject]@{
  Format='BUKLOD-SOURCES-phase2-v1'; SnapshotTime=(Get-Date).ToString('o');
  IncludedRoots=$roots; MissingRoots=$missing; ExcludedRegenerableDirectories=$exclude;
  CompleteWorkstationMigration=$false; SafeToDeleteLocal=$false
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $work 'MANIFEST.json') -Encoding utf8
Write-Host "Saving $($roots.Count) SOURCE paths; $($missing.Count) missing paths"
Write-Host 'This source-only wave intentionally excludes regenerable dependency caches.'
Write-Host 'Set an archive encryption passphrase and save it off the laptop.'
# Store absolute paths for distinct C:/D: roots. Extraction requires conscious destination selection.
Run $seven (@('a','-t7z','-mhe=on','-mx=1','-v1400m','-spf','-p',$archive)+$exclude+$roots) 'Source archive creation'
$first=$archive+'.001'
if (-not (Test-Path -LiteralPath $first -PathType Leaf)) {throw 'Expected first archive volume is missing'}
Write-Host 'Re-enter the same archive passphrase for integrity testing.'
Run $seven @('t',$first) 'Encrypted volume self-test'
$parts=@(Get-ChildItem -LiteralPath $work -Filter '*.7z.*' -File | Sort-Object Name)
if ($parts.Count -eq 0 -or $parts.Count -gt 900) {throw 'Unexpected part count'}
$hashes=@($parts | ForEach-Object {
  [pscustomobject]@{Name=$_.Name;Bytes=$_.Length;SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
})
$hashes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $work 'HASHES.json') -Encoding utf8
$notes="Encrypted BUKLOD source snapshot. Not a deploy or deletion approval. Parts=$($parts.Count). Excludes regenerable caches."
Run $gh @('release','create',$tag,'--repo',$repo,'--title',"BUKLOD source rescue $tag",'--notes',$notes,'--latest=false') 'Private release creation'
foreach($part in $parts) {
  Write-Host "Uploading $($part.Name) ($([Math]::Round($part.Length/1MB,1)) MiB)"
  Run $gh @('release','upload',$tag,$part.FullName,'--repo',$repo) "Upload $($part.Name)"
}
# GitHub's release-asset digest is server-computed sha256 when available.
# Otherwise download the exact asset and hash it, rather than trusting upload success alone.
$apiJSON=(& $gh api "repos/$repo/releases/tags/$tag" | Out-String)
if ($LASTEXITCODE -ne 0) {throw 'Cannot retrieve GitHub release metadata'}
$remote=($apiJSON | ConvertFrom-Json)
$verified=0
foreach($part in $parts) {
  $expected=($hashes | Where-Object {$_.Name -eq $part.Name} | Select-Object -First 1).SHA256
  $asset=@($remote.assets | Where-Object {$_.name -eq $part.Name})
  if ($asset.Count -ne 1) {throw "Remote asset missing: $($part.Name)"}
  $digest=[string]$asset[0].digest
  if ($digest -match '^sha256:([0-9a-fA-F]{64})$') {
    if ($Matches[1].ToUpperInvariant() -ne $expected) {throw "Remote SHA mismatch: $($part.Name)"}
  } else {
    $verifyDir=Join-Path $work 'download-verify'
    New-Item -ItemType Directory -Force -Path $verifyDir | Out-Null
    Run $gh @('release','download',$tag,'--repo',$repo,'--dir',$verifyDir,'--pattern',$part.Name) "Download $($part.Name)"
    $dl=(Join-Path $verifyDir $part.Name)
    if ((Get-FileHash -LiteralPath $dl -Algorithm SHA256).Hash -ne $expected) {throw "Download SHA mismatch: $($part.Name)"}
  }
  $verified++
}
$result=[pscustomobject]@{
  Status='SOURCES CLOUD UPLOAD VERIFIED';URL="https://github.com/$repo/releases/tag/$tag";
  SourceRootsIncluded=$roots.Count;MissingRoots=$missing;
  PartsVerified=$verified;Encrypted=$true;DeletedProjectFiles=0;
  SourceWaveComplete=$true;FullMigrationComplete=$false;SafeToDeleteLocal=$false
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $work 'RESULT.json') -Encoding utf8
Write-Host 'SOURCES CLOUD UPLOAD VERIFIED' -ForegroundColor Green
Write-Host "URL: $($result.URL)"
Write-Host "RESULT: $(Join-Path $work 'RESULT.json')"
Write-Host 'No local deletion. Build/release archives and independent restore verification remain.'
