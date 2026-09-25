import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const failures = [];
const passes = [];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required native file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireAll(rel, needles, label = rel) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${label} missing: ${needle}`);
    }
  }
  if (needles.every((needle) => text.includes(needle))) {
    passes.push(label);
  }
  return text;
}

function requireAny(rel, needles, label = rel) {
  const text = read(rel);
  if (!needles.some((needle) => text.includes(needle))) {
    failures.push(
      `${label} missing all accepted markers: ${needles.join(' | ')}`,
    );
  } else {
    passes.push(label);
  }
  return text;
}

console.log('BUKLOD NATIVE COMPLETENESS CONTRACT R1');
console.log('======================================');

const pkgText = read('package.json');
let pkg = {};
try {
  pkg = JSON.parse(pkgText);
} catch {
  failures.push('package.json is not valid JSON.');
}

for (const dependency of [
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  '@sentry/react-native',
  '@stream-io/react-native-callingx',
  '@stream-io/react-native-webrtc',
  '@stream-io/video-react-native-sdk',
  'expo-audio',
  'expo-camera',
  'expo-local-authentication',
  'expo-location',
  'expo-notifications',
  'expo-secure-store',
  'expo-sharing',
  'expo-video',
  'react-native-google-mobile-ads',
  'react-native-maps',
]) {
  if (!pkg?.dependencies?.[dependency]) {
    failures.push(`Native dependency missing: ${dependency}`);
  }
}
passes.push('native dependency set');

requireAll('app.config.js', [
  "versionCode: isStaging ? undefined : 21",
  "runtimeVersion: isClassroom ? '1.3.0' : (isStaging ? '1.3.2' : '1.3.0')",
  "'android.permission.POST_NOTIFICATIONS'",
  "'android.permission.WAKE_LOCK'",
  "'android.permission.MODIFY_AUDIO_SETTINGS'",
  "'android.permission.BLUETOOTH_CONNECT'",
  "'android.permission.FOREGROUND_SERVICE'",
  "'android.permission.FOREGROUND_SERVICE_MICROPHONE'",
  "'android.permission.FOREGROUND_SERVICE_CAMERA'",
  "'android.permission.FOREGROUND_SERVICE_PHONE_CALL'",
  "'android.permission.MANAGE_OWN_CALLS'",
  "'android.permission.USE_FULL_SCREEN_INTENT'",
  "ringing: true",
  "androidKeepCallAlive: true",
  "addNoiseCancellation: true",
  "androidMessagingServiceBaseClass: 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService'",
  "'@react-native-firebase/app'",
  "'@react-native-firebase/messaging'",
  "'react-native-maps'",
  'androidGoogleMapsApiKey: googleMapsAndroidApiKey',
  "'react-native-google-mobile-ads'",
  'delayAppMeasurementInit: true',
  "'expo-notifications'",
  'enableBackgroundRemoteNotifications: true',
  "'expo-video'",
  'supportsBackgroundPlayback: true',
  'supportsPictureInPicture: true',
  "'expo-audio'",
  'enableBackgroundPlayback: true',
  "'expo-sharing'",
  'singleShareMimeTypes:',
  "'image/*'",
  "'video/*'",
  "'text/*'",
  "'expo-secure-store'",
  "'expo-local-authentication'",
  "'expo-location'",
  "host: 'buklod.expo.app'",
  "pathPrefix: '/register'",
  "'@sentry/react-native/expo'",
  "orientation: 'default'",
  "'expo-screen-orientation'",
  "initialOrientation: 'DEFAULT'",
  "const scheme = isClassroom",
  "'buklod'",
  "'./plugins/withBuklodSosQuickSettings.js'",
], 'Android/Expo native config');

const index = requireAll('index.js', [
  "import './src/lib/buklodSentry'",
  'setPushConfig();',
  'setFirebaseListeners();',
  "import 'expo-router/entry'",
], 'root native bootstrap');

const pushPos = index.indexOf('setPushConfig();');
const firebasePos = index.indexOf('setFirebaseListeners();');
const routerPos = index.indexOf("import 'expo-router/entry'");
if (
  pushPos < 0 ||
  firebasePos < 0 ||
  routerPos < 0 ||
  pushPos > routerPos ||
  firebasePos > routerPos
) {
  failures.push(
    'Stream/Firebase native bootstrap must execute before Expo Router entry.',
  );
} else {
  passes.push('pre-router Stream/Firebase startup ordering');
}

requireAll('src/utils/setPushConfig.ts', [
  'firebase-video-production',
  'buklod_incoming_calls_v2',
  'Incoming BUKLOD Calls',
  'vibration:',
  'enableOngoingCalls:',
  'shouldRejectCallWhenBusy:',
  'createStreamVideoClient:',
  'resolvePushUser',
  'STREAM_USER_ID_KEY',
  'StreamVideoClient',
  '.getOrCreateInstance',
  "'stream-token'",
  'killed-state',
], 'terminated/background Stream call push');

requireAll('src/utils/setFirebaseListeners.android.ts', [
  'getMessaging',
  'setBackgroundMessageHandler',
  'onMessage',
  'isFirebaseStreamVideoMessage',
  'firebaseDataHandler',
  "'call.missed'",
  'BUKLOD Call Alerts',
], 'Firebase background/foreground call handler');

requireAll('src/providers/StreamVideoProvider.tsx', [
  'prewarmBuklodStreamVideoClient',
  'rememberStreamPushUser',
  'ensureBuklodStreamVideoClient',
  'installBuklodCallLifecycle',
  '<RingingCalls />',
], 'Stream runtime provider');

requireAll('src/lib/buklodCallLifecycle.ts', [
  'installBuklodCallLifecycle',
  'recordBuklodStreamPushEvent',
  'call.rejected',
], 'durable call lifecycle');

requireAll('src/lib/pushNotifications.ts', [
  'registerPushToken',
  'buklod-activity-v2',
  'BUKLOD Emergency SOS',
  'AndroidImportance.MAX',
  'getExpoPushTokenAsync',
  'claim_device_token',
  'addNotificationResponseReceivedListener',
], 'general/emergency native push');

requireAll('src/providers/NotificationProvider.tsx', [
  'registerPushToken',
  'resolveBuklodNotificationTarget',
  'getLastNotificationResponse',
  'addNotificationResponseReceivedListener',
  'clearLastNotificationResponse',
  'AndroidImportance.MAX',
], 'cold-start/exact-target notification routing');

requireAll('src/components/BuklodTrustedDeviceGate.native.tsx', [
  'BUKLOD_AUTH_EMAIL_LOCAL_DEVICE_R1',
  'LocalAuthentication.authenticateAsync',
  'SecureStore.setItemAsync',
], 'native biometric/trusted-device security');

requireAll('src/app/+native-intent.ts', [
  'BUKLOD_NATIVE_INCOMING_SHARE_R2',
  'getSharedPayloads',
  "'/handle-share'",
], 'native inbound Share-to-BUKLOD cold start');

requireAll('src/app/handle-share.tsx', [
  'refreshSharePayloads',
], 'native incoming share handler');

requireAll('src/components/BuklodCommunityHelp.tsx', [
  'BUKLOD_SOS_QUICK_SETTINGS_R1',
  'useLocalSearchParams',
  "begin('EMERGENCY')",
  'Confirm Emergency SOS',
  'HOLD TO SEND SOS',
  'requestForegroundPermissionsAsync',
], 'Community SOS explicit-confirmation flow');

requireAll('plugins/withBuklodSosQuickSettings.js', [
  'BUKLOD_SOS_QUICK_SETTINGS_R1',
  'android.permission.BIND_QUICK_SETTINGS_TILE',
  'android.service.quicksettings.action.QS_TILE',
  'BuklodSosTileService',
  'buklod://buklod?sos=1',
  'unlockAndRun',
  'Build.VERSION_CODES.UPSIDE_DOWN_CAKE',
  'startActivityAndCollapse',
  'PendingIntent.getActivity',
], 'Android Quick Settings SOS tile service');

requireAll('src/components/BuklodNativeCommunityMapHeader.native.tsx', [
  'PROVIDER_GOOGLE',
  'showsTraffic',
  'showsPointsOfInterests',
  'onPoiClick',
  'google.navigation:q=',
  'travelmode=driving',
  'voice guidance',
], 'native Google map/navigation');

requireAll('src/components/BuklodMaritesBoard.native.tsx', [
  'BuklodNativeCommunityMapHeader',
  'BaseBuklodMaritesBoard',
], 'native Community Wall map placement');

requireAll('src/components/BuklodCommunityMapNav.native.tsx', [
  'BUKLOD_NATIVE_LEGACY_MAP_CARD_SUPPRESSED_R1',
  'return null',
], 'legacy static map suppression');

requireAll('src/components/BuklodNavSafeShell.tsx', [
  "normalized === '/buklod'",
  'return true',
  "router.replace('/buklod'",
], 'native root Back protection');

requireAll('src/app/(tabs)/me.tsx', [
  'BUKLOD_PROFILE_NATIVE_BACK_TO_WALL_R4',
  "router.replace('/buklod'",
], 'native Profile Back protection');

requireAll('src/lib/preachingAudio.ts', [
  'shouldPlayInBackground: true',
  "interruptionMode:",
  "'doNotMix'",
], 'background preaching audio');

requireAll('src/components/PreachingAudioPlayer.tsx', [
  'setActiveForLockScreen',
], 'Android lock-screen audio controls');

requireAll('src/lib/buklodSentry.ts', [
  'Sentry.init',
  'sendDefaultPii: false',
  'enableAutoSessionTracking: true',
], 'Sentry native bootstrap');

requireAll('modules/buklod-mlkit-translation/expo-module.config.json', [
  'BuklodMlKitTranslationModule',
], 'ML Kit Expo module declaration');

requireAll('modules/buklod-mlkit-translation/android/build.gradle', [
  "com.google.mlkit:translate:17.0.3",
  "com.google.mlkit:language-id:17.0.6",
], 'ML Kit Android dependencies');

requireAny(
  'modules/buklod-mlkit-translation/android/src/main/java/org/mzbministry/buklod/mlkittranslation/BuklodMlKitTranslationModule.kt',
  ['class BuklodMlKitTranslationModule'],
  'ML Kit Kotlin native class',
);

requireAll('eas.json', [
  '"production":',
  '"channel": "production"',
  '"environment": "production"',
  '"EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME": "firebase-video-production"',
  '"production-apk":',
  '"buildType": "apk"',
], 'production EAS Android profile');

const gservicesText = read('google-services.production.json');
try {
  const cfg = JSON.parse(gservicesText);
  const clients = cfg?.client ?? [];
  const main = clients.find(
    (c) =>
      c?.client_info?.android_client_info?.package_name ===
      'org.mzbministry.buklod',
  );
  if (cfg?.project_info?.project_id !== 'buklod-efa4a') {
    failures.push('Production Firebase project_id mismatch.');
  }
  if (
    main?.client_info?.mobilesdk_app_id !==
    '1:1014299074416:android:bd8d04868e7f2c67ab39b5'
  ) {
    failures.push('Production Firebase Main app ID mismatch.');
  }
  if (
    cfg?.project_info?.project_id === 'buklod-efa4a' &&
    main?.client_info?.mobilesdk_app_id ===
      '1:1014299074416:android:bd8d04868e7f2c67ab39b5'
  ) {
    passes.push('production Firebase identity');
  }
} catch {
  failures.push('google-services.production.json is not valid JSON.');
}

console.log('');
for (const pass of passes) {
  console.log(`PASS: ${pass}`);
}

if (failures.length) {
  console.error('');
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.error(
    `\nNATIVE COMPLETENESS CONTRACT FAILED with ${failures.length} blocker(s).`,
  );
  console.error('DO NOT BUILD APK.');
  process.exit(1);
}

console.log('');
console.log(
  'NATIVE COMPLETENESS CONTRACT PASSED — static native requirements are locked.',
);
console.log(
  'Physical-device QA is still required for terminated-state calls, notifications, Maps, AdMob, Sentry, and media behavior.',
);
