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
const target = 'org.mzbministry.buklod.connect.staging';
const env = process.env;
const required = [
  'EXPO_TOKEN',
  'CONNECT_EAS_PROJECT_ID',
  'CONNECT_STAGING_FIREBASE_JSON_B64',
];
const missing = required.filter(key => !String(env[key] || '').trim());
if (missing.length) {
  process.stderr.write('BLOCKED_CONNECT_APK: dedicated setup missing: ' + missing.join(', ') + '\n');
  process.exitCode = 12;
} else {
  assert.notEqual(env.CONNECT_EAS_PROJECT_ID.trim(), mainEas, 'Main EAS project forbidden');
  assert.notEqual(env.CONNECT_EAS_PROJECT_ID.trim(), classroomEas, 'Classroom EAS project forbidden');
  const source = JSON.parse(fs.readFileSync('eas.json', 'utf8')).build?.['connect-staging']?.env;
  const backendUrl = source?.EXPO_PUBLIC_SUPABASE_URL;
  const backendKey = source?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.match(backendUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
  assert.ok(String(backendKey).startsWith('sb_publishable_'), 'Use publishable key, not service_role');
  let firebase;
  let decoded;
  try {
    decoded = Buffer.from(env.CONNECT_STAGING_FIREBASE_JSON_B64, 'base64');
    firebase = JSON.parse(decoded.toString('utf8'));
  } catch {
    throw new Error('Invalid standalone Firebase JSON');
  }
  const packages = (firebase.client || [])
    .map(c => c?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  assert.ok(packages.includes(target), 'Firebase missing standalone staging Android package');
  assert.ok(firebase.project_info?.project_id, 'Firebase project info missing');
  fs.writeFileSync(path.resolve('google-services.connect.staging.json'), decoded, { mode: 0o600 });
  const easPath = path.resolve('eas.json');
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  const profile = eas.build?.['connect-staging'];
  assert.equal(profile?.channel, 'connect-staging');
  assert.equal(profile?.android?.buildType, 'apk');
  assert.equal(profile?.env?.BUKLOD_APP_TARGET, 'connect');
  assert.equal(profile?.env?.EXPO_PUBLIC_BUKLOD_APP_TARGET, 'connect');
  profile.env.CONNECT_EAS_PROJECT_ID = env.CONNECT_EAS_PROJECT_ID.trim();
  profile.env.CONNECT_GOOGLE_SERVICES_FILE = './google-services.connect.staging.json';
  // Public mobile client variables, never Supabase service_role credentials.
  profile.env.EXPO_PUBLIC_SUPABASE_URL = backendUrl;
  profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = backendKey;
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write('CONNECT_PRECHECK_OK: independent EAS, Firebase, backend and staging APK profile\n');
}
