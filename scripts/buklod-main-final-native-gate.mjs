import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];
const read = rel => fs.existsSync(path.join(root, rel))
  ? fs.readFileSync(path.join(root, rel), 'utf8')
  : '';
const pass = label => passes.push(label);
const fail = label => failures.push(label);
const need = (rel, token, label) => {
  if (read(rel).includes(token)) pass(label);
  else fail(label);
};
const exists = (rel, label) => {
  if (fs.existsSync(path.join(root, rel))) pass(label);
  else fail(label);
};

const pkg = JSON.parse(read('package.json') || '{}');
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
for (const name of [
  'expo-local-authentication',
  'expo-secure-store',
  'expo-notifications',
  'expo-screen-orientation',
  'expo-camera',
  'expo-image-picker',
  'expo-media-library',
  'expo-sharing',
  'expo-audio',
  'expo-video',
  'expo-location',
  'expo-haptics',
  'react-native-maps',
  'react-native-google-mobile-ads',
  '@sentry/react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  '@stream-io/video-react-native-sdk',
  '@stream-io/react-native-callingx',
  '@stream-io/react-native-webrtc',
  '@rive-app/react-native',
  '@shopify/react-native-skia',
]) {
  deps[name] ? pass('dependency: ' + name) : fail('dependency: ' + name);
}

for (const name of [
  'expo-document-picker',
  'expo-file-system',
  'expo-speech',
  'expo-linking',
  'expo-clipboard',
  'expo-web-browser',
  'expo-background-task',
  'expo-updates',
]) {
  deps[name] ? pass('support dependency: ' + name) : fail('support dependency: ' + name);
}

need('app.config.js', "orientation: 'default'", 'global orientation default');
need('app.config.js', "'expo-screen-orientation'", 'screen orientation plugin');
need('app.config.js', "initialOrientation: 'DEFAULT'", 'orientation DEFAULT');
need('app.config.js', "'@sentry/react-native/expo'", 'Sentry Expo plugin');
need('app.config.js', 'androidKeepCallAlive: true', 'Stream keep-call-alive');
need('app.config.js', 'android.permission.FOREGROUND_SERVICE_PHONE_CALL', 'phone-call foreground service permission');
need('app.config.js', 'android.permission.USE_FULL_SCREEN_INTENT', 'USE_FULL_SCREEN_INTENT permission');
need('app.config.js', 'android.permission.MANAGE_OWN_CALLS', 'MANAGE_OWN_CALLS permission');
need('app.config.js', 'android.permission.POST_NOTIFICATIONS', 'POST_NOTIFICATIONS permission');
need('app.config.js', 'ringing: true', 'Stream native ringing');
need('app.config.js', 'ReactNativeFirebaseMessagingService', 'single Firebase messaging base service');
need('app.config.js', 'enableBackgroundRemoteNotifications: true', 'background remote notifications');
need('app.config.js', "enabled: true", 'native incoming share enabled');
need('app.config.js', 'singleShareMimeTypes', 'ACTION_SEND share contract');
need('app.config.js', 'multipleShareMimeTypes', 'ACTION_SEND_MULTIPLE share contract');
need('app.config.js', 'supportsBackgroundPlayback: true', 'video background playback');
need('app.config.js', 'supportsPictureInPicture: true', 'video PiP');
need('app.config.js', 'enableBackgroundPlayback: true', 'audio background playback');
need('app.config.js', 'google-services.production.json', 'production Firebase config');
need('app.config.js', 'org.mzbministry.buklod', 'production Android package');
need('app.config.js', 'versionCode: isStaging ? undefined : 22', 'production versionCode');
need('eas.json', '"buildType": "app-bundle"', 'production AAB profile');
(pkg.main === 'index.js' ? pass('package main = index.js') : fail('package main = index.js'));
need('app.config.js', 'addNoiseCancellation: true', 'Stream native noise cancellation');
need('app.config.js', "'expo-background-task'", 'Expo background task plugin');
need('app.config.js', "'android.permission.CAMERA'", 'camera native permission');
need('app.config.js', "'android.permission.RECORD_AUDIO'", 'microphone native permission');
need('app.config.js', "'android.permission.BLUETOOTH_CONNECT'", 'Bluetooth call permission');
need('app.config.js', 'isAndroidBackgroundLocationEnabled: false', 'no always-on Android background location');
need('app.config.js', 'runtimeVersion:', 'runtime version configured');


need('src/components/BuklodTrustedDeviceGate.native.tsx', 'LocalAuthentication.authenticateAsync', 'fingerprint/Face ID trusted-device gate');
need('src/components/BuklodTrustedDeviceGate.native.tsx', 'SecureStore.setItemAsync', 'trusted-device SecureStore');
need('src/app/_layout.tsx', '<BuklodTrustedDeviceGate>', 'trusted-device gate mounted');
need('src/components/BuklodCommunityHelp.tsx', 'BUKLOD_SOS_LOCAL_AUTH_R2', 'SOS local-auth confirmation');
need('src/components/BuklodCommunityHelp.tsx', 'LocalAuthentication.authenticateAsync', 'SOS fingerprint/Face ID/PIN path');
const versionAtLeast = (raw, minimum) => {
  const parse = v => String(v || '').replace(/^[~^]/, '').split('-')[0].split('.').map(Number);
  const a = parse(raw), b = parse(minimum);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
};
versionAtLeast(deps['@stream-io/video-react-native-sdk'], '1.32.0')
  ? pass('Stream Video SDK minimum 1.32')
  : fail('Stream Video SDK minimum 1.32');
versionAtLeast(deps['@stream-io/react-native-webrtc'], '145.0.0')
  ? pass('Stream WebRTC minimum 145')
  : fail('Stream WebRTC minimum 145');

need('src/utils/setPushConfig.ts', 'firebase-video-production', 'production Stream push provider fallback');
need('src/utils/setPushConfig.ts', 'buklod_incoming_calls_v2', 'dedicated incoming-call channel');
need('src/utils/setPushConfig.ts', 'createStreamVideoClient', 'killed-state Stream client factory');
need('src/utils/setFirebaseListeners.android.ts', 'setBackgroundMessageHandler', 'FCM killed/background handler');
need('src/utils/setFirebaseListeners.android.ts', 'firebaseDataHandler', 'Stream native Firebase handler');
need('index.js', 'setPushConfig();', 'push config before router');
need('index.js', 'setFirebaseListeners();', 'Firebase listeners before router');
need('index.js', 'buklodSentry', 'early Sentry bootstrap');

need('src/lib/pushNotifications.ts', 'BUKLOD_EMERGENCY_ALERT_MODE_R2_CLIENT', 'SOS Emergency Alert R2 client');
need('src/lib/pushNotifications.ts', 'buklod-emergency-v1', 'dedicated SOS MAX channel');
need('src/lib/pushNotifications.ts', 'emergency_alert_mode_version', 'SOS capability registration');
need('supabase/functions/push/index.ts', 'BUKLOD_EMERGENCY_ALERT_MODE_R2', 'source-tracked production SOS push R2');
need('supabase/functions/push/index.ts', "priority: 'high'", 'high-priority remote push');
need('supabase/functions/push/index.ts', "buklod-emergency-v1", 'SOS native channel routing');

need('src/app/+native-intent.ts', "getSharedPayloads", 'cold-start incoming share detector');
need('src/app/+native-intent.ts', "return '/handle-share'", 'cold-start incoming share route');
need('src/lib/buklodIncomingShare.ts', 'useIncomingShare', 'incoming share hook');

need('src/lib/gcash.ts', 'getGCashDetails', 'GCash runtime getGCashDetails');
need('src/lib/gcash.ts', 'copyGCashNumber', 'GCash clipboard support');
need('src/lib/gcash.ts', 'openGCashPayment', 'GCash secure payment handoff');
need('src/lib/gcash.ts', 'Clipboard', 'GCash Clipboard native support');
need('src/lib/gcash.ts', 'WebBrowser', 'GCash WebBrowser native support');
need('src/app/_layout.tsx', '<AdsProvider>', 'AdsProvider mounted at root');
need('src/lib/adMob.ts', 'AdsConsent', 'BUKLOD UMP consent runtime');
need('src/lib/adMob.ts', 'gatherConsent', 'BUKLOD UMP consent gathering');
need('src/lib/adMob.ts', 'canRequestAds', 'BUKLOD UMP request gate');
need('app.config.js', 'com.google.android.gms.internal.consent_sdk', 'UMP ProGuard preservation');
need('app.config.js', 'scheme,', 'native deep-link scheme');
need('metro.config.js', 'getSentryExpoConfig', 'Sentry Metro debug-id config');
need('src/lib/preachingAudio.ts', 'shouldPlayInBackground: true', 'preaching background audio');
need('src/components/PreachingAudioPlayer.tsx', 'setActiveForLockScreen', 'lock-screen preaching controls');
need('src/lib/buklodSentry.ts', 'Sentry.init', 'Sentry runtime init');

exists('modules/buklod-mlkit-translation/expo-module.config.json', 'ML Kit Expo module config');
exists('modules/buklod-mlkit-translation/android', 'ML Kit Android native module');
need('modules/buklod-mlkit-translation/android/build.gradle', "com.google.mlkit:translate:17.0.3", 'ML Kit Translate 17.0.3');
need('modules/buklod-mlkit-translation/android/build.gradle', "com.google.mlkit:language-id:17.0.6", 'ML Kit Language ID 17.0.6');
need('modules/buklod-mlkit-translation/expo-module.config.json', 'BuklodMlKitTranslationModule', 'ML Kit Kotlin module registration');
if (fs.existsSync(path.join(root, 'modules/modules/buklod-mlkit-translation'))) fail('no nested duplicate ML Kit module');
else pass('no nested duplicate ML Kit module');
exists('google-services.production.json', 'production google-services file');

if (process.env.EXPO_PUBLIC_APP_ENV === 'production') {
  /^AIza/.test((process.env.GOOGLE_MAPS_ANDROID_API_KEY || '').trim())
    ? pass('production Google Maps Android key')
    : fail('production Google Maps Android key');

  /^ca-app-pub-\d+~\d+$/.test((process.env.ADMOB_ANDROID_APP_ID || '').trim())
    ? pass('production AdMob Android app id')
    : fail('production AdMob Android app id');

  (process.env.EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME || '').trim() === 'firebase-video-production'
    ? pass('production Stream push provider')
    : fail('production Stream push provider');

  /^https:\/\//.test((process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim())
    ? pass('production Sentry DSN')
    : fail('production Sentry DSN');

  (process.env.SENTRY_ORG || '').trim() ? pass('Sentry org') : fail('Sentry org');
  (process.env.SENTRY_PROJECT || '').trim() ? pass('Sentry project') : fail('Sentry project');
}

console.log('BUKLOD MAIN FINAL NATIVE GATE');
console.log('=============================');
for (const p of passes) console.log('PASS: ' + p);

if (failures.length) {
  console.error('\nBUKLOD MAIN FINAL NATIVE GATE FAILED');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}

console.log('\nBUKLOD MAIN FINAL NATIVE GATE PASS');
