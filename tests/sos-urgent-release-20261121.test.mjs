import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const c=readFileSync('app.config.js','utf8');
const push=readFileSync('supabase/functions/push/index.ts','utf8');
const native=readFileSync('src/lib/pushNotifications.ts','utf8');
const r1=readFileSync('scripts/community-help-sos-release-contract.mjs','utf8');
test('Native SOS audio is bundled, installed and registered before server targeting',()=>{
 assert.match(c,/sounds: \['\.\/assets\/sounds\/buklod_alert\.wav'\]/);
 assert.match(native,/setNotificationChannelAsync\('buklod-emergency-v2'/);
 assert.match(native,/getNotificationChannelAsync\('buklod-emergency-v2'/);
 assert.match(native,/if \(emergencyChannelReady\)/);
 assert.match(native,/buklod_help_register_emergency_channel/);
 assert.match(push,/emergency_alert_mode_version \?\? 1\) >= 3/);
 assert.match(push,/androidEmergencyReady \? 'buklod-emergency-v2' : 'buklod-activity-v2'/);
 assert.match(push,/isCommunityEmergency && androidEmergencyReady \? 'buklod_alert\.wav' : 'default'/);
});
test('Old transport and native location safety contract remain intact',()=>{
 assert.match(push,/ttl: isCommunityEmergency \? 600/);
 assert.match(push,/emergencyCollapseId/);
 assert.match(c,/isAndroidBackgroundLocationEnabled: false/);
 assert.match(c,/isAndroidForegroundServiceEnabled: false/);
 assert.match(r1,/buklod_help_get_rescue_coordinates/);
 assert.match(r1,/REVOKE INSERT, UPDATE, DELETE ON TABLE/);
});
