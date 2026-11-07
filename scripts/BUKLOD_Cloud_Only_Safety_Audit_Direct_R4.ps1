# BUKLOD Cloud Safety Audit R4 — direct download fallback, READ-ONLY
# Requires Windows PowerShell 5.1+, Git access to private archive.
# Never deletes, rewrites, archives, or uploads any original PC file.
[CmdletBinding()]
param(
  [string]$R10Local = 'C:\BUKLODQ_R10_BUILD\project',
  [string]$BuildLocal = 'C:\BUKLODQ_BUILD\project',
  [string[]]$InventoryRoots = @(),
  [switch]$SelfTest
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$null=Get-Command git -ErrorAction Stop
$prefix='systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES'
$archiveSha='9cef155f2378fc77a46e20325259e81136525e45'
$cases=@(
 @{tag='R10';id='BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb';local=$R10Local;count=300;digest='04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7'},
 @{tag='BUILD';id='BUKLODQ_BUILD_project_8374b517b993_481385774640';local=$BuildLocal;count=336;digest='481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad'}
)
function Sha([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()}
function Rel([string]$p){
 if([string]::IsNullOrWhiteSpace($p) -or $p.StartsWith('/') -or $p.Contains('\') -or $p.Contains(':') -or
    @($p.Split('/') | Where-Object {$_ -eq '.' -or $_ -eq '..' -or $_ -eq ''}).Count -gt 0){throw 'Unsafe manifest path'}
 return $p.Replace('/','\')
}
function LocalCheck([string]$root,[hashtable]$expected){
 if(-not (Test-Path -LiteralPath $root -PathType Container)){
  return @{present=$false;scanned=0;extras=0;missingExpected=$expected.Count;hashMismatch=0;secretLike=0;reparsePoints=0;scanErrors=0}
 }
 $scanErrors=@()
 $files=@(Get-ChildItem -LiteralPath $root -Force -File -Recurse -ErrorAction SilentlyContinue -ErrorVariable +scanErrors)
 $links=@(Get-ChildItem -LiteralPath $root -Force -Recurse -Attributes ReparsePoint -ErrorAction SilentlyContinue -ErrorVariable +scanErrors)
 $seen=@{};$extras=0;$secret=0;$changed=0
 $rootFull=[IO.Path]::GetFullPath($root).TrimEnd('\')+'\'
 foreach($f in $files){
  if(-not $f.FullName.StartsWith($rootFull,[StringComparison]::OrdinalIgnoreCase)){
   $scanErrors+= 'PATH_ESCAPE';continue
  }
  $rel=$f.FullName.Substring($rootFull.Length).Replace('\','/')
  $seen[$rel]=$true
  if($expected.ContainsKey($rel)){
   try{if($f.Length -ne [long]$expected[$rel].bytes -or
           (Sha $f.FullName) -ne ([string]$expected[$rel].sha256).ToLowerInvariant()){$changed++}}
   catch{$scanErrors+=$_}
  }else{
   $extras++
   if($rel -match '(?i)(\.env(\..*)?|\.jks|\.keystore|\.pem|\.p12|\.pfx|\.key|credentials\.json|google-services\.json)$' -or
      $rel -match '(?i)(^|/)(secret|credentials|keystores?)(/|$)'){$secret++}
  }
 }
 $missing=0
 foreach($p in $expected.Keys){if(-not $seen.ContainsKey($p)){$missing++}}
 return @{present=$true;scanned=$files.Count;extras=$extras;missingExpected=$missing;
  hashMismatch=$changed;secretLike=$secret;reparsePoints=$links.Count;scanErrors=$scanErrors.Count}
}
# Safe non-network self-test. Run before any Git clone or local inventory scan.
if ($SelfTest) {
  $valid = @('app/exam.tsx','assets/quiz-logo.png','src/lib/supabase.ts')
  foreach ($item in $valid) {
    $actual = Rel $item
    if ($actual -ne $item.Replace('/','\')) { throw "Self-test: valid path failed: $item" }
  }
  $invalid = @('../secret','.', '/root','app//exam.tsx','app\exam.tsx','C:/foo','a/../b','')
  foreach ($item in $invalid) {
    $rejected = $false
    try { $null = Rel $item } catch { $rejected = $true }
    if (-not $rejected) { throw "Self-test: unsafe path was accepted" }
  }
  if (@().Count -ne 0 -or @('one').Count -ne 1) {
    throw 'Self-test: array count semantics failed.'
  }
  Write-Host 'BUKLOD R4 PowerShell SELF-TEST PASSED: valid/invalid manifest paths and StrictMode empty arrays.'
  return
}

$work=Join-Path $env:TEMP ('BUKLOD_R4_DIRECT_'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
$cloud=Join-Path $work 'source'
New-Item -ItemType Directory -Force -Path $work|Out-Null
Write-Host 'Downloading verified source from private GitHub into TEMP; original laptop files are read-only...'
& git clone --quiet --filter=blob:none --sparse --depth 1 --single-branch --branch migration/quiz-canonical-source-20261107 https://github.com/faust-0612/BUKLOD-Migrated-Sources.git $cloud
if($LASTEXITCODE -ne 0){throw 'GitHub clone failed; verify Git credentials and private repository access.'}
& git -C $cloud sparse-checkout set "$prefix/BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb" "$prefix/BUKLODQ_BUILD_project_8374b517b993_481385774640"
if($LASTEXITCODE -ne 0){throw 'Cloud sparse checkout failed; originals unchanged.'}
$head=(& git -C $cloud rev-parse HEAD).Trim()
if($head -ne $archiveSha){throw 'Unexpected GitHub archive revision; stop.'}
$results=@()
foreach($c in $cases){
 $base=Join-Path $cloud ($prefix+'/'+$c.id)
 $manifest=Join-Path $base 'QUIZ_RECOVERY_MANIFEST.json'
 if(-not (Test-Path -LiteralPath $manifest -PathType Leaf)){throw "Archive manifest missing: $($c.tag)"}
 $j=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8|ConvertFrom-Json
 if($j.file_count -ne $c.count -or @($j.files).Count -ne $c.count -or $j.file_manifest_sha256 -ne $c.digest){
  throw "Archive manifest mismatch: $($c.tag)"
 }
 $expected=@{};$verified=0
 foreach($it in $j.files){
  $rel=[string]$it.rel
  if($expected.ContainsKey($rel)){throw "Duplicate cloud path: $rel"}
  $f=Join-Path $base (Rel $rel)
  if(-not (Test-Path -LiteralPath $f -PathType Leaf)){throw "Cloud file missing: $rel"}
  if((Get-Item -LiteralPath $f).Length -ne [long]$it.bytes -or
    (Sha $f) -ne ([string]$it.sha256).ToLowerInvariant()){throw "Cloud SHA-256 mismatch: $rel"}
  $expected[$rel]=$it;$verified++
 }
 $localResult=LocalCheck $c.local $expected
 $results+=@{candidate=$c.tag;archiveFilesVerified=$verified;originalFolder=$c.local;local=$localResult}
 Write-Host ("{0}: cloud verified={1}, local extras={2}, hash changes={3}, local missing={4}" -f
   $c.tag,$verified,$localResult.extras,$localResult.hashMismatch,$localResult.missingExpected)
}
$others=@()
foreach($p in $InventoryRoots){
 if(-not (Test-Path -LiteralPath $p -PathType Container)){
  $others+=@{root=$p;present=$false;scanErrors=1};continue
 }
 $scanErrors=@();$count=0;$secret=0
 Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue -ErrorVariable +scanErrors|
  ForEach-Object{$count++;if($_.Name -match '(?i)(\.env(\..*)?|\.jks|\.keystore|\.pem|\.p12|\.pfx|\.key)$'){$secret++}}
 $others+=@{root=$p;present=$true;scanned=$count;secretLike=$secret;scanErrors=$scanErrors.Count;cloudParityVerified=$false}
}
$report=[ordered]@{
 audit='BUKLOD_R4_DIRECT_READ_ONLY';createdUtc=(Get-Date).ToUniversalTime().ToString('o');
 archiveCommit=$head;quizCandidates=@($results);otherRoots=@($others);
 gate1_allPcFilesInventoried=$false;gate2_allProjectsBackedUp=$false;
 gate3_allAssetsAndConfigsSecured=$false;gate4_allAppsCloudOnlyRestored=$false;
 gate5_signingKeysRecovered=$false;gate6_independentBackupRestored=$false;
 deleteClearance=$false;
 note='Only two Quiz archive manifests have content parity audited here; all six deletion gates require separate evidence.'
}
$out=Join-Path $work 'BUKLOD_R4_Direct_Report.json'
$report|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $out -Encoding UTF8
Write-Host "REPORT SAVED: $out"
Write-Warning 'READ-ONLY AUDIT COMPLETE. DO NOT DELETE ALL LOCAL BUKLOD FILES.'
