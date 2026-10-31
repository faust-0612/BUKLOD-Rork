import fs from 'node:fs';
const errors = [];
const appVariant = process.env.APP_VARIANT || '';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const easProject = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';
const expected = 'https://yhanxndaqbmuzbdqlblu.supabase.co';

if (appVariant !== 'staging') errors.push('Build must use APP_VARIANT=staging');
if (url !== expected) errors.push('Original BUKLOD Connect production URL is required in production-connected Staging mode');
if (!/^sb_publishable_/.test(publicKey)) errors.push('Missing/invalid public Supabase key');
if (/service_role|sb_secret_/i.test(publicKey)) errors.push('Privileged Supabase keys must never be embedded in the APK');
if (easProject && easProject !== '23dad7d0-389a-406e-8dec-08965dab85d8') errors.push('Unexpected EAS project ID');

const eas = JSON.parse(fs.readFileSync('eas.json','utf8'));
const profile = eas.build['staging-user'];
if (profile?.environment !== 'production' || profile.channel !== 'staging-user'
  || profile.android?.buildType !== 'apk' || profile.env.APP_VARIANT !== 'staging'
  || profile.env.EXPO_PUBLIC_APP_ENV !== 'staging') errors.push('Staging-user build identity/profile mismatch');
const cfg = require('../app.config.js')({config:{}});
if (cfg.android.package !== 'org.mzbministry.buklod.staging' || cfg.runtimeVersion !== '1.3.2')
  errors.push('Staging Android package/runtime mismatch');
if (cfg.updates.url !== 'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8')
  errors.push('Unexpected EAS Updates project');
const google = JSON.parse(fs.readFileSync(cfg.android.googleServicesFile,'utf8'));
const packages = (google.client || []).map(x=>x.client_info?.android_client_info?.package_name);
if (!packages.includes('org.mzbministry.buklod.staging')) errors.push('Firebase config lacks registered staging package');

if (errors.length) {
  errors.forEach(e=>console.error('BLOCKED: '+e));
  process.exitCode=1;
} else {
  console.log('STAGING_LIVE_BACKEND_PREFLIGHT=PASS; public backend ref verified; credentials not printed');
}
