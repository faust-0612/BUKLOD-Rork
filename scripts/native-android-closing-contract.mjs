import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`MISSING FILE: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function mustInclude(rel, needles, label = rel) {
  const raw = read(rel);
  for (const needle of Array.isArray(needles) ? needles : [needles]) {
    if (!raw.includes(needle)) {
      throw new Error(`${label}: missing required contract token: ${needle}`);
    }
  }
}

function mustExist(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`MISSING REQUIRED NATIVE RC FILE: ${rel}`);
}

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
  console.log(`PASS  ${name}`);
}

process.env.APP_VARIANT = 'production';
process.env.EXPO_PUBLIC_APP_ENV = 'production';
process.env.BUKLOD_APP_TARGET = 'main';

check('Main Android identity / versionCode 21', () => {
  const makeConfig = require(path.join(root, 'app.config.js'));
  const config = makeConfig({ config: {} });
  if (config.name !== 'BUKLOD') throw new Error(`Unexpected app name: ${config.name}`);
  if (config.version !== '1.3.0') throw new Error(`Unexpected app version: ${config.version}`);
  if (config.android?.package !== 'org.mzbministry.buklod') throw new Error(`Unexpected package: ${config.android?.package}`);
  if (config.android?.versionCode !== 21) throw new Error(`Expected versionCode 21, got ${config.android?.versionCode}`);
  if (!config.android?.permissions?.includes('android.permission.ACCESS_NOTIFICATION_POLICY')) {
    throw new Error('Emergency Notification Policy permission missing');
  }
});

check('Persistent Supabase session', () => {
  mustInclude('src/lib/supabase.ts', ['persistSession: true', 'autoRefreshToken: true']);
});

check('Email 6-digit OTP recovery', () => {
  mustInclude('src/app/(auth)/forgot-password.tsx', [
    "account-recovery-otp-v1",
    "slice(0, 6)",
    "action: 'verify_otp'",
    "action: 'reset_password'",
  ]);
});

check('Trusted-device biometric / device PIN unlock', () => {
  mustInclude('src/app/_layout.tsx', '<BuklodTrustedDeviceGate>');
  mustInclude('src/components/BuklodTrustedDeviceGate.native.tsx', [
    "expo-local-authentication",
    "expo-secure-store",
    'LocalAuthentication.authenticateAsync',
    "fallbackLabel: 'Use device PIN'",
    'disableDeviceFallback: false',
    'SIGN IN WITH PASSWORD',
  ]);
});

check('SOS transport-level device-owner verification', () => {
  mustExist('src/lib/buklodEmergencyTriggerFetch.ts');
  mustInclude('src/lib/supabase.ts', 'createBuklodEmergencyTriggerFetch');
  mustInclude('src/lib/buklodEmergencyTriggerFetch.ts', [
    "promptMessage: 'Verify BUKLOD SOS'",
    "fallbackLabel: 'Use device PIN'",
    'disableDeviceFallback: false',
    'x-buklod-emergency-trigger-source',
    'x-buklod-emergency-verification',
    'x-buklod-installation-id',
  ]);
});

check('SOS trace/audit migration', () => {
  mustInclude('supabase/migrations/20260917213000_sos_verified_trigger_audit_r2.sql', [
    'trigger_source',
    'identity_verification',
    'device_installation_hash',
    'location_accuracy_m',
    'auth.uid()',
  ]);
});

check('Canonical verified SOS screen', () => {
  mustInclude('src/app/sos.tsx', [
    "Location.Accuracy.Highest",
    'HOLD TO VERIFY & SEND SOS',
    "p_kind: 'EMERGENCY'",
    "buklod-help-alert",
  ]);
});

check('Community SOS routes to canonical verified screen', () => {
  mustInclude('src/components/BuklodCommunityHelp.tsx', [
    "import { router } from 'expo-router'",
    "router.push('/sos?trigger=in_app' as any)",
  ]);
});

check('Android SOS Quick Settings tile + launcher shortcut', () => {
  mustInclude('plugins/withBuklodWebRTC.js', 'withBuklodEmergencyTriggers');
  mustInclude('plugins/withBuklodEmergencyTriggers.js', [
    'android.service.quicksettings.action.QS_TILE',
    'android.permission.BIND_QUICK_SETTINGS_TILE',
    'buklod://sos?trigger=quick_tile',
    'buklod://sos?trigger=app_shortcut',
    'BUKLOD Emergency SOS',
  ]);
});

check('Lock-screen SOS Ready entry point', () => {
  mustInclude('src/lib/buklodEmergencyAlertMode.ts', [
    'BUKLOD_SOS_READY_CHANNEL_ID',
    'armBuklodSosReadyNotification',
    "kind: 'buklod_sos_trigger'",
    "trigger: 'lockscreen_action'",
  ]);
  mustInclude('src/providers/NotificationProvider.tsx', [
    "kind==='buklod_sos_trigger'",
    "/sos?trigger=lockscreen_action",
  ]);
});

check('Emergency MAX-priority / DND channel', () => {
  mustInclude('src/lib/buklodEmergencyAlertMode.ts', [
    'AndroidImportance.MAX',
    'bypassDnd: true',
    'AndroidAudioUsage.ALARM',
  ]);
});

check('Closed/background call native foundation', () => {
  mustInclude('app.config.js', [
    'androidKeepCallAlive: true',
    'ringing: true',
    "androidMessagingServiceBaseClass: 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService'",
    'enableBackgroundRemoteNotifications: true',
  ]);
});

check('IGPAT camera/video native foundation', () => {
  const pkg = require(path.join(root, 'package.json'));
  for (const dep of ['expo-camera', 'expo-video', 'expo-image-picker']) {
    if (!pkg.dependencies?.[dep]) throw new Error(`Missing ${dep}`);
  }
});

check('Animated character and Kingdom native renderers', () => {
  const pkg = require(path.join(root, 'package.json'));
  if (!pkg.dependencies?.['@rive-app/react-native']) throw new Error('Missing Rive native dependency');
  if (!pkg.dependencies?.['@shopify/react-native-skia']) throw new Error('Missing Skia native dependency');
});

check('Native map / hybrid satellite / live foreground location', () => {
  const pkg = require(path.join(root, 'package.json'));
  if (!pkg.dependencies?.['react-native-maps']) throw new Error('Missing react-native-maps');
  if (!pkg.dependencies?.['expo-location']) throw new Error('Missing expo-location');
  mustInclude('src/components/BuklodCommunityMapNav.native.tsx', [
    "useState<NativeMapType>('hybrid')",
    'Location.watchPositionAsync',
    'google.navigation:q=',
  ]);
});

check('Production APK lane', () => {
  const eas = require(path.join(root, 'eas.json'));
  const apk = eas?.build?.['production-apk'];
  if (apk?.extends !== 'production') throw new Error('production-apk must extend production');
  if (apk?.android?.buildType !== 'apk') throw new Error('production-apk must build APK');
  if (eas?.build?.production?.env?.EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME !== 'firebase-video-production') {
    throw new Error('Production Stream push provider mismatch');
  }
});

console.log(`\nBUKLOD NATIVE ANDROID CLOSING CONTRACT: PASS (${checks.length} gates)`);
console.log('This contract proves required source/config is present. Physical-device behavior still requires the APK smoke test.');
