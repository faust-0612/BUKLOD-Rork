import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');
const client = read('src/components/BuklodCommunityHelp.tsx');
const host = read('src/components/BuklodGlobalEmergencyHost.tsx');
const push = read('supabase/functions/push/index.ts');
const notification = read('src/lib/pushNotifications.ts');
const nativeConfig = read('app.config.js');
const sql = read('supabase/migrations/20261121230000_sos_urgent_audible_rescue.sql');

test('SOS cannot send with location disabled; sender uses high accuracy GPS', () => {
  assert.match(client, /Location\.hasServicesEnabledAsync\(\)/);
  assert.match(client, /Location\.requestForegroundPermissionsAsync\(\)/);
  assert.match(client, /ensurePresence\(true,kind==='EMERGENCY'\)/);
  assert.match(client, /Location\.Accuracy\.High/);
  assert.match(client, /if\(!coords\)return/);
  assert.match(client, /delayLongPress=\{1800\}/);
});

test('Sound only uses a bundled native channel for a capability-registered token', () => {
  assert.match(nativeConfig, /sounds: \['\.\/assets\/sounds\/buklod_alert\.wav'\]/);
  assert.match(notification, /setNotificationChannelAsync\('buklod-emergency-v2'/);
  assert.match(notification, /getNotificationChannelAsync\('buklod-emergency-v2'/);
  assert.match(notification, /buklod_help_register_emergency_channel/);
  assert.match(push, /emergency_alert_mode_version \?\? 1\) >= 3/);
  assert.match(push, /androidEmergencyReady \? 'buklod-emergency-v2' : 'buklod-activity-v2'/);
  assert.match(push, /isCommunityEmergency && androidEmergencyReady \? 'buklod_alert\.wav' : 'default'/);
});

test('Global recipient overlay and navigation require verified ON MY WAY', () => {
  assert.match(host, /visible=\{Boolean\(activeShown && !activeShown\.minimized && foreground\)\}/);
  assert.match(host, /buklod_help_get_emergency_for_viewer/);
  assert.match(host, /shown\.emergency\?\.my_response !== 'ON_MY_WAY'/);
  assert.match(host, /buklod_help_get_rescue_coordinates/);
  assert.match(host, /NAVIGATE TO SOS LOCATION/);
  assert.match(host, /Linking\.openURL\(url\)/);
  assert.match(host, /buklod_help_refresh_opted_in_presence/);
});

test('Backend allows only authenticated active proximate responders to retrieve destination', () => {
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON TABLE/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /response\.response_type='ON_MY_WAY'/);
  assert.match(sql, /response\.updated_at>now\(\)-interval '90 minutes'/);
  assert.match(sql, /n\.data->>'help_request_id'=r\.id::text/);
  assert.match(sql, /r\.status='ACTIVE' AND r\.expires_at>now\(\)/);
  assert.match(sql, /p\.safety_alerts_enabled=true/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.buklod_help_get_rescue_coordinates/);
});
