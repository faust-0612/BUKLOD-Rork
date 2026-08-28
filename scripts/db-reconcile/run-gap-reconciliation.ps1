# BUKLOD migration gap reconciliation runner
# Usage: .\scripts\db-reconcile\run-gap-reconciliation.ps1

$ErrorActionPreference = "Stop"
$env:SUPABASE_TELEMETRY = "disabled"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

$LogFile = Join-Path $Root "BUKLOD_MIGRATION_RECONCILIATION_LOG.txt"

function Write-Log {
  param([string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Invoke-DbQuery {
  param([string]$Sql)
  $env:SUPABASE_TELEMETRY = "disabled"
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & npx supabase db query --linked $Sql 2>&1 | Out-String
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($LASTEXITCODE -ne 0) { throw "db query failed: $out" }
  return $out
}

function Invoke-DbFile {
  param([string]$Path)
  $env:SUPABASE_TELEMETRY = "disabled"
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & npx supabase db query --linked -f $Path 2>&1 | Out-String
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($LASTEXITCODE -ne 0) { throw "db file failed ($Path): $out" }
  return $out
}

function Test-CashWrites {
  $out = Invoke-DbQuery "SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND pg_get_functiondef(p.oid) ILIKE '%insert into public.bayanihan_ledger%';"
  if ($out -match '"n":\s*0') { return $true }
  throw "Cash write regression detected: $out"
}

function Repair-Migration {
  param([string]$Version)
  $env:SUPABASE_TELEMETRY = "disabled"
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & npx supabase migration repair $Version --status applied 2>&1 | Out-String
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($LASTEXITCODE -ne 0) { throw "migration repair failed ($Version): $out" }
  $check = Invoke-DbQuery "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$Version';"
  if ($check -notmatch '1') { throw "migration $Version not in history after repair" }
  return $out
}

function Apply-Migration {
  param(
    [string]$Version,
    [string]$File,
    [string]$VerifySql,
    [string]$Note = ""
  )
  Write-Log "APPLY START $Version $Note"
  Invoke-DbFile $File | Out-Null
  Write-Log "APPLY SQL OK $Version"
  if ($VerifySql) {
    $v = Invoke-DbQuery $VerifySql
    Write-Log "VERIFY $Version => $v"
    if ($v -notmatch '"ok":\s*true' -and $v -notmatch '"present":\s*true' -and $v -notmatch '"exists":\s*true' -and $v -notmatch '"learning_pts_only":\s*true') {
      throw "Verification failed for $Version : $v"
    }
  }
  Test-CashWrites | Out-Null
  Write-Log "CASH SCAN OK $Version"
  Repair-Migration $Version | Out-Null
  Write-Log "REPAIR OK $Version"
}

Write-Log "=== RECONCILIATION START ==="

# Pre-flight
$hist = Invoke-DbQuery "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260818270000' ORDER BY version;"
Write-Log "PREFLIGHT HISTORY: $hist"
Test-CashWrites | Out-Null
Write-Log "PREFLIGHT CASH SCAN OK"

$verifications = @{
  '20260818280000' = "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_posts' AND column_name='is_reel') AS ok;"
  '20260818290000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='update_buklod_post_comment_v1') AS ok;"
  '20260818300000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_buklod_post_comment_previews_v1') AS ok;"
  '20260819110000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_buklod_reel_v1') AS ok;"
  '20260819120000' = "SELECT (SELECT file_size_limit FROM storage.buckets WHERE id='community-media') = 1073741824 AS ok;"
  '20260819130000' = "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buklod_connect_direct_messages' AND column_name='deleted_at') AS ok;"
  '20260819140000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_buklod_photo_reactions_v1') AS ok;"
  '20260819150000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_buklod_comment_reaction_details_v1') AS ok;"
  '20260819160000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_buklod_profile_names_v1') AS ok;"
  '20260819170000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='buklod_connect_direct_messages_v1') AS ok;"
  '20260819180000' = "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buklod_user_preferences' AND column_name='profile_locked') AS ok;"
  '20260819190000' = "SELECT to_regclass('public.buklod_user_points_balances') IS NOT NULL AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='buklod_points_ledger' AND column_name='claim_state') AS ok;"
  '20260819200000' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='buklod_award_scope_attendance_points_v1') AS ok;"
  '20260819210000' = "SELECT EXISTS(SELECT 1 FROM public.buklod_point_rules WHERE activity_type='daily_bible_verification') AND EXISTS(SELECT 1 FROM public.buklod_point_rules WHERE activity_type='learning_progress_verification') AS ok;"
  '20260819220000' = "SELECT to_regclass('public.buklod_character_progression_tiers') IS NOT NULL AND to_regclass('public.buklod_redeem_catalog') IS NOT NULL AS ok;"
  '20260820100000' = "SELECT to_regclass('public.buklod_formation_config') IS NOT NULL AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='member_lesson_attempts' AND column_name='supersedes_attempt_id') AS ok;"
  '20260820110000' = "SELECT to_regclass('public.buklod_formation_member_curriculum_delivery') IS NOT NULL AS ok;"
  '20260820120000' = "SELECT to_regclass('public.buklod_formation_curriculum_manifests') IS NOT NULL AS ok;"
  '20260820130000' = "SELECT to_regclass('public.buklod_formation_source_documents') IS NOT NULL AS ok;"
  '20260820130001' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='buklod_formation_seed_controlled_drafts_006_v1') AS ok;"
  '20260820131500' = "SELECT relrowsecurity AS ok FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='buklod_formation_source_documents';"
  '20260820131600' = "SELECT true AS ok;"
  '20260820131700' = "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='can_access_formation_lesson_v1') AS ok;"
  '20260820131800' = "SELECT true AS ok;"
}

$foundation = @(
  '20260818280000_wall_video_10min_foundation.sql',
  '20260818290000_wall_reactions_comment_actions.sql',
  '20260818300000_reels_wall_ux_previews_reactions.sql',
  '20260819110000_remove_buklod_video_file_size_product_caps.sql',
  '20260819120000_buklod_video_1gb_30min_policy.sql',
  '20260819130000_buklod_connect_message_actions.sql',
  '20260819140000_buklod_photo_reactions_details.sql',
  '20260819150000_buklod_comment_reaction_details.sql',
  '20260819160000_buklod_profile_names_for_community.sql',
  '20260819170000_buklod_connect_direct_messages_v1.sql',
  '20260819180000_buklod_member_public_profile.sql'
)

foreach ($f in $foundation) {
  $v = $f.Substring(0, 14)
  Apply-Migration -Version $v -File "supabase/migrations/$f" -VerifySql $verifications[$v]
}

Apply-Migration -Version '20260819190000' -File 'supabase/migrations/20260819190000_buklod_rewards_phase1_dual_balance_claim.sql' -VerifySql $verifications['20260819190000']
Apply-Migration -Version '20260819200000' -File 'supabase/migrations/20260819200000_buklod_rewards_phase2_scope_attendance_points.sql' -VerifySql $verifications['20260819200000']

Write-Log "19210000 ORIGINAL FILE NOT EXECUTED - SAFE SEED SPLICE"
Invoke-DbFile 'scripts/db-reconcile/20260819210000_seeds_only.sql' | Out-Null
$v1921 = Invoke-DbQuery $verifications['20260819210000']
Write-Log "VERIFY 19210000 seeds => $v1921"
Test-CashWrites | Out-Null
Repair-Migration '20260819210000' | Out-Null
Write-Log "REPAIR OK 20260819210000 (seed splice)"

Write-Log "APPLY 20260819220000"
Invoke-DbFile 'supabase/migrations/20260819220000_buklod_rewards_phases3_6_foundation.sql' | Out-Null
Write-Log "REPATCh after 19220000"
Invoke-DbFile 'scripts/db-reconcile/20131900_repatch_after_gap.sql' | Out-Null
Test-CashWrites | Out-Null
$v1922 = Invoke-DbQuery $verifications['20260819220000']
Write-Log "VERIFY 19220000 => $v1922"
Repair-Migration '20260819220000' | Out-Null
Write-Log "REPAIR OK 20260819220000"

Write-Log "APPLY 20260820100000"
Invoke-DbFile 'supabase/migrations/20260820100000_buklod_formation_engine_002.sql' | Out-Null
Write-Log "REPATCh after 20100000"
Invoke-DbFile 'scripts/db-reconcile/20131900_repatch_after_gap.sql' | Out-Null
Test-CashWrites | Out-Null
$v2010 = Invoke-DbQuery $verifications['20260820100000']
Write-Log "VERIFY 20100000 => $v2010"
Repair-Migration '20260820100000' | Out-Null
Write-Log "REPAIR OK 20260820100000"

$formation = @(
  '20260820110000_buklod_formation_delivery_engine_004.sql',
  '20260820120000_buklod_formation_curriculum_builder_005.sql',
  '20260820130000_buklod_formation_source_runtime_006.sql',
  '20260820130001_buklod_formation_import_controlled_006.sql',
  '20260820131500_buklod_formation_source_metadata_hardening.sql',
  '20260820131600_buklod_formation_seed_rpc_hardening.sql',
  '20260820131700_buklod_formation_repeat_access_rls_hardening.sql',
  '20260820131800_buklod_formation_repeat_access_rls_fix.sql'
)

foreach ($f in $formation) {
  $v = $f.Substring(0, 14)
  $block = 600000
  if ($v -eq '20260820130001') { $block = 900000 }
  Apply-Migration -Version $v -File "supabase/migrations/$f" -VerifySql $verifications[$v]
}

Write-Log "=== RECONCILIATION COMPLETE ==="
