# BUKLOD R5 LOCAL DIFFERENCE CLASSIFIER — READ ONLY.
# Requires successful R4 report and its verified private GitHub TEMP checkout.
# No deletion, no original-file writes, no network, no upload, no secret contents.
[CmdletBinding()]
param(
  [string]$R4ReportPath,
  [switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$archiveSha = '9cef155f2378fc77a46e20325259e81136525e45'
$archiveRoot = 'systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES'
$candidates = @(
  @{ name = 'R10'; folder = 'BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb'; count = 300;
     manifestHash = '04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7' },
  @{ name = 'BUILD'; folder = 'BUKLODQ_BUILD_project_8374b517b993_481385774640'; count = 336;
     manifestHash = '481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad' }
)
$categories = @(
  'protected_credentials_or_data','generated_or_dependency',
  'source_code','media_or_fonts','config_or_documents','other_unclassified'
)
function Category([string]$relative) {
  $p = $relative.Replace('\','/').ToLowerInvariant()
  # Sensitive data always takes priority, including when inside generated folders.
  if ($p -match '(^|/)(\.env($|[.])|\.npmrc$|\.pypirc$|id_rsa$|id_ed25519$|service[-_]?account|credentials?|secret[s]?|keystores?)(/|[.]|$)' -or
      $p -match '(\.jks$|\.keystore$|\.p12$|\.pfx$|\.pem$|\.key$|\.sqlite3?$|\.db$|\.kdbx$|\.asc$|google-services\.json$|google-service-info\.plist$)') {
    return 'protected_credentials_or_data'
  }
  if ($p -match '(^|/)(\.git|node_modules|\.expo|\.gradle|\.next|\.cache|\.turbo|coverage|\.buklod-smoke|\.buklod-android-smoke|__pycache__|pods|\.venv|venv|vendor|dist|build|out|tmp|temp)(/|$)' -or
      $p -match '(^|/)android/(build|\.gradle)/' -or
      $p -match '(^|/)ios/(build|pods)/') {
    return 'generated_or_dependency'
  }
  if ($p -match '(^|/)(app|src|components|hooks|scripts|supabase|migrations|lib|screens)/' -or
      $p -match '\.(tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|dart|sql|prisma|graphql|gradle|sh|ps1)$') {
    return 'source_code'
  }
  if ($p -match '\.(png|jpe?g|webp|gif|svg|ico|bmp|heic|avif|mp4|mov|webm|m4v|mp3|aac|ogg|wav|flac|m4a|woff2?|ttf|otf|lottie|glb|gltf|blend|obj|fbx)$') {
    return 'media_or_fonts'
  }
  if ($p -match '\.(json|ya?ml|toml|xml|properties|config|lock|md|txt|pdf|docx?|xlsx?|pptx?|csv|html|css)$' -or
      $p -match '(^|/)(package-lock\.json|package\.json|eas\.json|app\.json|app\.config\.[^/]+|pubspec\.yaml|dockerfile)$') {
    return 'config_or_documents'
  }
  return 'other_unclassified'
}
function IsSensitive([string]$relative) {
  return (Category $relative) -eq 'protected_credentials_or_data'
}
function SafeRelative([string]$relative) {
  if ([string]::IsNullOrWhiteSpace($relative) -or $relative.StartsWith('/') -or
      $relative.Contains(':') -or $relative.Contains('\') -or
      @($relative.Split('/') | Where-Object { $_ -in @('','.', '..') }).Count -gt 0) {
    throw 'Unsafe archive relative path'
  }
  return $relative.Replace('/','\')
}
function SafeFileSHA([string]$p) {
  return (Get-FileHash -LiteralPath $p -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
}
function MakeCountMap {
  $counts = @{}
  foreach ($category in $categories) { $counts[$category] = 0 }
  return $counts
}
if ($SelfTest) {
  $tests = @(
    @('node_modules/demo/index.js','generated_or_dependency'),
    @('android/.gradle/outputs.dat','generated_or_dependency'),
    @('.buklod-smoke/test/assets/logo.png','generated_or_dependency'),
    @('src/screens/home.tsx','source_code'),
    @('components/card.tsx','source_code'),
    @('assets/hero.png','media_or_fonts'),
    @('assets/logo.woff2','media_or_fonts'),
    @('README.md','config_or_documents'),
    @('assets/.env.production','protected_credentials_or_data'),
    @('android/app/signing.keystore','protected_credentials_or_data'),
    @('node_modules/example/secret.key','protected_credentials_or_data')
  )
  foreach ($test in $tests) {
    $observed = Category $test[0]
    if ($observed -ne $test[1]) { throw "R5 self-test category contract: expected $($test[1]), got $observed" }
  }
  if ((SafeRelative 'src/lib/quiz.ts') -ne 'src\lib\quiz.ts') { throw 'R5 safe-path normalization failed' }
  foreach ($bad in @('../secret','app//index.tsx','C:/bad','')) {
    $blocked=$false
    try { $null=SafeRelative $bad } catch { $blocked=$true }
    if (-not $blocked) { throw 'R5 accepted an invalid path' }
  }
  Write-Host 'BUKLOD R5 SELF-TEST PASSED: sensitive/generated/source/media/config priority, StrictMode-safe paths.'
  return
}
if ([string]::IsNullOrWhiteSpace($R4ReportPath)) { throw 'Specify -R4ReportPath from the successful R4 audit output.' }
$reportFile=(Resolve-Path -LiteralPath $R4ReportPath -ErrorAction Stop).ProviderPath
$r4=Get-Content -LiteralPath $reportFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($r4.archiveCommit -ne $archiveSha -or $r4.deleteClearance -ne $false) {
  throw 'R4 report revision/deletion-safety guard mismatch. No classification performed.'
}
$base=Split-Path -Parent $reportFile
$source=Join-Path $base 'source'
if (-not (Test-Path -LiteralPath (Join-Path $source '.git') -PathType Container)) {
  throw 'The existing verified R4 cloud checkout was not found next to the report.'
}
$null=Get-Command git -ErrorAction Stop
$head=(& git -C $source rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -ne $archiveSha) {
  throw 'Git checkout is not the immutable R4 archive. Refusing classification.'
}
$results=New-Object System.Collections.Generic.List[object]
$details=New-Object System.Collections.Generic.List[object]
$errors=New-Object System.Collections.Generic.List[string]
foreach ($c in $candidates) {
  $prior=@($r4.quizCandidates | Where-Object { $_.candidate -eq $c.name })
  if ($prior.Count -ne 1 -or $prior[0].archiveFilesVerified -ne $c.count) {
    throw "R4 verified file count is missing for $($c.name)"
  }
  $orig=[string]$prior[0].originalFolder
  if (-not (Test-Path -LiteralPath $orig -PathType Container)) {
    throw "Local folder missing; review, don't delete: $($c.name)"
  }
  $mPath=Join-Path (Join-Path $source ($archiveRoot+'/'+$c.folder)) 'QUIZ_RECOVERY_MANIFEST.json'
  $manifest=Get-Content -LiteralPath $mPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.file_count -ne $c.count -or
      @($manifest.files).Count -ne $c.count -or
      $manifest.file_manifest_sha256 -ne $c.manifestHash) {
    throw "R4 immutable manifest failed its fingerprint guard: $($c.name)"
  }
  $expected=@{}
  foreach ($entry in $manifest.files) {
    $rel=[string]$entry.rel
    $null=SafeRelative $rel
    if ($expected.ContainsKey($rel)) { throw "Duplicate manifest path for $($c.name)" }
    $expected[$rel]=$entry
  }
  $seen=@{}
  $counts=MakeCountMap
  $bytes=@{}
  foreach ($category in $categories) { $bytes[$category]=[long]0 }
  $scanned=0;$extras=0;$mismatches=0;$missing=0;$symlinkCount=0;$scanErrorCount=0
  $rootPath=[IO.Path]::GetFullPath($orig).TrimEnd('\')+'\'
  # R5 is streaming, not hashing all generated caches and not walking other disks.
  Get-ChildItem -LiteralPath $orig -Force -File -Recurse -ErrorAction SilentlyContinue -ErrorVariable +errors |
    ForEach-Object {
      $f=$_
      $scanned++
      if (-not $f.FullName.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)) {
        $script:scanErrorCount++; return
      }
      $relative=$f.FullName.Substring($rootPath.Length).Replace('\','/')
      if ($expected.ContainsKey($relative)) {
        $seen[$relative]=$true
        try {
          if ($f.Length -ne [long]$expected[$relative].bytes -or
              (SafeFileSHA $f.FullName) -ne ([string]$expected[$relative].sha256).ToLowerInvariant()) {
            $mismatches++
            $class=Category $relative
            if (-not (IsSensitive $relative)) {
              $details.Add([pscustomobject]@{candidate=$c.name;kind='CHANGED_ARCHIVED_FILE';
                 category=$class;relative=$relative;bytes=[long]$f.Length}) | Out-Null
            }
          }
        } catch {
          $scanErrorCount++
        }
      } else {
        $extras++
        $class=Category $relative
        $counts[$class]=[int]$counts[$class]+1
        $bytes[$class]=[long]$bytes[$class]+[long]$f.Length
        # File paths are kept on laptop in a *separate* private detail report.
        # Do not include secret-like file paths in either report.
        if (-not (IsSensitive $relative) -and $class -ne 'generated_or_dependency') {
          $details.Add([pscustomobject]@{candidate=$c.name;kind='LOCAL_EXTRA';
            category=$class;relative=$relative;bytes=[long]$f.Length}) | Out-Null
        }
      }
    }
  $scanErrorCount += @($errors).Count
  $errors.Clear()
  foreach ($rel in $expected.Keys) {
    if (-not $seen.ContainsKey($rel)) {
      $missing++
      if (-not (IsSensitive $rel)) {
        $details.Add([pscustomobject]@{candidate=$c.name;kind='MISSING_LOCALLY_BUT_IN_CLOUD';
          category=(Category $rel);relative=$rel;bytes=[long]$expected[$rel].bytes}) | Out-Null
      }
    }
  }
  $symlinkCount=@(Get-ChildItem -LiteralPath $orig -Force -Recurse -Attributes ReparsePoint -ErrorAction SilentlyContinue -ErrorVariable +errors).Count
  $scanErrorCount += @($errors).Count
  $errors.Clear()
  $result=[pscustomobject]@{
    candidate=$c.name;localRoot=$orig;
    localFilesScanned=$scanned;localExtraFiles=$extras;
    changedArchivedFiles=$mismatches;missingLocallyButCloudArchived=$missing;
    reparsePoints=$symlinkCount;scanErrors=$scanErrorCount;
    extrasByCategory=$counts;extraBytesByCategory=$bytes;
    parityVerified=$false;deleteClearance=$false
  }
  $results.Add($result) | Out-Null
  Write-Host "$($c.name): extra=$extras changed=$mismatches missing-local=$missing scan-errors=$scanErrorCount"
  foreach ($category in $categories) {
    Write-Host ("  {0}: {1} files / {2} bytes" -f $category,$counts[$category],$bytes[$category])
  }
}
$summary=[ordered]@{
  schema='buklod-quiz-cloud-diff-r5/v1';
  timestampUtc=(Get-Date).ToUniversalTime().ToString('o');
  archivedCommit=$archiveSha;
  sourceR4Report='Verified R4 report in same local temporary directory';
  candidates=@($results.ToArray());
  remoteCloudBackupsForOtherProjectsVerified=$false;
  credentialsRecoveryVerified=$false;
  fullPcInventoryVerified=$false;
  independentRestoreVerified=$false;
  deleteClearance=$false;
  caveat='Counts are read-only classifications, NOT proof that generated files are disposable or unique files have been uploaded.'
}
$summaryFile=Join-Path $base 'BUKLOD_R5_Sanitized_Summary.json'
$detailFile=Join-Path $base 'BUKLOD_R5_LOCAL_PRIVATE_DETAILS.csv'
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $summaryFile -Encoding UTF8
$details | Export-Csv -LiteralPath $detailFile -NoTypeInformation -Encoding UTF8
Write-Host "SHARE THIS SUMMARY ONLY: $summaryFile"
Write-Host "PRIVATE LAPTOP DETAILS (DO NOT UPLOAD): $detailFile"
Write-Warning 'NO DELETE CLEARANCE. Original local files untouched.'
