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
    if (!text.includes(token)) failures.push(`${rel}: missing R2 anchor: ${token}`);
  }
}

function forbidAll(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (text.includes(token)) failures.push(`${rel}: forbidden R2 regression anchor present: ${token}`);
  }
}

console.log('BUKLOD MAIN COMMUNITY HELP / EMERGENCY ALERT MODE RELEASE CONTRACT — R2');
console.log('======================================================================');
console.log('Rule: additive R2 only; locked R1 privacy/proximity/anti-abuse contract remains mandatory.');

requireAll('src/lib/buklodEmergencyAlertMode.ts', [
  "BUKLOD_EMERGENCY_CHANNEL_ID = 'buklod-emergency-v1'",
  "BUKLOD_EMERGENCY_CATEGORY_ID = 'buklod_emergency'",
  'BUKLOD_EMERGENCY_DND_NATIVE_MIN_VERSION_CODE = 21',
  'AndroidImportance.MAX',
  "sound: 'default'",
  'vibrationPattern: [0, 900, 250, 900, 250, 1200]',
  'bypassDnd: true',
  'AndroidAudioUsage.ALARM',
  'AndroidAudioContentType.SONIFICATION',
  "Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS')",
  "buttonTitle: 'ACKNOWLEDGE'",
  "kind: 'community_emergency_test'",
  'No nearby BUKLOD user was alerted.',
  "interruptionLevel: Platform.OS === 'ios' ? 'timeSensitive' : undefined",
  "return 'ACKNOWLEDGED' as const",
]);

requireAll('src/components/BuklodEmergencyAlertModeCard.tsx', [
  'EMERGENCY ALERT MODE',
  'MAX ALERT MODE READY · DND NATIVE UPDATE PENDING',
  'ENABLE DND OVERRIDE',
  'TEST THIS PHONE',
  'The test is local-only. It never broadcasts an SOS.',
  'Apple Critical Alerts approval',
]);

requireAll('src/components/BuklodPublicLocationChips.tsx', [
  "import BuklodCommunityHelp from '@/components/BuklodCommunityHelp';",
  "import BuklodEmergencyAlertModeCard from '@/components/BuklodEmergencyAlertModeCard';",
  '<BuklodCommunityHelp />',
  '<BuklodEmergencyAlertModeCard />',
  'CONNECT',
]);

requireAll('src/lib/pushNotifications.ts', [
  'BUKLOD_EMERGENCY_ALERT_MODE_R2_CAPABILITY',
  'ensureBuklodEmergencyChannel',
  'registerBuklodEmergencyNotificationCategory',
  "'mark_device_emergency_alert_mode_r2'",
  'p_expo_push_token: token',
  'buklod-activity-v2 fallback',
]);

requireAll('src/providers/NotificationProvider.tsx', [
  'ensureBuklodEmergencyChannel',
  'registerBuklodEmergencyNotificationCategory',
  'emergencyResponseTypeForAction',
  "kind==='community_emergency'&&d?.help_request_id&&user?.id",
  'p_response_type:responseType',
  'resolveBuklodNotificationTarget',
  'void openNotification(kind,d)',
]);

requireAll('src/lib/buklodNotificationNavigation.ts', [
  'const helpRequestId = clean(payload.help_request_id);',
  'path: `/buklod?help_request_id=${encodeURIComponent(helpRequestId)}`',
]);

requireAll('app.config.js', [
  "...(!isClassroom ? ['android.permission.ACCESS_NOTIFICATION_POLICY'] : [])",
  'versionCode: isStaging ? undefined : (isClassroom ? 20 : 21)',
  'isIosBackgroundLocationEnabled: false',
  'isAndroidBackgroundLocationEnabled: false',
  'isAndroidForegroundServiceEnabled: false',
]);

requireAll('supabase/migrations/20260914012140_community_help_emergency_alert_r2.sql', [
  'already-applied production migration version 20260914012140',
  'create table if not exists private.buklod_help_emergency_alert_r2_state',
  'reminders_enabled boolean not null default false',
  'add column if not exists emergency_alert_mode_version integer not null default 1',
  'create or replace function public.mark_device_emergency_alert_mode_r2',
  "if not found then raise exception 'DEVICE_TOKEN_NOT_OWNED'",
  "'ACKNOWLEDGED'",
  "if v_type='ACKNOWLEDGED' then",
  "if v_distance>v_request.radius_km then raise exception 'NOT_WITHIN_ALERT_RADIUS'",
  'private.buklod_help_enqueue_emergency_reminders_r2()',
  'if not coalesce(v_reminders_enabled,false) then',
  "'buklod-help-emergency-reminders-r2'",
]);

requireAll('supabase/functions/push/index.ts', [
  'BUKLOD_EMERGENCY_ALERT_MODE_R2_CAPABILITY_FALLBACK',
  "notification.kind === 'community_emergency'",
  ".select('expo_push_token,platform,emergency_alert_mode_version')",
  'Number(row.emergency_alert_mode_version ?? 1) >= 2',
  "? 'buklod-emergency-v1'",
  ": 'buklod-activity-v2'",
  "categoryReady ? 'buklod_emergency' : undefined",
  "isCommunityEmergency && platform === 'ios' ? 'time-sensitive' : undefined",
  "emergency_alert_mode: r2Ready ? 'R2' : 'R1_FALLBACK'",
  'emergency_fallback_tokens: emergencyFallbackCount',
]);

forbidAll('app.config.js', [
  'isIosBackgroundLocationEnabled: true',
  'isAndroidBackgroundLocationEnabled: true',
  'isAndroidForegroundServiceEnabled: true',
  'android.permission.USE_FULL_SCREEN_INTENT',
]);
forbidAll('src/lib/buklodEmergencyAlertMode.ts', [
  "interruptionLevel: 'critical'",
  "sound: 'defaultCritical'",
]);

if (failures.length) {
  console.error('\nEMERGENCY ALERT MODE R2 RELEASE LOCK FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('EMERGENCY ALERT MODE R2 RELEASE LOCK PASSED.');
