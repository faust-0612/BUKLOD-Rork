param(
  [switch]$PreviewOnly,
  [switch]$SkipTypecheck
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
# Deploy the canonical recovered Expo project, NEVER a replacement static website.
# Precondition: Expo account faust_0612 authenticated on this Windows PC.
$repo='https://github.com/faust-0612/BUKLOD-Migrated-Sources.git'
$sha='3e8c51a3493d3017dae3e3d4051cd11b5bd39bef'
$sub='systems/bsoc/BUKLOD_BSOC_Standalone'
$targetProjectId='55d08013-cf5c-4d4a-9ecb-8d9e8e21e62c'
$expectedOwner='faust_0612'
$expectedSlug='buklod-bsoc'
$report=Join-Path $env:TEMP ('BUKLOD_BSOC_EXPO_RELEASE_'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$state=[ordered]@{schema='buklod-bsoc-expo-web-release/v1';expectedSha=$sha;projectId=$targetProjectId;status='BLOCKED_BEFORE_DEPLOY';published=$false;createdAt=[DateTime]::UtcNow.ToString('o')}
try {
 if(-not (Get-Command git -ErrorAction SilentlyContinue)){throw 'Git CLI not found'}
 if(-not (Get-Command npm -ErrorAction SilentlyContinue)){throw 'Node/npm not found'}
 $root=Join-Path $env:TEMP ('BUKLOD_BSOC_WEB_RELEASE_'+[guid]::NewGuid().ToString('N'))
 git clone --quiet --filter=blob:none --no-checkout $repo $root
 if($LASTEXITCODE){throw 'Cannot clone private source: GitHub authorization required'}
 git -C $root fetch --quiet origin $sha
 if($LASTEXITCODE){throw 'Pinned source commit unavailable'}
 git -C $root checkout --quiet --detach $sha
 if($LASTEXITCODE){throw 'Cannot check out release commit'}
 $actual=(git -C $root rev-parse HEAD).Trim()
 if($actual -ne $sha){throw 'Git source digest mismatch'}
 $work=Join-Path $root $sub
 if(-not (Test-Path (Join-Path $work 'package-lock.json'))){throw 'Standalone project lockfile missing'}
 $app=Get-Content (Join-Path $work 'app.json') -Raw | ConvertFrom-Json
 if($app.expo.owner -ne $expectedOwner -or $app.expo.slug -ne $expectedSlug -or $app.expo.extra.eas.projectId -ne $targetProjectId -or $app.expo.web.output -ne 'static'){
  throw 'Expo target mismatch — will NOT deploy or change another project'
 }
 $state.status='SOURCE_VERIFIED'
 $env:EXPO_PUBLIC_SUPABASE_URL='https://yhanxndaqbmuzbdqlblu.supabase.co'
 # This is a publishable client key, NEVER a service_role or secret key.
 $env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS'
 Push-Location $work
 try {
  npm ci --no-audit --no-fund
  if($LASTEXITCODE){throw 'npm ci failed; deployment stopped'}
  if(-not $SkipTypecheck){npm run typecheck;if($LASTEXITCODE){throw 'Typecheck failed; deployment stopped'}}
  npm run export:web
  if($LASTEXITCODE){throw 'Expo web export failed; deployment stopped'}
  if(-not (Test-Path 'dist/index.html')){throw 'Web export missing index.html'}
  $state.status='WEB_BUNDLE_BUILT'
  # Prefer preinstalled eas CLI; do not print or request EXPO_TOKEN.
  if(Get-Command eas -ErrorAction SilentlyContinue){$eas='eas';$prefix=@()}
  else{$eas='npx';$prefix=@('--yes','eas-cli@latest')}
  $who=& $eas @prefix whoami 2>&1
  if($LASTEXITCODE){throw 'Expo CLI not authenticated. Sign in with eas login on your own device.'}
  if(-not (($who | Out-String) -match [regex]::Escape($expectedOwner))){
   throw 'Wrong Expo owner. Existing project must remain untouched.'
  }
  $args=@('deploy','--non-interactive')
  if(-not $PreviewOnly){$args+='--prod'}
  $result=& $eas @prefix @args 2>&1
  if($LASTEXITCODE){throw 'Expo deployment failed. Review sanitized CLI output on your PC.'}
  $state.status=if($PreviewOnly){'EXPO_PREVIEW_DEPLOY_COMMAND_SUCCEEDED'}else{'EXPO_PRODUCTION_DEPLOY_COMMAND_SUCCEEDED'}
  $state.published=$true
  $state.deployOutput=($result | Out-String).Trim().Substring(0,[Math]::Min(3000,($result|Out-String).Trim().Length))
  Write-Host ($state.deployOutput)
 }finally{Pop-Location}
} catch {
 $state.error=$_.Exception.Message
 Write-Warning $state.error
} finally {
 $state.finishedAt=[DateTime]::UtcNow.ToString('o')
 $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $report -Encoding utf8
 Write-Host ('RELEASE RECEIPT: '+$report)
 Write-Host ('RESULT='+$state.status+' PUBLISHED='+$state.published+' PINNED_SOURCE='+$sha)
}
if(-not $state.published){exit 1}
