const failures = [];
const warnings = [];

const clean = (value) => String(value ?? '').trim();
const isAdMobAppId = (value) => /^ca-app-pub-\d{16}~\d{10}$/.test(value);
const isAdMobUnitId = (value) => /^ca-app-pub-\d{16}\/\d{10}$/.test(value);
const isGoogleSampleId = (value) => value.startsWith('ca-app-pub-3940256099942544');

const env = clean(process.env.EXPO_PUBLIC_APP_ENV);
const appId = clean(process.env.ADMOB_ANDROID_APP_ID);
const genericBanner = clean(process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID);

const effectiveUnits = {
  HOME_BANNER:
    clean(process.env.EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID) ||
    genericBanner,
  COMMUNITY_BANNER:
    clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_BANNER_UNIT_ID) ||
    genericBanner,
  CONTENT_BANNER:
    clean(process.env.EXPO_PUBLIC_ADMOB_CONTENT_BANNER_UNIT_ID) ||
    genericBanner,
  INTERSTITIAL:
    clean(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID),
  REWARDED:
    clean(process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID),
};

if (env !== 'production') {
  failures.push('EXPO_PUBLIC_APP_ENV must be production for the Android AdMob production gate.');
}

if (!isAdMobAppId(appId)) {
  failures.push('ADMOB_ANDROID_APP_ID is missing or is not a valid AdMob Android App ID.');
} else if (isGoogleSampleId(appId)) {
  failures.push('ADMOB_ANDROID_APP_ID is a Google sample/test App ID, not a production BUKLOD App ID.');
}

for (const [name, value] of Object.entries(effectiveUnits)) {
  if (!isAdMobUnitId(value)) {
    failures.push(`${name} is missing or is not a valid AdMob ad-unit ID.`);
    continue;
  }

  if (isGoogleSampleId(value)) {
    failures.push(`${name} resolves to a Google sample/test ad-unit ID.`);
  }
}

const communityNative = clean(
  process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID,
);

if (!communityNative) {
  warnings.push(
    'EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID is not set; Community Wall will use its validated banner fallback.',
  );
} else if (!isAdMobUnitId(communityNative)) {
  failures.push('EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID is not a valid AdMob ad-unit ID.');
} else if (isGoogleSampleId(communityNative)) {
  failures.push('EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID is a Google sample/test ad-unit ID.');
}

console.log('BUKLOD Android AdMob Production Preflight');
console.log('=========================================');
console.log('Active APK ad scope: Home, Community Wall, Content/Focus, Interstitial, Rewarded.');
console.log('IGPAT/Reels is intentionally excluded from the production AdMob gate.');

for (const warning of warnings) {
  console.log(`WARN: ${warning}`);
}

for (const failure of failures) {
  console.error(`FAIL: ${failure}`);
}

if (failures.length) {
  console.error(`\nANDROID ADMOB PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nANDROID ADMOB PREFLIGHT PASSED.');
