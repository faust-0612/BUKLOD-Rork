#!/usr/bin/env node
/**
 * Fail-closed preflight for an independently installable BUKLOD native QA APK.
 * Read-only, no EAS invocation, no release mutation, no secrets in logs.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const NATIVE_LAB = Object.freeze({
  packageId: 'org.mzbministry.buklod.nativeqa',
  runtimeVersion: '1.4.0-nativeqa.1',
  channel: 'native-lab',
  environment: 'preview',
  expoProjectId: '23dad7d0-389a-406e-8dec-08965dab85d8',
});

export function inspectNativeLabBuild({config, eas, gate, firebase, env = {}}) {
  const failures = [];
  const lab = eas?.build?.['native-lab'];
  const fail = (condition, message) => { if (!condition) failures.push(message); };

  fail(config?.name === 'BUKLOD Native QA', 'App name must be BUKLOD Native QA');
  fail(config?.android?.package === NATIVE_LAB.packageId, 'Isolated Android package missing');
  fail(config?.runtimeVersion === NATIVE_LAB.runtimeVersion, 'Native QA runtime mismatch');
  fail(config?.scheme === 'buklod-nativeqa', 'Dedicated OAuth/deep-link scheme missing');
  fail(config?.android?.googleServicesFile === './google-services.native-lab.json', 'Dedicated Firebase config path missing');
  fail(config?.extra?.nativeLab === true && config?.extra?.appEnvironment === 'staging', 'Native QA variant does not map to staging');
  fail(config?.extra?.eas?.projectId === NATIVE_LAB.expoProjectId, 'Unexpected Expo project identity');
  fail(lab?.channel === NATIVE_LAB.channel, 'EAS native-lab channel missing');
  fail(lab?.environment === NATIVE_LAB.environment, 'Expo preview environment required');
  fail(lab?.distribution === 'internal' && lab?.android?.buildType === 'apk', 'Internal Android APK profile required');
  fail(lab?.env?.APP_VARIANT === 'native-lab' && lab?.env?.EXPO_PUBLIC_APP_ENV === 'staging', 'Native-lab build env missing');
  fail(eas?.build?.production?.channel === 'production' && eas?.build?.['staging-user']?.channel === 'staging-user',
    'Existing staging or production channel has changed');

  fail(gate?.packageId === NATIVE_LAB.packageId && gate?.runtimeVersion === NATIVE_LAB.runtimeVersion,
    'Native QA gate does not match exact package/runtime');
  fail(gate?.readyForBuild === true, 'Build not authorized until all native incorporation gates pass');
  fail(gate?.nativeGifCommitContentVerified === true, 'Direct Android IME GIF handling not verified');
  fail(gate?.googleDriveOAuthNativeVerified === true, 'Google Drive native OAuth not verified');
  fail(gate?.videoScrollAdPrefetchConsolidated === true, 'Scroll pause and NativeAd prewarm not reconciled');
  fail(gate?.firebaseClientRegistered === true, 'Native-lab Firebase registration not declared verified');

  const clients = Array.isArray(firebase?.client) ? firebase.client : [];
  const matches = clients.filter(c => c?.client_info?.android_client_info?.package_name === NATIVE_LAB.packageId);
  fail(matches.length === 1 && typeof matches[0]?.client_info?.mobilesdk_app_id === 'string',
    'Firebase configuration must contain exactly one real registered native-lab Android client');
  const url = String(env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().toLowerCase();
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/.exec(url);
  fail(Boolean(match), 'Preview Supabase URL missing or malformed');
  fail(Boolean(match && match[1] !== 'yhanxndaqbmuzbdqlblu'), 'Production Supabase is forbidden in native lab');
  fail(Boolean(env.BUKLOD_STAGING_PROJECT_REF && match && match[1] === env.BUKLOD_STAGING_PROJECT_REF),
    'Native-lab Supabase project must match explicitly supplied staging reference');
  fail(/^sb_publishable_/.test(String(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '')),
    'Preview Supabase publishable key missing');
  fail(Boolean(env.EXPO_TOKEN), 'Expo build credentials not supplied');

  return { ready: failures.length === 0, failures };
}

async function main() {
  const { default: eas } = await import('../eas.json', { with: { type: 'json' } });
  const { default: gate } = await import('../release/native-lab-apk-20261115.json', { with: { type: 'json' } });
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const old = {APP_VARIANT:process.env.APP_VARIANT,EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV};
  process.env.APP_VARIANT = 'native-lab';
  process.env.EXPO_PUBLIC_APP_ENV = 'staging';
  const config = require('../app.config.js')({ config: { extra: {} } });
  for (const [k,v] of Object.entries(old)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  let firebase = null;
  if (fs.existsSync('google-services.native-lab.json')) {
    firebase = JSON.parse(fs.readFileSync('google-services.native-lab.json','utf8'));
  }
  const result = inspectNativeLabBuild({ config, eas, gate, firebase, env: process.env });
  for (const f of result.failures) console.error('NATIVE QA BUILD BLOCK:', f);
  if (!result.ready) process.exitCode = 1;
  else console.log('NATIVE QA BUILD PREFLIGHT PASS -- build may proceed; no device acceptance implied.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('NATIVE QA BUILD BLOCK:', e.message); process.exitCode = 1; });
}
