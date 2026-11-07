param(
  [switch]$InventoryOnly,
  [switch]$NoPush
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Source-only, never delete any originals; avoid binary build caches and secrets.
$paths = @(
  "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD_BSOC_Standalone",
  "$HOME\BUKLOD_WORKSPACE\SOURCE\BUKLOD-BSOC",
  "$HOME\Downloads\BUKLOD_BSOC_Standalone",
  "$HOME\Desktop\BUKLOD_NEW_DOWNLOADS\BUKLOD_BSOC_Standalone",
  "D:\BUKLOD_PC_STORAGE\Downloads_Archive_20260920\BUKLOD_BSOC_Standalone"
)
$reports = Join-Path $env:TEMP ("BUKLOD_BSOC_LOCAL_AUDIT_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $reports -Force | Out-Null
$candidates=@()
foreach($dir in $paths){
  $pkg=Join-Path $dir 'package.json'
  $shell=Join-Path $dir 'components\BsocShell.tsx'
  $overview=Join-Path $dir 'app\overview.tsx'
  if((Test-Path -LiteralPath $pkg) -and (Test-Path -LiteralPath $shell) -and (Test-Path -LiteralPath $overview)){
    try {
      $data=Get-Content -LiteralPath $pkg -Raw | ConvertFrom-Json
      if($data.name -ne 'buklod-bsoc'){ continue }
      $candidates+= [pscustomobject]@{path=$dir;packageName=$data.name;hasExpoRouter=($null -ne $data.dependencies.'expo-router');lastWriteUtc=(Get-Item $pkg).LastWriteTimeUtc.ToString('o')}
    }catch{ Write-Warning ("Could not parse package at: "+$dir) }
  }
}
$manifest=[ordered]@{schema='buklod-bsoc-local-audit/v1';generatedUtc=[DateTime]::UtcNow.ToString('o');candidates=$candidates;copied=$false;uploaded=$false;deletionClearance=$false}
$manifestPath=Join-Path $reports 'BSOC_SOURCE_AUDIT.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Host ("AUDIT REPORT: "+$manifestPath)
if(!$candidates.Count){ Write-Warning 'No complete standalone BSOC source found in exact known folders. Do not delete local data.';exit 3 }
$candidates | Format-Table -AutoSize
if($InventoryOnly){Write-Host 'INVENTORY ONLY. No files were copied or pushed.';exit 0}
if($candidates.Count -gt 1){
  $choice=$candidates | Sort-Object lastWriteUtc -Descending | Select-Object -First 1
  Write-Host ('Using most recently updated complete candidate: '+$choice.path)
}else{$choice=$candidates[0]}
if(-not (Get-Command git -ErrorAction SilentlyContinue)){throw 'Git is required for migration'}
$source=$choice.path
$work=Join-Path $reports 'PRIVATE_GITHUB_CHECKOUT'
git clone --depth 1 --filter=blob:none 'https://github.com/faust-0612/BUKLOD-Migrated-Sources.git' $work
if($LASTEXITCODE -ne 0){throw 'Private repository clone failed: verify GitHub authentication'}
$branch='migration/bsoc-standalone-source-'+(Get-Date -Format 'yyyyMMdd-HHmmss')
git -C $work switch -c $branch
if($LASTEXITCODE -ne 0){throw 'Could not create isolated migration branch'}
$dst=Join-Path $work 'systems\bsoc\BUKLOD_BSOC_Standalone'
New-Item -ItemType Directory -Path $dst -Force | Out-Null
$excludeDirs=@('.git','node_modules','.expo','.gradle','build','dist','dist-web','coverage','.rork-qa','.next','.vercel','.eas','android\build','ios\Pods')
$excludeFiles=@('.env','.env.*','*.keystore','*.jks','*.p12','*.pem','*.key','credentials.json','service-account*.json','google-services.json','GoogleService-Info.plist','*.log','*.zip','*.7z','*.aab','*.apk')
$arguments=@($source,$dst,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/XJ','/NP','/NFL','/NDL','/XD')+$excludeDirs+@('/XF')+$excludeFiles
& robocopy @arguments
if($LASTEXITCODE -ge 8){throw ('Source copy failed (robocopy exit '+$LASTEXITCODE+')')}
$manifest.copied=$true
$manifest.source=$source
$manifest.destination=$dst
# Scan for high-confidence credential patterns without printing secret values.
$found=@()
$patterns=@('-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','sb_secret_[A-Za-z0-9_-]{12,}','sk-proj-[A-Za-z0-9_-]{12,}','github_pat_[A-Za-z0-9_]{12,}','ghp_[A-Za-z0-9]{30,}')
$scan=Get-ChildItem -LiteralPath $dst -Recurse -File | Where-Object { $_.Extension -match '^(\.ts|\.tsx|\.js|\.jsx|\.json|\.txt|\.md|\.yaml|\.yml|\.html|\.css|\.ps1|\.sql)$' -and $_.Length -lt 3MB }
foreach($file in $scan){
  $content=Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
  foreach($pattern in $patterns){if($content -match $pattern){$found+= $file.FullName;break}}
}
if($found.Count){$manifest.secretScanPassed=$false;$manifest.flaggedFiles=$found; $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8;throw 'Possible credentials detected. Review the report; nothing was pushed.'}
$manifest.secretScanPassed=$true
if(-not (Test-Path -LiteralPath (Join-Path $dst 'app\_layout.tsx'))){throw 'Missing Expo router layout; no push'}
if(-not (Test-Path -LiteralPath (Join-Path $dst 'components\BsocShell.tsx'))){throw 'Missing original BSOC shell; no push'}
git -C $work add -- 'systems/bsoc/BUKLOD_BSOC_Standalone'
if($LASTEXITCODE -ne 0){throw 'Could not stage source'}
$changes=git -C $work status --porcelain
if(-not $changes){Write-Host 'No new content to commit';exit 0}
git -C $work -c user.name='BUKLOD Source Rescue' -c user.email='migration@buklod.invalid' commit -m 'recovery(bsoc): preserve original standalone Expo source (sanitized)'
if($LASTEXITCODE -ne 0){throw 'Could not commit sanitized source'}
$commit=(git -C $work rev-parse HEAD).Trim()
$manifest.branch=$branch;$manifest.commit=$commit
if(-not $NoPush){
 git -C $work push -u origin $branch
 if($LASTEXITCODE -ne 0){throw 'Push failed; local original remains untouched'}
 $manifest.uploaded=$true
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Host ('RESULT: BRANCH='+$branch+' COMMIT='+$commit+' UPLOADED='+$manifest.uploaded)
Write-Host 'NO DELETE CLEARANCE. Preserve every original until remote file reconciliation and complete backup certification.'
