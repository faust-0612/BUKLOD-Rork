#!/usr/bin/env node
'use strict';
/**
 * Exact identity gate before paid EAS credits. Never logs credentials.
 * Injects public client config into a LOCAL temporary EAS profile only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mainEas = '23dad7d0-389a-406e-8dec-08965dab85d8';
const classroomEas = '14100ed1-7f25-4551-9627-09d280498241';
const target = 'org.mzbministry.buklod.connect';
const env = process.env;
const required = [
  'EXPO_TOKEN',
  'CONNECT_FIREBASE_JSON_B64',
];
const missing = required.filter(key => !String(env[key] || '').trim());
if (missing.length) {
  process.stderr.write('BLOCKED_CONNECT_APK: dedicated setup missing: ' + missing.join(', ') + '\n');
  process.exitCode = 12;
} else {
  const projectId = String(env.CONNECT_EAS_PROJECT_ID || '').trim();
  assert.equal(projectId, 'fbc71093-6abb-43e6-9493-14b2c8117df8', 'Unexpected standalone EAS project ID');
  assert.notEqual(projectId, mainEas);
  assert.notEqual(projectId, classroomEas);
  const source = JSON.parse(fs.readFileSync('eas.json', 'utf8')).build?.['connect-qa-apk']?.env;
  const backendUrl = source?.EXPO_PUBLIC_SUPABASE_URL;
  const backendKey = source?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.match(backendUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
  assert.ok(String(backendKey).startsWith('sb_publishable_'), 'Use publishable key, not service_role');
  let firebase;
  let decoded;
  try {
    decoded = Buffer.from(env.CONNECT_FIREBASE_JSON_B64, 'base64');
    firebase = JSON.parse(decoded.toString('utf8'));
  } catch {
    throw new Error('Invalid standalone Firebase JSON');
  }
  const packages = (firebase.client || [])
    .map(c => c?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  assert.ok(packages.includes(target), 'Firebase JSON does not match standalone Connect Android package');
  assert.equal(firebase.project_info?.project_id, 'buklod-efa4a',
    'Existing Stream FCM push provider requires BUKLOD Firebase project');
  fs.writeFileSync(path.resolve('google-services.connect.json'), decoded, { mode: 0o600 });
  const easPath = path.resolve('eas.json');
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  const profile = eas.build?.['connect-qa-apk'];
  assert.equal(profile?.channel, 'connect-qa');
  assert.equal(profile?.android?.buildType, 'apk');
  assert.equal(profile?.env?.BUKLOD_APP_TARGET, 'connect');
  assert.equal(profile?.env?.EXPO_PUBLIC_BUKLOD_APP_TARGET, 'connect');
  profile.env.CONNECT_EAS_PROJECT_ID = projectId;
  profile.env.CONNECT_GOOGLE_SERVICES_FILE = './google-services.connect.json';
  // Public mobile client variables, never Supabase service_role credentials.
  profile.env.EXPO_PUBLIC_SUPABASE_URL = backendUrl;
  profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = backendKey;
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write('CONNECT_PRECHECK_OK: production Android package, isolated QA OTA, independent EAS/Firebase\n');
}
