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
need('app.config.js', 'versionCode: isStaging ? undefined : 20', 'production versionCode');
need('eas.json', '"buildType": "app-bundle"', 'production AAB profile');

need('src/components/BuklodTrustedDeviceGate.native.tsx', 'LocalAuthentication.authenticateAsync', 'fingerprint/Face ID trusted-device gate');
need('src/components/BuklodTrustedDeviceGate.native.tsx', 'SecureStore.setItemAsync', 'trusted-device SecureStore');
need('src/app/_layout.tsx', '<BuklodTrustedDeviceGate>', 'trusted-device gate mounted');
need('src/components/BuklodCommunityHelp.tsx', 'BUKLOD_SOS_LOCAL_AUTH_R2', 'SOS local-auth confirmation');
need('src/components/BuklodCommunityHelp.tsx', 'LocalAuthentication.authenticateAsync', 'SOS fingerprint/Face ID/PIN path');
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

need('src/lib/preachingAudio.ts', 'shouldPlayInBackground: true', 'preaching background audio');
need('src/components/PreachingAudioPlayer.tsx', 'setActiveForLockScreen', 'lock-screen preaching controls');
need('src/lib/buklodSentry.ts', 'Sentry.init', 'Sentry runtime init');

exists('modules/buklod-mlkit-translation/expo-module.config.json', 'ML Kit Expo module config');
exists('modules/buklod-mlkit-translation/android', 'ML Kit Android native module');
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
