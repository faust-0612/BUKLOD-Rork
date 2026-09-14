import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireAll(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${rel}: missing locked anchor: ${token}`);
  }
}

function forbidAll(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) failures.push(`${rel}: forbidden regression anchor present: ${token}`);
  }
}

console.log('BUKLOD COMMUNITY HELP / EMERGENCY SOS RELEASE CONTRACT — R1');
console.log('==========================================================');
console.log('Baseline snapshot: baseline/community-help-sos-r1-live-20260914');
console.log('Baseline live SHA : 08c3dba634280152c2b65970c1f0045f23c235c0');

// Client surface + canonical backend paths.
requireAll('src/components/BuklodCommunityHelp.tsx', [
  "import * as Location from 'expo-location';",
  "registerPushToken(user.id)",
  "supabase.rpc('buklod_help_update_presence'",
  "supabase.rpc('buklod_help_disable_presence'",
  "supabase.rpc('buklod_help_create_request'",
  "supabase.rpc('buklod_help_list_nearby'",
  "supabase.rpc('buklod_help_respond'",
  "supabase.rpc('buklod_help_resolve'",
  "supabase.functions.invoke('buklod-help-alert'",
  'BUKLOD HELP',
  'Need Help',
  'Emergency SOS',
  'Enable nearby safety alerts',
  'Nearby safety alerts on',
  "I'M SAFE / RESOLVE",
  'Exact location is used only for proximity matching.',
  'not a replacement for official emergency services',
]);

// Must remain attached to the Public Community Wall, not organization-gated.
requireAll('src/components/BuklodPublicLocationChips.tsx', [
  "import BuklodCommunityHelp from '@/components/BuklodCommunityHelp';",
  '<BuklodCommunityHelp />',
]);

// Emergency notification must retain a direct BUKLOD Community route and request identity.
requireAll('src/providers/NotificationProvider.tsx', [
  "kind==='community_emergency'&&data?.help_request_id",
  '/buklod?help_request_id=',
]);

// Foreground-only location is a locked privacy boundary for R1.
requireAll('app.config.js', [
  "'expo-location'",
  'isIosBackgroundLocationEnabled: false',
  'isAndroidBackgroundLocationEnabled: false',
  'isAndroidForegroundServiceEnabled: false',
]);

// Canonical schema, RLS, privacy, anti-spam and proximity rules.
requireAll('supabase/migrations/20260913214500_community_help_sos_r1.sql', [
  'create table if not exists public.buklod_help_presence',
  'create table if not exists public.buklod_help_requests',
  'create table if not exists public.buklod_help_responses',
  'create table if not exists public.buklod_help_alert_dispatches',
  'create table if not exists public.buklod_help_alert_deliveries',
  'alter table public.buklod_help_presence enable row level security',
  'alter table public.buklod_help_requests enable row level security',
  'alter table public.buklod_help_responses enable row level security',
  'No authenticated client policy is created for dispatch/delivery ledgers.',
  "kind='EMERGENCY' and status='ACTIVE'",
  "created_at > now() - interval '20 seconds'",
  "then interval '2 hours' else interval '12 hours'",
  "then 5.0 else 3.0 end",
  "p.updated_at > now()-interval '60 minutes'",
  "if v_request.creator_id=auth.uid() then raise exception 'CREATOR_CANNOT_RESPOND'",
  "if v_distance>v_request.radius_km then raise exception 'NOT_WITHIN_ALERT_RADIUS'",
]);

// Anonymous callers must remain excluded from the safety RPC surface.
requireAll('supabase/migrations/20260913222000_community_help_sos_r1_revoke_anon.sql', [
  'buklod_help_update_presence(double precision,double precision,boolean) from anon',
  'buklod_help_disable_presence() from anon',
  'buklod_help_create_request(text,text,text,double precision,double precision) from anon',
  'buklod_help_list_nearby(integer) from anon',
  'buklod_help_respond(uuid,text) from anon',
  'buklod_help_resolve(uuid,text) from anon',
]);

// Emergency fan-out: owner-authenticated, active emergency only, recent opt-in presence,
// max 5 km, density-based minimal radius, idempotent notifications, no direct Expo double-send.
requireAll('supabase/functions/buklod-help-alert/index.ts', [
  "if(!alert||alert.creator_id!==authData.user.id)throw new Error('REQUEST_NOT_OWNED')",
  "if(alert.kind!=='EMERGENCY'||alert.status!=='ACTIVE')throw new Error('NOT_ACTIVE_EMERGENCY')",
  'Date.now()-60*60*1000',
  'Math.min(5,Number(alert.radius_km??5))',
  'const chosenRadius=within1>=3?1:within3>=3?3:5',
  "kind:'community_emergency'",
  "help_request_id:alert.id",
  ".from('notifications')",
  'Do not call Expo Push directly here, or a single SOS could be sent twice.',
]);

// R1 intentionally does not require background location or a native alarm/full-screen takeover.
forbidAll('app.config.js', [
  'isIosBackgroundLocationEnabled: true',
  'isAndroidBackgroundLocationEnabled: true',
  'isAndroidForegroundServiceEnabled: true',
]);

if (failures.length) {
  console.error('\nCOMMUNITY HELP / SOS RELEASE LOCK FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nDo not bypass this gate. Restore the locked R1 invariant or explicitly revise the baseline contract as a reviewed product change.');
  process.exit(1);
}

console.log('COMMUNITY HELP / SOS RELEASE LOCK PASSED.');
console.log('Locked: Public Community placement, foreground-only location, privacy, RLS/RPC hardening, anti-spam, max-radius fan-out, idempotency, canonical push route.');
